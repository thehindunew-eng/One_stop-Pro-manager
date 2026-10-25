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

const g = globalThis as unknown as { __ospmDriver?: Promise<Driver> };

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    return {
      kind: 'neon',
      async query(sql, params = []) {
        const res = await pool.query(sql, params as any[]);
        return { rows: res.rows as Record<string, any>[] };
      },
      async exec(sql) {
        await pool.query(sql);
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
  fs.mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(dir);
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  return {
    kind: 'pglite',
    query(sql, params = []) {
      return serial(async () => {
        const res = await db.query(sql, params as any[]);
        return { rows: res.rows as Record<string, any>[] };
      });
    },
    exec(sql) {
      return serial(async () => {
        await db.exec(sql);
      });
    },
  };
}

async function driver(): Promise<Driver> {
  if (!g.__ospmDriver) g.__ospmDriver = createDriver();
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
  checklist jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
`;

let schemaReady: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await exec(SCHEMA);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export function newId(prefix = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
