import { asJson, ensureSchema, newId, sql } from './db';
import { ARTIFACT_BLUEPRINTS, STAGE_SEED, TOOL_SEED } from './defaults';
import { buildProblem, extractSignals } from './intel';
import { generateDoc } from './generate';
import { DEMO_OWNER_EMAIL } from './auth';
import type {
  Artifact,
  Member,
  Message,
  MessageKind,
  ProblemStatement,
  Project,
  Role,
  Signal,
  Stage,
  StageKey,
  Task,
  Tool,
  User,
  WorkspaceState,
} from './types';

export const DEMO_CODE = process.env.DEMO_PROJECT_CODE || 'studio';

const g = globalThis as unknown as { __ospmBase?: Promise<void> };

/* ------------------------------------------------------------------ */
/* seeding                                                             */
/* ------------------------------------------------------------------ */

export async function ensureBase(): Promise<void> {
  if (!g.__ospmBase) {
    g.__ospmBase = (async () => {
      await ensureSchema();

      for (const s of STAGE_SEED) {
        await sql(
          `INSERT INTO stages (key, name, tagline, icon, color, position, enabled, checklist)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7::jsonb)
           ON CONFLICT (key) DO NOTHING`,
          [s.key, s.name, s.tagline, s.icon, s.color, s.position, asJson(s.checklist)],
        );
      }

      const [{ count }] = await sql<{ count: string }>('SELECT count(*)::text AS count FROM tools');
      if (Number(count) === 0) {
        let i = 0;
        for (const t of TOOL_SEED) {
          await sql(
            `INSERT INTO tools (id, slug, name, category, stages, url, color, description, free_tier, sort, enabled)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true)`,
            [newId('tool'), t.slug, t.name, t.category, asJson(t.stages), t.url, t.color, t.description, t.free_tier, i++],
          );
        }
      }

      await seedDemoProject();
    })().catch((err) => {
      g.__ospmBase = undefined;
      throw err;
    });
  }
  return g.__ospmBase;
}

