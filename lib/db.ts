import fs from 'node:fs';
import path from 'node:path';

/**
 * One SQL code path, two engines:
 *  - production: Neon Postgres through `pg` (DATABASE_URL)
 *  - local/preview: embedded Postgres (PGlite, WASM) persisted under ./.data
 * Both speak Postgres and accept $1 placeholders, so repository code never branches.
 */

type QueryResult = { rows: Record<string, any>[] };

interface Driver {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  exec(sql: string): Promise<void>;
  kind: 'neon' | 'pglite';
}

const g = globalThis as unknown as { __ospmDriver?: Promise<Driver>; __ospmSeedEpoch?: number };

/** Bumped whenever the driver has to rebuild itself, so seeding can be replayed. */
export const seedEpoch = (): number => g.__ospmSeedEpoch ?? 0;

const looksRecoverable = (err: unknown): boolean =>
  /ENOENT|EIO|EBADF|not a database|database .* does not exist|file is not a database|could not open|Data directory|aborted|terminated|closed|WAL/i.test(
    (err as Error)?.message ?? '',
  );

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import('pg');
    // Neon hands out a limited number of connections. Keep the pool small, close
    // idle sockets, and fail fast instead of hanging a serverless invocation.
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.PGPOOL_MAX) || 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 12_000,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    // A pool that emits an unhandled error takes the lambda down with it.
    pool.on('error', (err) => console.error('[db] idle Postgres connection error:', err.message));

    const run = async (text: string, params: unknown[]) => {
      try {
        return await pool.query(text, params as any[]);
      } catch (err) {
        // Neon suspends idle databases; the first connection after a sleep can
        // time out. One retry turns that into a slow request instead of a 500.
        if (!/ECONNRESET|ETIMEDOUT|terminating connection|Connection terminated|timeout expired/i.test((err as Error).message)) throw err;
        console.warn('[db] retrying after a transient Postgres connection error');
        return await pool.query(text, params as any[]);
      }
    };

    return {
      kind: 'neon',
      async query(sql, params = []) {
        const res = await run(sql, params);
        return { rows: res.rows as Record<string, any>[] };
      },
      async exec(sql) {
        await run(sql, []);
      },
    };
  }

  // Embedded Postgres for zero-config local runs.
  const { PGlite } = await import('@electric-sql/pglite');
  const dir =
    process.env.PGLITE_DIR ||
    (process.env.VERCEL
      ? path.join('/tmp', 'ospm-pglite')
      : path.join(process.cwd(), '.data', 'pglite'));
  if (process.env.VERCEL) {
    console.warn('[db] DATABASE_URL is not set — using ephemeral /tmp Postgres. Add Neon for persistence.');
  }

  async function open(): Promise<any> {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const instance = await PGlite.create(dir);
      await instance.query('SELECT 1');
      return instance;
    } catch (err) {
      // A restored snapshot or a deleted directory can leave an unreadable store.
      // Falling back to an in-memory Postgres keeps the product usable, and the
      // rooms re-seed on the next request.
      console.error('[db] embedded Postgres could not open its directory:', (err as Error).message);
      console.warn('[db] falling back to in-memory Postgres — data will be re-seeded.');
      const memory = await PGlite.create();
      await memory.query('SELECT 1');
      return memory;
    }
  }

  let db = await open();
  let chain: Promise<unknown> = Promise.resolve();

  async function recover(): Promise<void> {
    db = await open();
    g.__ospmSeedEpoch = (g.__ospmSeedEpoch ?? 0) + 1;
  }
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  return {
    kind: 'pglite',
    query(sql, params = []) {
      return serial(async () => {
        try {
          const res = await db.query(sql, params as any[]);
          return { rows: res.rows as Record<string, any>[] };
        } catch (err) {
          if (!looksRecoverable(err)) throw err;
          console.error('[db] recovering embedded Postgres after:', (err as Error).message);
          await recover();
          const res = await db.query(sql, params as any[]);
          return { rows: res.rows as Record<string, any>[] };
        }
      });
    },
    exec(sql) {
      return serial(async () => {
        try {
          await db.exec(sql);
        } catch (err) {
          if (!looksRecoverable(err)) throw err;
          console.error('[db] recovering embedded Postgres after:', (err as Error).message);
          await recover();
          await db.exec(sql);
        }
      });
    },
  };
}

