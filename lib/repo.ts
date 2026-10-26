import { asJson, ensureSchema, newId, resetSchema, seedEpoch, sql } from './db';
import { ARTIFACT_BLUEPRINTS, ROOM_CODES, STAGE_SEED, TOOL_SEED } from './defaults';
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
  TaskNote,
  Tool,
  ToolStack,
  User,
  WorkspaceState,
} from './types';

export const DEMO_CODE = ROOM_CODES.demo;
export const PROD_CODE = ROOM_CODES.live;

const g = globalThis as unknown as { __ospmBase?: Promise<void> };

/* ------------------------------------------------------------------ */
/* seeding                                                             */
/* ------------------------------------------------------------------ */

let baseEpoch = -1;

export async function ensureBase(force = false): Promise<void> {
  const epoch = seedEpoch();
  // A rebuilt database (fresh Neon, recovered embedded Postgres) must be re-seeded.
  if (force || epoch !== baseEpoch) {
    g.__ospmBase = undefined;
    if (force) resetSchema();
  }
  if (!g.__ospmBase) {
    baseEpoch = epoch;
    g.__ospmBase = (async () => {
      await ensureSchema();

      const safeCount = async (table: string): Promise<number> => {
        try {
          const rows = await sql<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
          return Number(rows?.[0]?.count ?? 0);
        } catch {
          return -1; // table missing or database mid-recovery
        }
      };

      for (const s of STAGE_SEED) {
        await sql(
          `INSERT INTO stages (key, name, tagline, icon, color, position, enabled, checklist)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7::jsonb)
           ON CONFLICT (key) DO NOTHING`,
          [s.key, s.name, s.tagline, s.icon, s.color, s.position, asJson(s.checklist)],
        );
      }

      if ((await safeCount('tools')) === 0) {
        // A single atomic insert decides which instance seeds the catalogue.
        const claim = await sql<{ key: string }>(
          `INSERT INTO app_settings (key, value) VALUES ('tools_seeded', 'true'::jsonb)
           ON CONFLICT (key) DO NOTHING RETURNING key`,
        );
        if (claim[0]) {
          let i = 0;
          for (const t of TOOL_SEED) {
            await sql(
              `INSERT INTO tools (id, slug, name, category, stages, url, color, description, free_tier, sort, enabled)
               VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true)`,
              [newId('tool'), t.slug, t.name, t.category, asJson(t.stages), t.url, t.color, t.description, t.free_tier, i++],
            );
          }
        }
      }

      // Only seed when the database has no rooms at all. Re-running is safe but
      // pointless, and this check is what lets a wiped/fresh database self-heal
      // without a restart.
      const rooms = await safeCount('projects');
      if (rooms <= 0) {
        try {
          await seedDemoProject();
          await seedLiveProject();
        } catch (err) {
          console.error('[repo] seeding failed:', (err as Error).message);
        }
      }

      // Keep existing rooms current when the document blueprint grows. The marker
      // means a warm deploy does no work; a new blueprint version tops every room
      // up once, and inserts are ON CONFLICT DO NOTHING so nothing is overwritten.
      try {
        const version = `${Object.values(ARTIFACT_BLUEPRINTS).reduce((n, list) => n + list.length, 0)}-fill`;
        const marker = await sql<{ value: number }>("SELECT value FROM app_settings WHERE key = 'artifacts_version'");
        if (String(marker[0]?.value ?? '') !== version) {
          const projects = await sql<{ id: string }>('SELECT id FROM projects');
          for (const p of projects) {
            await ensureArtifacts(p.id);
            await fillEmptyArtifacts(p.id);
          }
          await sql(
            `INSERT INTO app_settings (key, value) VALUES ('artifacts_version', $1::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [asJson(version)],
          );
        }
      } catch (err) {
        console.warn('[repo] document top-up skipped:', (err as Error).message);
      }
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

  // ON CONFLICT keeps two cold serverless instances from seeding twice.
  const demoRows = await sql<Project>(
    `INSERT INTO projects (id, code, name, tagline, owner_id, stage_key, status, settings)
     VALUES ($1,$2,$3,$4,$5,'discover','discovering',$6::jsonb)
     ON CONFLICT (code) DO NOTHING RETURNING *`,
    [
      newId('prj'),
      DEMO_CODE,
      'One Stop Product Studio',
      'From a Monday meeting to a launched product — in one room.',
      owner.id,
      asJson({ showDemo: true, allowMemberEdit: true }),
    ],
  );
  if (!demoRows[0]) return; // the other instance is seeding it right now
  const project = demoRows[0];

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

  await seedStageTasks(
    project.id,
    contactByRole,
    undefined,
    (stage, idx, status) => {
      // Closed stages are dated in the past, the live stage this week, later
      // stages further out — so the board reads like a plan, not a template.
      const order = STAGE_SEED.findIndex((x) => x.key === stage);
      if (status === 'done') return dayOffset(-21 + order * 2 + idx);
      if (stage === 'discover') return dayOffset(1 + idx);
      return dayOffset(2 + order * 3 + idx);
    },
  );

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


/** YYYY-MM-DD, `offset` days from today. Used to seed a believable board. */
function dayOffset(offset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* the live workspace — the real product, real decisions               */
/* ------------------------------------------------------------------ */

const LIVE_BRIEF: { kind: MessageKind; content: string }[] = [
  {
    kind: 'chat',
    content:
      'This is the live room for One Stop Pro Manager itself. The product exists for one reason: a product manager should be able to ideate a problem statement and take it all the way to launch without leaving the meeting.',
  },
  {
    kind: 'chat',
    content:
      'The process we are replacing: a meeting produces notes, the notes produce tickets, and the problem everyone agreed on has disappeared by mid-sprint. The meeting itself has to become the input, not a summary of the input.',
  },
  {
    kind: 'chat',
    content:
      'The copilot has to understand what the team is actually saying and end the meeting with the real problem question — users, pains, evidence, unknowns and a confidence score. A human approves it before any solution work starts.',
  },
  {
    kind: 'decision',
    content:
      'Decision: nine stages from Discover to Grow. Each one ships with its documents, checklist, board tasks and free tools, so nobody ever starts from a blank page.',
  },
  {
    kind: 'decision',
    content:
      'Decision: free platforms only for v0.1 — Vercel for hosting, Neon for Postgres, GitHub for code, one LLM API with a free tier. Zero fixed monthly cost until real teams are using it.',
  },
  {
    kind: 'decision',
    content:
      'Decision: I keep full edit control. Stages, checklists, tool tiles, copy and team roles must be editable inside the platform, with no code change and no redeploy.',
  },
  {
    kind: 'chat',
    content:
      'The team experience has to be one link, role-aware seats, and everyone looking at the same problem, plan and next action. During the meeting the room should feel alive, not like a form.',
  },
  {
    kind: 'decision',
    content:
      'Decision: the owner signs in with a passcode, members join by link. Only the owner and platform admins can change the platform itself.',
  },
  {
    kind: 'note',
    content:
      'Non-goals for v0.1: no built-in video (Meet and Zoom links are enough), no native app, no billing until ten teams have completed a full ideate-to-launch cycle.',
  },
  {
    kind: 'chat',
    content:
      'Launch bar: a new team can go from an empty workspace to an approved problem statement and a deployed plan in one sitting, unassisted. If they cannot, v0.1 is not done.',
  },
];

/** The live room is seeded from the founder brief and reviewed by hand. */
function liveProblem(): ProblemStatement {
  return {
    title: 'Product teams lose the thread between the meeting and the launch',
    statement:
      'How might we help product teams keep one problem statement — with its evidence, scope and next action — alive from the first conversation all the way to a deployed, measured product?',
    summary:
      'A team runs a kickoff, leaves with notes, turns the notes into tickets, and by mid-sprint nobody agrees which problem they are solving. ' +
      'Every hand-off — meeting to doc to ticket to build to launch — strips context, so scope is re-litigated and launch copy is written the night before. ' +
      'The platform makes the meeting itself the source of truth: one approved problem statement that every stage, document and decision builds against. ' +
      'Confidence is high on the problem; the unproven part is whether a team will change its meeting habit to adopt it.',
    confidence: 88,
    status: 'approved',
    users: ['Product managers', 'Product teams (design, engineering, QA)', 'Founders shipping a v0.1 without a PM'],
    pains: [
      'The problem agreed in the meeting is never written down, so it gets re-decided every sprint.',
      'Work is duplicated across notes, docs, tickets and chat; nobody can trace a ticket back to a validated problem.',
      'Requirements arrive as vague scope and the rework lands on engineering.',
      'Launch copy and positioning are written last, without the original problem or its evidence.',
    ],
    evidence: [
      'Founder brief: the meeting produces notes, the notes produce tickets, and the agreed problem has disappeared by mid-sprint.',
      'Founder brief: launch messaging is written last, without the original problem or evidence attached.',
      'Constraint accepted up front: v0.1 must run on free tiers, so adoption — not infrastructure cost — is the risk.',
      'Four requirements locked in the brief: nine stages, free platforms, owner-editable without deploys, one link for the team.',
    ],
    assumptions: [
      'A team will accept one extra habit — approving the problem statement — if it removes rework later.',
      'A free-tier stack (Vercel, Neon, one LLM API) is enough for the first ten teams.',
      'Typed chat and pasted transcripts are sufficient input; built-in video is not needed for v0.1.',
      'The owner-editable console replaces the need for a developer on every change.',
    ],
    unknowns: [
      'What proof shows the pain costs a team more than switching costs?',
      'Which segment adopts first — solo founders or 4–10 person product teams?',
      'What is the smallest artifact set that brings a PM back to the room on day two?',
      'Which retention number justifies integrations (Slack, Jira) in v0.2?',
    ],
    successMetrics: [
      'A new team reaches an approved problem statement in its first session (target: 60% of rooms created)',
      'Room created to deployed plan in under 14 days for the first five teams',
      'Day-7 return rate of the room owner after the first meeting (target: 40%)',
      'Ten teams complete a full ideate-to-launch cycle before billing is built',
    ],
    solutionAngles: [
      'The meeting is the IDE: extraction, approval and every artifact live in one room.',
      'Nine stages pre-loaded with free tools, checklists and generated documents so nobody starts from a blank page.',
      'Owner-editable stages, tools and copy — the lifecycle changes without a deploy.',
      'Prime answers from the approved problem and always ends with one next action.',
    ],
    productType: 'Collaboration workspace / AI copilot',
    tags: ['meeting ide', 'problem statement', 'product lifecycle', 'free tier', 'vercel', 'neon', 'product teams', 'launch'],
    engine: 'founder brief · reviewed by the owner',
    updatedAt: new Date().toISOString(),
  };
}

async function seedLiveProject(): Promise<void> {
  const existing = await sql<Project>('SELECT * FROM projects WHERE code = $1', [PROD_CODE]);
  if (existing[0]) return;

  const owner = await upsertUser({
    name: process.env.OWNER_NAME || 'Amar Tripathi',
    email: process.env.OWNER_EMAIL || DEMO_OWNER_EMAIL,
    role: 'pm',
    isAdmin: true,
  });

  const productName = process.env.PRODUCT_NAME || 'One Stop Pro Manager';
  const liveRows = await sql<Project>(
    `INSERT INTO projects (id, code, name, tagline, owner_id, stage_key, status, settings)
     VALUES ($1,$2,$3,$4,$5,'launch','launching',$6::jsonb)
     ON CONFLICT (code) DO NOTHING RETURNING *`,
    [
      newId('prj'),
      PROD_CODE,
      `${productName} — launch room`,
      'Ship v0.1: meeting IDE → problem engine → nine-stage workspace → deployed on Vercel + Neon.',
      owner.id,
      asJson({ mode: 'live', demoCode: DEMO_CODE }),
    ],
  );
  if (!liveRows[0]) return; // the other instance is seeding it right now
  const project = liveRows[0];

  await sql(`INSERT INTO members (project_id, user_id, role) VALUES ($1,$2,'pm') ON CONFLICT DO NOTHING`, [
    project.id,
    owner.id,
  ]);

  const base = Date.now() - 1000 * 60 * 60 * 72;
  const messages: Message[] = [];
  let i = 0;
  for (const m of LIVE_BRIEF) {
    const row = (
      await sql<Message>(
        `INSERT INTO messages (id, project_id, user_id, author, role, kind, content, created_at)
         VALUES ($1,$2,$3,$4,'pm',$5,$6, to_timestamp($7 / 1000.0)) RETURNING *`,
        [newId('msg'), project.id, owner.id, owner.name, m.kind, m.content, base + i * 1000 * 60 * 37],
      )
    )[0];
    messages.push(row);
    i++;
  }

  const problem = liveProblem();
  await sql('UPDATE projects SET problem = $2::jsonb WHERE id = $1', [project.id, asJson(problem)]);

  const signals = extractSignals(messages).map((sig) => ({ ...sig, status: 'accepted' as const }));
  const manual: typeof signals = [
    {
      type: 'metric',
      label: 'A new team approves its problem statement in the first session — 60% of rooms created',
      detail: 'Activation metric for v0.1 from the founder brief.',
      score: 88,
      status: 'accepted',
      evidence: [],
    },
    {
      type: 'evidence',
      label: 'Brief: the agreed problem has disappeared by mid-sprint — the hand-off strips the context',
      detail: 'Founder brief, captured verbatim in this room.',
      score: 86,
      status: 'accepted',
      evidence: [],
    },
    {
      type: 'evidence',
      label: 'Brief: launch copy is written last, without the original problem or evidence attached',
      detail: 'Founder brief, captured verbatim in this room.',
      score: 80,
      status: 'accepted',
      evidence: [],
    },
    {
      type: 'blocker',
      label: 'Adoption is the real risk, not infrastructure — the free tier removes the cost excuse',
      detail: 'The team has to change one habit: approving the problem before building.',
      score: 82,
      status: 'accepted',
      evidence: [],
    },
  ];
  for (const sig of [...manual, ...signals]) {
    await sql(
      `INSERT INTO signals (id, project_id, type, label, detail, score, status, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [newId('sig'), project.id, sig.type, sig.label, sig.detail, sig.score, 'accepted', asJson(sig.evidence)],
    );
  }

  await ensureArtifacts(project.id);
  const tools = await listTools();
  const members = [{ name: owner.name, role: owner.role }];
  const closed = new Set<StageKey>(['discover', 'define', 'ideate', 'design', 'architect']);
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
        closed.has(stageKey) ? 'approved' : 'ready',
      ]);
    }
  }

  const solo = new Map<Role, User>([
    ['pm', owner],
    ['design', owner],
    ['eng', owner],
    ['qa', owner],
    ['growth', owner],
  ]);
  await seedStageTasks(project.id, solo, (stage, idx) => {
    if (closed.has(stage as StageKey)) return 'done';
    if (stage === 'build') return idx < 4 ? 'done' : idx === 4 ? 'doing' : 'todo';
    if (stage === 'test') return idx === 0 ? 'doing' : 'todo';
    return 'todo';
  }, (stage, idx, status) => {
    if (status === 'done') return dayOffset(-30 + STAGE_SEED.findIndex((x) => x.key === stage) * 2 + idx);
    if (stage === 'test') return dayOffset(1 + idx);
    if (stage === 'launch') return dayOffset(3 + idx);
    return dayOffset(1 + idx);
  });

  await sql(
    `INSERT INTO messages (id, project_id, user_id, author, role, kind, content, meta)
     VALUES ($1,$2,$3,$4,'assistant','system',$5,$6::jsonb)`,
    [
      newId('msg'),
      project.id,
      null,
      'Prime',
      'This is the live workspace for the product itself. The brief is captured, the problem statement is approved at 88% confidence, ' +
        'Discover through Architect are closed and Build is nearly done. The next real action is the launch checklist: production deploy on Vercel + Neon, analytics, then the announcement.',
      asJson({ seeded: true, live: true }),
    ],
  );
}

/** Every stage checklist item becomes a board task, so a new room is never empty. */
async function seedStageTasks(
  projectId: string,
  contacts?: Map<Role, User>,
  statusFor?: (stage: StageKey, index: number) => string,
  dueFor?: (stage: StageKey, index: number, status: string) => string | null,
): Promise<void> {
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
      const status = statusFor
        ? statusFor(stage.key, idx)
        : stage.key === 'discover' && idx === 0
          ? 'done'
          : stage.key === 'discover' && idx === 1
            ? 'doing'
            : 'todo';
      await sql(
        `INSERT INTO tasks (id, project_id, title, detail, stage_key, status, owner, priority, points, position, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          newId('tsk'),
          projectId,
          item,
          `Checklist item from the ${stage.name} stage.`,
          stage.key,
          status,
          ownerByStage[stage.key] ?? null,
          idx === 0 ? 'P0' : idx < 3 ? 'P1' : 'P2',
          [2, 3, 5][idx % 3],
          pos++,
          dueFor ? dueFor(stage.key, idx, status) : null,
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
  // A new product room has done nothing yet — do not fake progress.
  await seedStageTasks(project.id, undefined, () => 'todo');
  return project;
}

export async function findProject(code: string): Promise<Project | null> {
  const query = () => sql<Project>('SELECT * FROM projects WHERE lower(code) = lower($1) LIMIT 1', [code]);
  try {
    const rows = await query();
    if (rows[0]) return rows[0];
  } catch (err) {
    console.error('[repo] project lookup failed, retrying after schema check:', (err as Error).message);
  }
  // Miss: the room may not exist yet, or the database was initialised after boot.
  await ensureBase(true);
  const retry = await query();
  return retry[0] ?? null;
}

export async function listProjectsForUser(userId: string): Promise<Project[]> {
  return sql<Project>(
    `SELECT p.* FROM projects p JOIN members m ON m.project_id = p.id
     WHERE m.user_id = $1 ORDER BY p.updated_at DESC`,
    [userId],
  );
}


/**
 * When a new document type is added to the blueprint, rooms that are already
 * filled (the seeded demo and launch rooms) get the same starter text so the
 * demo never shows an empty card. Rooms the team created itself stay empty —
 * generating them is the point of the Documents tab.
 */
async function fillEmptyArtifacts(projectId: string): Promise<void> {
  const filled = await sql<{ count: string }>(
    `SELECT count(*)::text AS count FROM artifacts WHERE project_id = $1 AND content <> ''`,
    [projectId],
  );
  if (!Number(filled[0]?.count ?? 0)) return;

  const empties = await sql<Artifact>(
    `SELECT * FROM artifacts WHERE project_id = $1 AND (content IS NULL OR content = '')`,
    [projectId],
  );
  if (!empties.length) return;

  const project = (await sql<Project>('SELECT * FROM projects WHERE id = $1', [projectId]))[0];
  if (!project) return;
  const members = (await listMembers(projectId)).map((m) => ({ name: m.name, role: m.role }));
  const tools = await listTools();

  for (const a of empties) {
    const stage = STAGE_SEED.find((s) => s.key === a.stage_key);
    const content = generateDoc(a.kind, a.title, {
      project,
      problem: project.problem,
      members,
      tools,
      stageName: stage?.name ?? a.stage_key,
      stageKey: a.stage_key,
    } as any);
    if (!content) continue;
    await sql(
      `UPDATE artifacts SET content = $3, status = $4, updated_at = now() WHERE project_id = $1 AND kind = $2`,
      [projectId, a.kind, content, a.kind === 'problem_canvas' || a.kind === 'prd' ? 'ready' : 'draft'],
    );
  }
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

export async function deleteMessage(projectId: string, id: string): Promise<void> {
  await sql('DELETE FROM messages WHERE project_id = $1 AND id = $2', [projectId, id]);
}

export async function getMessage(projectId: string, id: string): Promise<Message | null> {
  const rows = await sql<Message>('SELECT * FROM messages WHERE project_id = $1 AND id = $2', [projectId, id]);
  return rows[0] ?? null;
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

/** Dates must reach the browser as plain YYYY-MM-DD, never a UTC timestamp. */
export function tidyTask<T extends { due_date?: unknown }>(t: Task | T): Task {
  const task = t as Task;
  const due = task.due_date as unknown;
  if (typeof due === 'string') task.due_date = due.slice(0, 10);
  else if (due instanceof Date) task.due_date = due.toISOString().slice(0, 10);
  return task;
}

export async function listTasks(projectId: string): Promise<Task[]> {
  const rows = await sql<Task>('SELECT * FROM tasks WHERE project_id = $1 ORDER BY position ASC, created_at ASC', [projectId]);
  return rows.map(tidyTask);
}

export async function createTask(projectId: string, input: {
  title: string;
  detail?: string;
  stage_key?: StageKey;
  status?: string;
  owner?: string | null;
  priority?: string;
  points?: number;
  due_date?: string | null;
}): Promise<Task> {
  const max = await sql<{ max: number | null }>('SELECT max(position) AS max FROM tasks WHERE project_id = $1', [projectId]);
  const rows = await sql<Task>(
    `INSERT INTO tasks (id, project_id, title, detail, stage_key, status, owner, priority, points, position, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
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
      input.due_date ?? null,
    ],
  );
  return tidyTask(rows[0]);
}

export async function updateTask(projectId: string, id: string, patch: Partial<Task>): Promise<void> {
  const current = (await sql<Task>('SELECT * FROM tasks WHERE project_id = $1 AND id = $2', [projectId, id]))[0];
  if (!current) return;
  await sql(
    `UPDATE tasks SET title=$3, detail=$4, status=$5, owner=$6, priority=$7, points=$8, position=$9, stage_key=$10,
       due_date=$11, repo=$12, branch=$13, pr_url=$14
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
      patch.due_date === undefined ? current.due_date : patch.due_date,
      patch.repo === undefined ? current.repo ?? null : patch.repo,
      patch.branch === undefined ? current.branch ?? null : patch.branch,
      patch.pr_url === undefined ? current.pr_url ?? null : patch.pr_url,
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

export async function listStacks(projectId: string): Promise<ToolStack[]> {
  return sql<ToolStack>('SELECT * FROM tool_stacks WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
}

export async function setStack(input: {
  projectId: string;
  toolId: string;
  status: string;
  ourUrl: string;
  note: string;
  updatedBy: string;
}): Promise<ToolStack> {
  const status = ['planned', 'trial', 'using', 'parked'].includes(input.status) ? input.status : 'planned';
  const rows = await sql<ToolStack>(
    `INSERT INTO tool_stacks (project_id, tool_id, status, our_url, note, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (project_id, tool_id)
     DO UPDATE SET status = $3, our_url = $4, note = $5, updated_by = $6, updated_at = now()
     RETURNING *`,
    [input.projectId, input.toolId, status, input.ourUrl.slice(0, 500), input.note.slice(0, 1000), input.updatedBy],
  );
  return rows[0];
}

export async function clearStack(projectId: string, toolId: string): Promise<void> {
  await sql('DELETE FROM tool_stacks WHERE project_id = $1 AND tool_id = $2', [projectId, toolId]);
}

export async function listStages(onlyEnabled = false): Promise<Stage[]> {
  return sql<Stage>(
    `SELECT * FROM stages ${onlyEnabled ? 'WHERE enabled = true' : ''} ORDER BY position ASC`,
  );
}

export async function saveStage(input: Partial<Stage> & { key: string; name: string }): Promise<Stage> {
  // COALESCE keeps whatever the caller did not send, so renaming a stage can
  // never silently erase its checklist or colour.
  const rows = await sql<Stage>(
    `UPDATE stages SET
       name = $2,
       tagline = COALESCE($3, tagline),
       icon = COALESCE($4, icon),
       color = COALESCE($5, color),
       position = COALESCE($6, position),
       enabled = COALESCE($7, enabled),
       checklist = COALESCE($8::jsonb, checklist),
       gate = COALESCE($9::jsonb, gate)
     WHERE key = $1 RETURNING *`,
    [
      input.key,
      input.name,
      input.tagline ?? null,
      input.icon ?? null,
      input.color ?? null,
      input.position ?? null,
      input.enabled ?? null,
      input.checklist ? asJson(input.checklist) : null,
      input.gate ? asJson(input.gate) : null,
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

  const [members, messages, signals, artifacts, tasks, tools, stacks, stages] = await Promise.all([
    listMembers(project.id),
    listMessages(project.id),
    listSignals(project.id),
    listArtifacts(project.id),
    listTasks(project.id),
    listTools(true),
    listStacks(project.id),
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
    stacks,
    stages,
    me: accessFor(user, project.owner_id),
    ai: await engineLabel(),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await sql<User>('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function createUser(input: { name: string; email?: string | null; role?: Role; isAdmin?: boolean }): Promise<User> {
  return upsertUser(input);
}

/* ------------------------------------------------------------------ */
/* credentials — encrypted, per member                                */
/* ------------------------------------------------------------------ */

export interface CredentialRow {
  id: string;
  project_id: string;
  user_id: string;
  provider: string;
  label: string;
  secret: string;
  meta: Record<string, unknown>;
  status: string;
  detail: string;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCredentialRows(projectId: string): Promise<CredentialRow[]> {
  return sql<CredentialRow>('SELECT * FROM credentials WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
}

export async function getCredential(
  projectId: string,
  userId: string,
  provider: string,
): Promise<CredentialRow | null> {
  const rows = await sql<CredentialRow>(
    'SELECT * FROM credentials WHERE project_id = $1 AND user_id = $2 AND provider = $3',
    [projectId, userId, provider],
  );
  return rows[0] ?? null;
}

export async function saveCredential(input: {
  projectId: string;
  userId: string;
  provider: string;
  label: string;
  sealed: string;
  meta?: Record<string, unknown>;
  status: string;
  detail: string;
}): Promise<void> {
  await sql(
    `INSERT INTO credentials (id, project_id, user_id, provider, label, secret, meta, status, detail, last_checked, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,now(),now())
     ON CONFLICT (project_id, user_id, provider)
     DO UPDATE SET label = $5, secret = $6, meta = $7::jsonb, status = $8, detail = $9, last_checked = now(), updated_at = now()`,
    [
      newId('cred'),
      input.projectId,
      input.userId,
      input.provider,
      input.label.slice(0, 80),
      input.sealed,
      asJson(input.meta ?? {}),
      input.status,
      input.detail.slice(0, 300),
    ],
  );
}

export async function deleteCredential(projectId: string, userId: string, provider: string): Promise<void> {
  await sql('DELETE FROM credentials WHERE project_id = $1 AND user_id = $2 AND provider = $3', [
    projectId,
    userId,
    provider,
  ]);
}

/* ------------------------------------------------------------------ */
/* task notes — the build log                                         */
/* ------------------------------------------------------------------ */

export async function listTaskNotes(projectId: string, limit = 200): Promise<TaskNote[]> {
  return sql<TaskNote>(
    'SELECT * FROM task_notes WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2',
    [projectId, limit],
  );
}

export async function addTaskNote(input: {
  projectId: string;
  taskId: string;
  userId: string | null;
  author: string;
  kind: string;
  content: string;
  url?: string;
}): Promise<TaskNote> {
  const rows = await sql<TaskNote>(
    `INSERT INTO task_notes (id, project_id, task_id, user_id, author, kind, content, url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      newId('note'),
      input.projectId,
      input.taskId,
      input.userId,
      input.author,
      input.kind,
      input.content.slice(0, 2000),
      (input.url ?? '').slice(0, 500),
    ],
  );
  return rows[0];
}

export async function deleteTaskNote(projectId: string, id: string): Promise<void> {
  await sql('DELETE FROM task_notes WHERE project_id = $1 AND id = $2', [projectId, id]);
}