async function upsertUser(input: {
  name: string;
  email?: string | null;
  role?: Role;
  isAdmin?: boolean;
}): Promise<User> {
  const existing = input.email
    ? await sql<User>('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [input.email])
    : [];
  if (existing[0]) return existing[0];
  const byName = await sql<User>('SELECT * FROM users WHERE lower(name) = lower($1) LIMIT 1', [input.name]);
  if (byName[0] && !input.email) return byName[0];
  const id = newId('usr');
  const rows = await sql<User>(
    `INSERT INTO users (id, name, email, role, is_admin) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, input.name, input.email ?? null, input.role ?? 'member', input.isAdmin ?? false],
  );
  return rows[0];
}

const DEMO_TRANSCRIPT: { author: string; role: Role; kind: MessageKind; content: string }[] = [
  {
    author: 'Amar Tripathi',
    role: 'pm',
    kind: 'chat',
    content:
      "Let's be honest about why this keeps failing. We run a 60 minute product kickoff every Monday. By Wednesday nobody agrees what we actually decided. Everything lives across Notion, Jira, Figma, Slack and a random spreadsheet — and the one thing that never gets written down is the problem we're solving.",
  },
  {
    author: 'Rohan Mehta',
    role: 'eng',
    kind: 'chat',
    content:
      'From the engineering side the pain is that scope arrives as vibes. I get a ticket that says "build onboarding" with no problem statement, then two days later someone says that is not what we meant. We rework roughly 30% of every sprint and half of it is because the requirement was never a real problem.',
  },
  {
    author: 'Priya Nair',
    role: 'design',
    kind: 'chat',
    content:
      "Same on design. I open 4 tools before I draw a single screen, and the meeting notes never turn into anything I can design against. I'm guessing at the user, guessing at success, and then redoing the flows when the PM changes their mind.",
  },
  {
    author: 'Kabir Shah',
    role: 'growth',
    kind: 'chat',
    content:
      "And the launch story is written the night before launch. Because nobody agreed on the problem early, the copy is generic and the positioning changes three times. If the problem statement existed on day one, my job would be 10x easier.",
  },
  {
    author: 'Amar Tripathi',
    role: 'pm',
    kind: 'idea',
    content:
      'What if the meeting itself produced the problem statement? An IDE for product work — a room where the conversation is understood, the real problem question is extracted at the end, and then every stage from ideation to deployment has its tools and templates already loaded, side by side.',
  },
  {
    author: 'Sana Iqbal',
    role: 'qa',
    kind: 'chat',
    content:
      'Then testing becomes possible too. Right now acceptance criteria are invented at the end, so we test against nothing. If the problem and the success metric exist on day one, I can write the test plan before the code is even written.',
  },
  {
    author: 'Rohan Mehta',
    role: 'eng',
    kind: 'chat',
    content:
      "One constraint: we should not rebuild video. Use Google Meet or Zoom links. The value is the intelligence on top of the conversation, not another call app. And it has to run on free platforms — Vercel for hosting, Neon for Postgres, a free LLM tier for the agent.",
  },
  {
    author: 'Priya Nair',
    role: 'design',
    kind: 'decision',
    content:
      'Decision: every stage generates starter artifacts so nobody begins from a blank page — PRD, personas, data model, test plan, launch kit. And the whole thing has to feel like a workshop: all tool icons visible side by side, not a boring form.',
  },
  {
    author: 'Amar Tripathi',
    role: 'pm',
    kind: 'decision',
    content:
      "Let's lock v0.1: one room, the team joins by link, the copilot extracts and we approve one problem statement in the first meeting, then nine stages with the free tools and generated docs. I need to edit tools and stages myself without anyone deploying code — that is non-negotiable.",
  },
  {
    author: 'Kabir Shah',
    role: 'growth',
    kind: 'chat',
    content:
      'Idea for launch: show the before/after — a messy meeting on the left, an approved problem statement plus a deployed plan on the right. That is the demo. Product Hunt, LinkedIn build-in-public, and a Substack post about the nine stages.',
  },
  {
    author: 'Sana Iqbal',
    role: 'qa',
    kind: 'chat',
    content:
      'Concern to mitigate: AI statements could be generic. Always show confidence and the evidence quotes, and require a human to approve before anything downstream is generated. Otherwise we are just another summariser.',
  },
];

async function seedDemoProject(): Promise<void> {
  const existing = await sql<Project>('SELECT * FROM projects WHERE code = $1', [DEMO_CODE]);
  if (existing[0]) return;

  const owner = await upsertUser({
    name: process.env.OWNER_NAME || 'Amar Tripathi',
    email: process.env.OWNER_EMAIL || DEMO_OWNER_EMAIL,
    role: 'pm',
    isAdmin: true,
  });

  const id = newId('prj');
  const project = (
    await sql<Project>(
      `INSERT INTO projects (id, code, name, tagline, owner_id, stage_key, status, settings)
       VALUES ($1,$2,$3,$4,$5,'discover','discovering',$6::jsonb) RETURNING *`,
      [
        id,
        DEMO_CODE,
        'One Stop Product Studio',
        'From a Monday meeting to a launched product — in one room.',
        owner.id,
        asJson({ showDemo: true, allowMemberEdit: true }),
      ],
    )
  )[0];

  const teammates: { name: string; role: Role; email: string; admin?: boolean }[] = [
    { name: 'Priya Nair', role: 'design', email: 'priya@onestop.pro' },
    { name: 'Rohan Mehta', role: 'eng', email: 'rohan@onestop.pro' },
    { name: 'Sana Iqbal', role: 'qa', email: 'sana@onestop.pro' },
    { name: 'Kabir Shah', role: 'growth', email: 'kabir@onestop.pro' },
  ];
  await sql(`INSERT INTO members (project_id, user_id, role) VALUES ($1,$2,'pm') ON CONFLICT DO NOTHING`, [
    project.id,
    owner.id,
  ]);
  const memberUsers: User[] = [owner];
  for (const t of teammates) {
    const u = await upsertUser({ name: t.name, email: t.email, role: t.role, isAdmin: false });
    memberUsers.push(u);
    await sql(`INSERT INTO members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
      project.id,
      u.id,
      t.role,
    ]);
  }

  const contactByRole = new Map<Role, User>();
  for (const u of memberUsers) contactByRole.set(u.role, u);

  const base = Date.now() - 1000 * 60 * 60 * 20;
  const messages: Message[] = [];
  let i = 0;
  for (const m of DEMO_TRANSCRIPT) {
    const author = memberUsers.find((u) => u.name === m.author) ?? owner;
    const row = (
      await sql<Message>(
        `INSERT INTO messages (id, project_id, user_id, author, role, kind, content, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, to_timestamp($8 / 1000.0)) RETURNING *`,
        [newId('msg'), project.id, author.id, author.name, m.role, m.kind, m.content, base + i * 1000 * 60 * 3],
      )
    )[0];
    messages.push(row);
    i++;
  }

  const signals = extractSignals(messages);
  for (const s of signals) {
    await sql(
      `INSERT INTO signals (id, project_id, type, label, detail, score, status, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [newId('sig'), project.id, s.type, s.label, s.detail, s.score, 'open', asJson(s.evidence)],
    );
  }

  await ensureArtifacts(project.id);
  const problem = { ...buildProblem(messages), status: 'draft' as const };
  await sql('UPDATE projects SET problem = $2::jsonb WHERE id = $1', [project.id, asJson(problem)]);

  // Generate full starter docs for the demo project so the workspace is alive.
  const tools = await listTools();
  const members = memberUsers.map((u) => ({ name: u.name, role: u.role }));
  for (const [stageKey, docs] of Object.entries(ARTIFACT_BLUEPRINTS) as [StageKey, typeof ARTIFACT_BLUEPRINTS[StageKey]][]) {
    const stage = STAGE_SEED.find((s) => s.key === stageKey)!;
    for (const doc of docs) {
      const content = generateDoc(doc.kind, doc.title, {
        project,
        problem,
        members,
        tools,
        stageName: stage.name,
        stageKey,
      } as any);
      await sql('UPDATE artifacts SET content = $3, status = $4 WHERE project_id = $1 AND kind = $2', [
        project.id,
        doc.kind,
        content,
        doc.kind === 'problem_canvas' || doc.kind === 'prd' ? 'ready' : 'draft',
      ]);
    }
  }

  await seedStageTasks(project.id, contactByRole);

  await sql(
    `INSERT INTO messages (id, project_id, user_id, author, role, kind, content, meta)
     VALUES ($1,$2,$3,$4,$5,'system',$6,$7::jsonb)`,
    [
      newId('msg'),
      project.id,
      null,
      'Prime',
      'assistant',
      `I read the kickoff. ${signals.filter((s) => s.type === 'pain').length} pains, ${signals.filter((s) => s.type === 'evidence').length} evidence points and ${signals.filter((s) => s.type === 'decision').length} decisions captured. The draft problem statement is ready for approval in the Discover stage.`,
      asJson({ seeded: true }),
    ],
  );
}


/** Every stage checklist item becomes a board task, so a new room is never empty. */
async function seedStageTasks(projectId: string, contacts?: Map<Role, User>): Promise<void> {
  const ownerFor = (role: Role) => contacts?.get(role)?.name ?? null;
  const ownerByStage: Record<string, string | null> = {
    discover: ownerFor('pm'),
    define: ownerFor('pm'),
    ideate: ownerFor('design'),
    design: ownerFor('design'),
    architect: ownerFor('eng'),
    build: ownerFor('eng'),
    test: ownerFor('qa'),
    launch: ownerFor('growth'),
    grow: ownerFor('growth'),
  };
  let pos = (await sql<{ max: number | null }>('SELECT max(position) AS max FROM tasks WHERE project_id = $1', [projectId]))[0]?.max ?? 0;
  for (const stage of STAGE_SEED) {
    for (const [idx, item] of stage.checklist.entries()) {
      const done = stage.key === 'discover' && idx === 0 && contacts;
      const doing = stage.key === 'discover' && idx === 1 && contacts;
      await sql(
        `INSERT INTO tasks (id, project_id, title, detail, stage_key, status, owner, priority, points, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          newId('tsk'),
          projectId,
          item,
          `Checklist item from the ${stage.name} stage.`,
          stage.key,
          done ? 'done' : doing ? 'doing' : 'todo',
          ownerByStage[stage.key] ?? null,
          idx === 0 ? 'P0' : idx < 3 ? 'P1' : 'P2',
          [2, 3, 5][idx % 3],
          pos++,
        ],
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* projects                                                            */
/* ------------------------------------------------------------------ */

export async function createProject(input: {
  name: string;
  tagline?: string;
  ownerId: string;
  code?: string;
}): Promise<Project> {
  await ensureBase();
  let code =
    (input.code || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'room';
  const clash = await sql<Project>('SELECT id FROM projects WHERE code = $1', [code]);
  if (clash[0]) code = `${code}-${Math.random().toString(36).slice(2, 5)}`;
  const project = (
    await sql<Project>(
      `INSERT INTO projects (id, code, name, tagline, owner_id, stage_key, status, settings)
       VALUES ($1,$2,$3,$4,$5,'discover','discovering',$6::jsonb) RETURNING *`,
      [newId('prj'), code, input.name, input.tagline ?? null, input.ownerId, asJson({ allowMemberEdit: true })],
    )
  )[0];
  await sql(`INSERT INTO members (project_id, user_id, role) VALUES ($1,$2,'pm') ON CONFLICT DO NOTHING`, [
    project.id,
    input.ownerId,
  ]);
  await ensureArtifacts(project.id);
  await seedStageTasks(project.id);
  return project;
}

export async function findProject(code: string): Promise<Project | null> {
  const rows = await sql<Project>('SELECT * FROM projects WHERE lower(code) = lower($1) LIMIT 1', [code]);
  return rows[0] ?? null;
}

export async function listProjectsForUser(userId: string): Promise<Project[]> {
  return sql<Project>(
    `SELECT p.* FROM projects p JOIN members m ON m.project_id = p.id
     WHERE m.user_id = $1 ORDER BY p.updated_at DESC`,
    [userId],
  );
}

export async function ensureArtifacts(projectId: string): Promise<void> {
  for (const [stageKey, docs] of Object.entries(ARTIFACT_BLUEPRINTS) as [StageKey, typeof ARTIFACT_BLUEPRINTS[StageKey]][]) {
    for (const doc of docs) {
      await sql(
        `INSERT INTO artifacts (id, project_id, stage_key, kind, title, content, status)
         VALUES ($1,$2,$3,$4,$5,'','draft')
         ON CONFLICT (project_id, kind) DO NOTHING`,
        [newId('art'), projectId, stageKey, doc.kind, doc.title],
      );
    }
  }
}

export async function joinProject(projectId: string, userId: string, role: Role): Promise<void> {
  await sql(
    `INSERT INTO members (project_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [projectId, userId, role],
  );
}

export async function touchMember(projectId: string, userId: string): Promise<void> {
  await sql('UPDATE members SET last_seen = now() WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; tagline?: string; stage_key?: StageKey; status?: string; settings?: Record<string, unknown>; problem?: ProblemStatement | null },
): Promise<Project> {
  const current = (await sql<Project>('SELECT * FROM projects WHERE id = $1', [projectId]))[0];
  if (!current) throw new Error('project not found');
  const next = {
    name: patch.name ?? current.name,
    tagline: patch.tagline ?? current.tagline,
    stage_key: patch.stage_key ?? current.stage_key,
    status: patch.status ?? current.status,
    settings: patch.settings ? { ...(current.settings || {}), ...patch.settings } : current.settings,
    problem: patch.problem === undefined ? current.problem : patch.problem,
  };
  const rows = await sql<Project>(
    `UPDATE projects SET name=$2, tagline=$3, stage_key=$4, status=$5, settings=$6::jsonb, problem=$7::jsonb, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [projectId, next.name, next.tagline, next.stage_key, next.status, asJson(next.settings), asJson(next.problem)],
  );
  return rows[0];
}

export async function recordProblem(projectId: string, problem: ProblemStatement): Promise<ProblemStatement> {
  const current = (await sql<Project>('SELECT * FROM projects WHERE id = $1', [projectId]))[0];
  const prev = current?.problem as ProblemStatement | null;
  const history = [...(prev?.history ?? [])];
  if (prev?.statement && prev.statement !== problem.statement) {
    history.unshift({ statement: prev.statement, at: prev.updatedAt, by: prev.engine });
  }
  const stored: ProblemStatement = { ...problem, history: history.slice(0, 12), updatedAt: new Date().toISOString() };
  await sql('UPDATE projects SET problem = $2::jsonb, updated_at = now() WHERE id = $1', [projectId, asJson(stored)]);
  return stored;
}

/* ------------------------------------------------------------------ */
/* workspace                                                           */
/* ------------------------------------------------------------------ */

export async function listMembers(projectId: string): Promise<Member[]> {
  return sql<Member>(
    `SELECT m.project_id, m.user_id, m.role, m.joined_at, m.last_seen, u.name, u.email, u.is_admin
     FROM members m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1 ORDER BY m.joined_at ASC`,
    [projectId],
  );
}

export async function listMessages(projectId: string, limit = 250): Promise<Message[]> {
  const rows = await sql<Message>(
    `SELECT * FROM messages WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [projectId, limit],
  );
  return rows.reverse();
}

export async function addMessage(input: {
  projectId: string;
  userId: string | null;
  author: string;
  role: string;
  kind: MessageKind;
  content: string;
  meta?: Record<string, unknown>;
}): Promise<Message> {
  const rows = await sql<Message>(
    `INSERT INTO messages (id, project_id, user_id, author, role, kind, content, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
    [newId('msg'), input.projectId, input.userId, input.author, input.role, input.kind, input.content.slice(0, 8000), asJson(input.meta ?? {})],
  );
  await sql('UPDATE projects SET updated_at = now() WHERE id = $1', [input.projectId]);
  return rows[0];
}

export async function listSignals(projectId: string): Promise<Signal[]> {
  return sql<Signal>(
    `SELECT * FROM signals WHERE project_id = $1 ORDER BY score DESC, created_at DESC LIMIT 200`,
    [projectId],
  );
}

export async function replaceSignals(
  projectId: string,
  signals: Omit<Signal, 'id' | 'project_id' | 'created_at'>[],
  mode: 'append' | 'replace' = 'append',
): Promise<void> {
  if (mode === 'replace') await sql('DELETE FROM signals WHERE project_id = $1', [projectId]);
  for (const s of signals) {
    // do not duplicate an identical open signal
    const dup = await sql<{ id: string }>(
      'SELECT id FROM signals WHERE project_id = $1 AND type = $2 AND lower(label) = lower($3) LIMIT 1',
      [projectId, s.type, s.label],
    );
    if (dup[0]) {
      await sql('UPDATE signals SET score = GREATEST(score, $2), evidence = $3::jsonb WHERE id = $1', [
        dup[0].id,
        s.score,
        asJson(s.evidence),
      ]);
      continue;
    }
    await sql(
      `INSERT INTO signals (id, project_id, type, label, detail, score, status, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [newId('sig'), projectId, s.type, s.label, s.detail, s.score, s.status ?? 'open', asJson(s.evidence)],
    );
  }
}

export async function setSignalStatus(projectId: string, id: string, status: string): Promise<void> {
  await sql('UPDATE signals SET status = $3 WHERE project_id = $1 AND id = $2', [projectId, id, status]);
}

export async function listArtifacts(projectId: string): Promise<Artifact[]> {
  return sql<Artifact>(
    `SELECT * FROM artifacts WHERE project_id = $1 ORDER BY updated_at DESC`,
    [projectId],
  );
}

export async function getArtifact(projectId: string, id: string): Promise<Artifact | null> {
  const rows = await sql<Artifact>('SELECT * FROM artifacts WHERE project_id = $1 AND id = $2', [projectId, id]);
  return rows[0] ?? null;
}

export async function upsertArtifactContent(
  projectId: string,
  kind: string,
  content: string,
  status?: string,
  updatedBy?: string | null,
): Promise<void> {
  await sql(
    `UPDATE artifacts SET content = $3, status = COALESCE($4, status), updated_by = $5, updated_at = now()
     WHERE project_id = $1 AND kind = $2`,
    [projectId, kind, content, status ?? null, updatedBy ?? null],
  );
}

export async function setArtifactStatus(projectId: string, id: string, status: string): Promise<void> {
  await sql('UPDATE artifacts SET status = $3, updated_at = now() WHERE project_id = $1 AND id = $2', [
    projectId,
    id,
    status,
  ]);
}

export async function listTasks(projectId: string): Promise<Task[]> {
  return sql<Task>('SELECT * FROM tasks WHERE project_id = $1 ORDER BY position ASC, created_at ASC', [projectId]);
}

export async function createTask(projectId: string, input: {
  title: string;
  detail?: string;
  stage_key?: StageKey;
  status?: string;
  owner?: string | null;
  priority?: string;
  points?: number;
}): Promise<Task> {
  const max = await sql<{ max: number | null }>('SELECT max(position) AS max FROM tasks WHERE project_id = $1', [projectId]);
  const rows = await sql<Task>(
    `INSERT INTO tasks (id, project_id, title, detail, stage_key, status, owner, priority, points, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      newId('tsk'),
      projectId,
      input.title.slice(0, 300),
      input.detail ?? '',
      input.stage_key ?? 'build',
      input.status ?? 'todo',
      input.owner ?? null,
      input.priority ?? 'P1',
      input.points ?? 3,
      (max[0]?.max ?? 0) + 1,
    ],
  );
  return rows[0];
}

export async function updateTask(projectId: string, id: string, patch: Partial<Task>): Promise<void> {
  const current = (await sql<Task>('SELECT * FROM tasks WHERE project_id = $1 AND id = $2', [projectId, id]))[0];
  if (!current) return;
  await sql(
    `UPDATE tasks SET title=$3, detail=$4, status=$5, owner=$6, priority=$7, points=$8, position=$9, stage_key=$10
     WHERE project_id=$1 AND id=$2`,
    [
      projectId,
      id,
      patch.title ?? current.title,
      patch.detail ?? current.detail,
      patch.status ?? current.status,
      patch.owner === undefined ? current.owner : patch.owner,
      patch.priority ?? current.priority,
      patch.points ?? current.points,
      patch.position ?? current.position,
      patch.stage_key ?? current.stage_key,
    ],
  );
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  await sql('DELETE FROM tasks WHERE project_id = $1 AND id = $2', [projectId, id]);
}

export async function listTools(onlyEnabled = true): Promise<Tool[]> {
  return sql<Tool>(
    `SELECT * FROM tools ${onlyEnabled ? 'WHERE enabled = true' : ''} ORDER BY sort ASC, name ASC`,
  );
}

export async function saveTool(input: Partial<Tool> & { name: string; category: string }): Promise<Tool> {
  if (input.id) {
    const rows = await sql<Tool>(
      `UPDATE tools SET name=$2, category=$3, stages=$4::jsonb, url=$5, color=$6, description=$7, free_tier=$8, enabled=$9
       WHERE id=$1 RETURNING *`,
      [
        input.id,
        input.name,
        input.category,
        asJson(input.stages ?? []),
        input.url ?? '',
        input.color ?? '6366f1',
        input.description ?? '',
        input.free_tier ?? '',
        input.enabled ?? true,
      ],
    );
    return rows[0];
  }
  const rows = await sql<Tool>(
    `INSERT INTO tools (id, slug, name, category, stages, url, color, description, free_tier, sort, enabled)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,(SELECT COALESCE(max(sort),0)+1 FROM tools),true) RETURNING *`,
    [
      newId('tool'),
      (input as any).slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      input.name,
      input.category,
      asJson(input.stages ?? []),
      input.url ?? '',
      input.color ?? '6366f1',
      input.description ?? '',
      input.free_tier ?? '',
    ],
  );
  return rows[0];
}

export async function deleteTool(id: string): Promise<void> {
  await sql('DELETE FROM tools WHERE id = $1', [id]);
}

export async function listStages(onlyEnabled = false): Promise<Stage[]> {
  return sql<Stage>(
    `SELECT * FROM stages ${onlyEnabled ? 'WHERE enabled = true' : ''} ORDER BY position ASC`,
  );
}

export async function saveStage(input: Partial<Stage> & { key: string; name: string }): Promise<Stage> {
  const rows = await sql<Stage>(
    `UPDATE stages SET name=$2, tagline=$3, icon=$4, color=$5, position=$6, enabled=$7, checklist=$8::jsonb
     WHERE key=$1 RETURNING *`,
    [
      input.key,
      input.name,
      input.tagline ?? '',
      input.icon ?? 'Compass',
      input.color ?? '#6366f1',
      input.position ?? 0,
      input.enabled ?? true,
      asJson(input.checklist ?? []),
    ],
  );
  return rows[0];
}

export async function addStage(input: { key: string; name: string; tagline?: string; icon?: string; color?: string }): Promise<Stage> {
  const max = await sql<{ max: number | null }>('SELECT max(position) AS max FROM stages');
  const rows = await sql<Stage>(
    `INSERT INTO stages (key, name, tagline, icon, color, position, enabled, checklist)
     VALUES ($1,$2,$3,$4,$5,$6,true,'[]'::jsonb) RETURNING *`,
    [input.key, input.name, input.tagline ?? '', input.icon ?? 'Compass', input.color ?? '#6366f1', (max[0]?.max ?? 0) + 1],
  );
  return rows[0];
}

export async function getWorkspace(code: string, user: User): Promise<WorkspaceState | null> {
  await ensureBase();
  const project = await findProject(code);
  if (!project) return null;
  const isMember = await sql<{ user_id: string }>(
    'SELECT user_id FROM members WHERE project_id = $1 AND user_id = $2',
    [project.id, user.id],
  );
  if (!isMember[0]) await joinProject(project.id, user.id, user.role);
  await touchMember(project.id, user.id);

  const { accessFor } = await import('./auth');
  const { engineLabel } = await import('./ai');

  const [members, messages, signals, artifacts, tasks, tools, stages] = await Promise.all([
    listMembers(project.id),
    listMessages(project.id),
    listSignals(project.id),
    listArtifacts(project.id),
    listTasks(project.id),
    listTools(true),
    listStages(true),
  ]);

  return {
    project,
    members,
    messages,
    signals,
    artifacts,
    tasks,
    tools,
    stages,
    me: accessFor(user, project.owner_id),
    ai: engineLabel(),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await sql<User>('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function createUser(input: { name: string; email?: string | null; role?: Role; isAdmin?: boolean }): Promise<User> {
  return upsertUser(input);
}