async function driver(): Promise<Driver> {
  if (!g.__ospmDriver) {
    // Never cache a rejected promise: a database that wakes up later must work
    // without waiting for the next cold start.
    g.__ospmDriver = createDriver().catch((err) => {
      g.__ospmDriver = undefined;
      throw err;
    });
  }
  return g.__ospmDriver;
}

export async function sql<T = Record<string, any>>(query: string, params: unknown[] = []): Promise<T[]> {
  const d = await driver();
  const res = await d.query(query, params);
  return res.rows as T[];
}

export async function exec(query: string): Promise<void> {
  const d = await driver();
  await d.exec(query);
}

export async function engineKind(): Promise<'neon' | 'pglite'> {
  return (await driver()).kind;
}

export const asJson = (value: unknown): string => JSON.stringify(value ?? null);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  role text DEFAULT 'member',
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  owner_id text NOT NULL,
  stage_key text DEFAULT 'discover',
  status text DEFAULT 'discovering',
  problem jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  project_id text NOT NULL,
  user_id text NOT NULL,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  user_id text,
  author text NOT NULL,
  role text DEFAULT 'member',
  kind text DEFAULT 'chat',
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_project_idx ON messages (project_id, created_at);

CREATE TABLE IF NOT EXISTS signals (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  type text NOT NULL,
  label text NOT NULL,
  detail text DEFAULT '',
  score integer DEFAULT 0,
  status text DEFAULT 'open',
  evidence jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signals_project_idx ON signals (project_id);

CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  stage_key text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  status text DEFAULT 'draft',
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, kind)
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  title text NOT NULL,
  detail text DEFAULT '',
  stage_key text DEFAULT 'build',
  status text DEFAULT 'todo',
  owner text,
  priority text DEFAULT 'P1',
  points integer DEFAULT 3,
  position integer DEFAULT 0,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tools (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  stages jsonb DEFAULT '[]'::jsonb,
  url text DEFAULT '',
  color text DEFAULT '6366f1',
  description text DEFAULT '',
  free_tier text DEFAULT '',
  sort integer DEFAULT 0,
  enabled boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS stages (
  key text PRIMARY KEY,
  name text NOT NULL,
  tagline text DEFAULT '',
  icon text DEFAULT 'Compass',
  color text DEFAULT '#6366f1',
  position integer DEFAULT 0,
  enabled boolean DEFAULT true,
  checklist jsonb DEFAULT '[]'::jsonb,
  gate jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS tool_stacks (
  project_id text NOT NULL,
  tool_id text NOT NULL,
  status text DEFAULT 'planned',
  our_url text DEFAULT '',
  note text DEFAULT '',
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, tool_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
`;

let schemaReady: Promise<void> | null = null;
let schemaEpoch = -1;

/** Forget the memoised schema so the next ensureSchema() re-creates tables. */
export function resetSchema(): void {
  schemaReady = null;
  schemaEpoch = -1;
}

export async function ensureSchema(): Promise<void> {
  const epoch = seedEpoch();
  if (schemaEpoch !== epoch) {
    schemaReady = null;
    schemaEpoch = epoch;
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await exec(SCHEMA);
      } catch (err) {
        // Two cold serverless instances can create the same objects at the same
        // time; Postgres reports that as duplicate_object / unique_violation on
        // the system catalogue. Re-running is safe because every statement is
        // IF NOT EXISTS.
        const code = (err as { code?: string }).code;
        if (code !== '42P07' && code !== '42710' && code !== '23505') throw err;
        console.warn('[db] schema created concurrently by another instance — verifying');
        await new Promise((r) => setTimeout(r, 250));
        await exec(SCHEMA);
      }
      // Tables added after the first deploy: keep existing databases current.
      await migrate();
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * Idempotent, additive migrations. Every statement must be safe to run on a
 * database that already has the table.
 */
async function migrate(): Promise<void> {
  const statements = [
    'ALTER TABLE projects ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT \'{}\'::jsonb',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now()',
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points integer DEFAULT 3',
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position integer DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date date',
    'ALTER TABLE stages ADD COLUMN IF NOT EXISTS gate jsonb DEFAULT \'{}\'::jsonb',
    'ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS updated_by text',
  ];
  for (const statement of statements) {
    try {
      await exec(statement);
    } catch (err) {
      console.warn('[db] migration skipped:', statement.slice(0, 60), (err as Error).message);
    }
  }
}

export function newId(prefix = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
