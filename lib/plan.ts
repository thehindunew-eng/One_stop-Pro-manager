import type { Artifact, Member, ProblemStatement, Project, Signal, Stage, StageKey, Task, ToolStack } from './types';
import { dayDiff, isOverdue, todayISO } from './dates';
import { DOC_TITLES, GATE_SEED, ROLE_LABELS, type GateRuleSeed } from './defaults';

/**
 * The run plan turns a room into an ordered, owned, gated launch plan.
 *
 * Everything here is derived from what the team actually did — approved problem,
 * documents with content, board tasks, accepted decisions, tools in use — plus a
 * short list of criteria only a human can confirm (a deploy, a sign-off, three
 * user calls). Nothing is invented and nothing needs an API key.
 */

export type GateRule = GateRuleSeed;

export type GateState = 'open' | 'in_progress' | 'met' | 'blocked';

export interface GateCriterion {
  id: string;
  label: string;
  met: boolean;
  evidence: string;
  kind: GateRule['kind'];
  /** Anything a machine cannot verify is ticked by a person. */
  manual: boolean;
  /** Which seat is expected to clear it. */
  owner: TeamRole;
}

export interface StagePlan {
  key: StageKey;
  name: string;
  tagline: string;
  position: number;
  state: GateState;
  criteria: GateCriterion[];
  met: number;
  total: number;
  pct: number;
  nextCriterion: GateCriterion | null;
  docs: { kind: string; title: string; filled: boolean; status: string }[];
  tasks: { total: number; open: number; overdue: number; unowned: number };
}

export interface PlanAction {
  title: string;
  why: string;
  kind: 'doc' | 'stage' | 'task' | 'gate' | 'problem';
  stage?: string;
  docKind?: string;
  taskId?: string;
  criterion?: string;
  urgent?: boolean;
}

export type TeamRole = 'pm' | 'design' | 'eng' | 'qa' | 'growth' | 'member';

export interface RoleLane {
  role: TeamRole;
  label: string;
  headline: string;
  actions: PlanAction[];
  openTasks: number;
  overdue: number;
  /** Names sitting in this seat today. */
  members: string[];
  /** Nobody holds this seat yet — the work below has no owner. */
  unstaffed: boolean;
}

export interface LaunchReadiness {
  /** 0-100 across every gate criterion that a launch depends on. */
  score: number;
  launchable: boolean;
  blocking: { stage: string; stageName: string; label: string; owner: TeamRole }[];
  missingStages: { key: string; name: string; met: number; total: number }[];
  daysToLaunch: number | null;
  launchDate: string | null;
}

export interface TeamPlan {
  readiness: LaunchReadiness;
  stages: StagePlan[];
  lanes: RoleLane[];
  rhythm: { when: string; what: string; who: string }[];
  board: { total: number; open: number; unowned: number; overdue: number; inReview: number };
  generatedAt: string;
}

export interface PlanContext {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  artifacts: Artifact[];
  problem: ProblemStatement | null;
  signals: Signal[];
  members: Member[];
  stacks: ToolStack[];
  /** Manual confirmations, stored as project.settings.gates[key][criterionId] = true */
  checks?: Record<string, Record<string, boolean>>;
  launchDate?: string | null;
  today?: Date;
}

/* ------------------------------------------------------------------ */
/* gate rules                                                          */
/* ------------------------------------------------------------------ */

/** Which seat clears which kind of criterion. Advisory, not enforced. */
const DOC_OWNER: Record<string, TeamRole> = {
  problem_canvas: 'pm',
  interview_guide: 'pm',
  research_plan: 'pm',
  competitive_analysis: 'pm',
  prd: 'pm',
  personas: 'design',
  mvp_scope: 'pm',
  roadmap: 'pm',
  risk_register: 'pm',
  decision_log: 'pm',
  concepts: 'design',
  solution_brief: 'pm',
  ux_flows: 'design',
  design_system: 'design',
  landing_wireframe: 'design',
  tech_stack: 'eng',
  data_model: 'eng',
  api_spec: 'eng',
  repo_plan: 'eng',
  devops: 'eng',
  engineering_standards: 'eng',
  test_plan: 'qa',
  qa_checklist: 'qa',
  gtm_plan: 'growth',
  landing_copy: 'growth',
  launch_checklist: 'growth',
  pricing: 'growth',
  release_notes: 'growth',
  metrics_plan: 'growth',
  feedback_loop: 'growth',
};

const MANUAL_OWNER: Record<string, TeamRole> = {
  'discover.calls': 'pm',
  'discover.signoff': 'pm',
  'define.signoff': 'pm',
  'ideate.review': 'design',
  'design.review': 'design',
  'architect.adr': 'eng',
  'build.repo': 'eng',
  'build.staging': 'eng',
  'test.p0': 'qa',
  'launch.deployed': 'eng',
  'launch.announced': 'growth',
  'grow.read': 'pm',
  'grow.next': 'pm',
};

/** The seed gate for a stage, used when the owner resets a custom gate. */
export function defaultGate(stageKey: StageKey): GateRule[] {
  return GATE_SEED[stageKey] ?? [];
}

export function gateFor(stage: Stage): GateRule[] {
  const stored = (stage as Stage & { gate?: GateRule[] }).gate;
  if (Array.isArray(stored) && stored.length) return stored;
  return GATE_SEED[stage.key] ?? [];
}

export function criterionId(stageKey: string, rule: GateRule, index: number): string {
  if (rule.kind === 'manual') return rule.id.includes('.') ? rule.id : `${stageKey}.${rule.id}`;
  if (rule.kind === 'artifact') return `${stageKey}.doc.${rule.ref}`;
  return `${stageKey}.${rule.kind}.${index}`;
}

function artifactReady(a: Artifact | undefined, level: 'filled' | 'ready'): boolean {
  if (!a) return false;
  const filled = (a.content ?? '').trim().length > 80;
  if (level === 'filled') return filled;
  return filled && (a.status === 'ready' || a.status === 'approved');
}

export function describeRule(rule: GateRule): string {
  if (rule.label) return rule.label;
  switch (rule.kind) {
    case 'problem_approved':
      return 'The problem statement is approved by a human';
    case 'evidence':
      return `At least ${rule.min} pieces of evidence are attached to the problem`;
    case 'decisions':
      return `${rule.min} decision${rule.min === 1 ? '' : 's'} recorded in the room`;
    case 'artifact':
      return `${DOC_TITLES[rule.ref] ?? rule.ref} is ${rule.level === 'ready' ? 'marked ready' : 'written'}`;
    case 'tasks':
      return `${rule.minPct}% of this stage's board tasks are done`;
    case 'owners':
      return `${rule.min} different teammates own work in this stage`;
    case 'tools':
      return `${rule.min} tool${rule.min === 1 ? '' : 's'} marked in use by the team`;
    case 'manual':
      return rule.label;
  }
}

function evaluate(
  rule: GateRule,
  ctx: PlanContext,
  stage: Stage,
): { met: boolean; evidence: string } {
  const stageTasks = ctx.tasks.filter((t) => t.stage_key === stage.key);
  const done = stageTasks.filter((t) => t.status === 'done').length;

  switch (rule.kind) {
    case 'problem_approved': {
      const approved = ctx.problem?.status === 'approved';
      return {
        met: approved,
        evidence: approved
          ? `Approved at ${ctx.problem?.confidence ?? 0}% confidence`
          : ctx.problem
            ? `Still ${ctx.problem.status} at ${ctx.problem.confidence}% — a person has to approve it`
            : 'No problem statement yet — run the room or open the problem panel',
      };
    }
    case 'evidence': {
      const n = ctx.problem?.evidence?.length ?? 0;
      return { met: n >= rule.min, evidence: `${n} of ${rule.min} evidence items` };
    }
    case 'decisions': {
      const accepted = ctx.signals.filter((s) => s.type === 'decision' && s.status === 'accepted').length;
      return { met: accepted >= rule.min, evidence: `${accepted} accepted decision signals` };
    }
    case 'artifact': {
      const a = ctx.artifacts.find((x) => x.kind === rule.ref);
      const title = a?.title ?? rule.ref.replace(/_/g, ' ');
      const met = artifactReady(a, rule.level ?? 'filled');
      return {
        met,
        evidence: met ? `${title} · ${a?.status}` : a ? `${title} is ${(a.content ?? '').trim() ? 'a draft' : 'empty'}` : `${title} not created yet`,
      };
    }
    case 'tasks': {
      const pct = stageTasks.length ? Math.round((done / stageTasks.length) * 100) : 0;
      return { met: stageTasks.length > 0 && pct >= rule.minPct, evidence: `${done}/${stageTasks.length} tasks done (${pct}%)` };
    }
    case 'owners': {
      const owners = new Set(stageTasks.filter((t) => t.owner).map((t) => t.owner));
      return { met: owners.size >= rule.min, evidence: `${owners.size} of ${rule.min} owners assigned` };
    }
    case 'tools': {
      const using = ctx.stacks.filter((s) => s.status === 'using').length;
      return { met: using >= rule.min, evidence: `${using} tool(s) marked in use` };
    }
    case 'manual': {
      const id = rule.id.includes('.') ? rule.id : `${stage.key}.${rule.id}`;
      const ticked = Boolean(ctx.checks?.[stage.key]?.[id]);
      return { met: ticked, evidence: ticked ? 'Confirmed by the team' : 'Waiting for a human to confirm' };
    }
  }
}

/* ------------------------------------------------------------------ */
/* stage gate                                                          */
/* ------------------------------------------------------------------ */

export function planStage(stage: Stage, ctx: PlanContext): StagePlan {
  const rules = gateFor(stage);
  const criteria: GateCriterion[] = rules.map((rule, i) => {
    const id = criterionId(stage.key, rule, i);
    const { met, evidence } = evaluate(rule, ctx, stage);
    const owner =
      rule.kind === 'manual'
        ? MANUAL_OWNER[id] ?? 'pm'
        : rule.kind === 'artifact'
          ? DOC_OWNER[rule.ref] ?? 'pm'
          : rule.kind === 'tools'
            ? 'eng'
            : 'pm';
    return { id, label: describeRule(rule), met, evidence, kind: rule.kind, manual: rule.kind === 'manual', owner };
  });

  const met = criteria.filter((c) => c.met).length;
  const total = criteria.length;
  const pct = total ? Math.round((met / total) * 100) : 100;
  const stageTasks = ctx.tasks.filter((t) => t.stage_key === stage.key);
  const today = todayISO(ctx.today);
  const overdue = stageTasks.filter((t) => t.status !== 'done' && isOverdue(t.due_date, today)).length;

  const state: GateState =
    total > 0 && met === total
      ? 'met'
      : met === 0
        ? 'open'
        : 'in_progress';

  return {
    key: stage.key,
    name: stage.name,
    tagline: stage.tagline,
    position: stage.position,
    state,
    criteria,
    met,
    total,
    pct,
    nextCriterion: criteria.find((c) => !c.met) ?? null,
    docs: ctx.artifacts
      .filter((a) => a.stage_key === stage.key)
      .map((a) => ({ kind: a.kind, title: a.title, filled: (a.content ?? '').trim().length > 80, status: a.status })),
    tasks: {
      total: stageTasks.length,
      open: stageTasks.filter((t) => t.status !== 'done').length,
      overdue,
      unowned: stageTasks.filter((t) => !t.owner).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* role lanes                                                          */
/* ------------------------------------------------------------------ */

const LANE_HEADLINE: Record<TeamRole, string> = {
  pm: 'You keep the problem honest, the board owned and the launch decision explicit.',
  design: 'You turn the approved problem into flows, a system and the screens the build follows.',
  eng: 'You own the architecture, the data shape, the repo and the deploy.',
  qa: 'You own the test plan and the release gate. Nothing ships on a guess.',
  growth: 'You own pricing, the story, the launch and the numbers after it.',
  member: 'You pick up the next unclaimed piece of work and keep the room current.',
};

const LANE_DOCS: Record<TeamRole, string[]> = {
  pm: ['prd', 'mvp_scope', 'roadmap', 'risk_register', 'decision_log', 'problem_canvas'],
  design: ['personas', 'ux_flows', 'design_system', 'landing_wireframe', 'concepts'],
  eng: ['tech_stack', 'data_model', 'api_spec', 'repo_plan', 'engineering_standards', 'devops'],
  qa: ['test_plan', 'qa_checklist'],
  growth: ['gtm_plan', 'landing_copy', 'pricing', 'launch_checklist', 'metrics_plan', 'feedback_loop', 'release_notes'],
  member: [],
};

/** Who a stage belongs to, used to route unclaimed board work to one seat. */
const STAGE_SEAT: Record<string, TeamRole> = {
  discover: 'pm',
  define: 'pm',
  ideate: 'design',
  design: 'design',
  architect: 'eng',
  build: 'eng',
  test: 'qa',
  launch: 'growth',
  grow: 'growth',
};

export interface LaneOptions {
  /** The signed-in person's seat, so their own lane can speak in first person. */
  memberRole?: TeamRole;
  memberName?: string;
}

export function buildLanes(plan: StagePlan[], ctx: PlanContext): RoleLane[] {
  const today = todayISO(ctx.today);
  const roles: TeamRole[] = ['pm', 'design', 'eng', 'qa', 'growth'];

  /** member name → seat, so owned work lands in exactly one lane. */
  const seatOf = new Map<string, TeamRole>();
  for (const m of ctx.members) seatOf.set(m.name, (m.role as TeamRole) ?? 'member');
  const staffed = new Set(roles.filter((r) => ctx.members.some((m) => m.role === r)));
  /** A task may only be recommended in one lane. */
  const claimed = new Set<string>();

  const lanes = roles.map((role) => {
    const actions: PlanAction[] = [];

    // 1. Gate criteria this seat is expected to clear, earliest stage first.
    for (const stage of plan) {
      for (const c of stage.criteria) {
        if (c.met || c.owner !== role) continue;
        actions.push({
          title: c.label,
          why: `${stage.name} · ${c.evidence}`,
          kind: c.manual ? 'gate' : c.kind === 'artifact' ? 'doc' : 'stage',
          stage: stage.key,
          docKind: c.kind === 'artifact' ? c.id.split('.doc.')[1] : undefined,
          criterion: c.manual ? c.id : undefined,
        });
      }
    }

    // 2. Work already owned by someone in this seat (never every seat).
    for (const t of ctx.tasks) {
      if (t.owner && t.status !== 'done' && seatOf.get(t.owner) === role && !claimed.has(t.id)) {
        claimed.add(t.id);
        const overdue = isOverdue(t.due_date, today);
        actions.push({
          title: t.title,
          why: overdue ? `Overdue · ${stageName(plan, t.stage_key)}` : `${stageName(plan, t.stage_key)} · ${t.status}`,
          kind: 'task',
          stage: t.stage_key,
          taskId: t.id,
          urgent: overdue,
        });
      }
    }

    // 3. Unclaimed work, routed to the seat that owns its stage — once.
    const wantsUnclaimed = staffed.size === 0 || staffed.has(role);
    for (const t of wantsUnclaimed ? ctx.tasks.filter((x) => !x.owner && x.status !== 'done') : []) {
      if (claimed.has(t.id)) continue;
      const seat = STAGE_SEAT[t.stage_key] ?? 'pm';
      if (seat !== role && staffed.size > 0) continue;
      claimed.add(t.id);
      actions.push({
        title: `Take: ${t.title}`,
        why: `Unowned · ${stageName(plan, t.stage_key)}`,
        kind: 'task',
        stage: t.stage_key,
        taskId: t.id,
      });
    }

    const seen = new Set<string>();
    const unique = actions.filter((a) => {
      const key = `${a.kind}:${a.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => Number(b.urgent ?? false) - Number(a.urgent ?? false));

    const mine = ctx.tasks.filter((t) => t.owner && t.status !== 'done' && seatOf.get(t.owner) === role);
    const people = ctx.members.filter((m) => m.role === role).map((m) => m.name);

    return {
      role,
      label: ROLE_LABELS[role] ?? role,
      headline: LANE_HEADLINE[role],
      actions: unique.slice(0, 6),
      openTasks: mine.length,
      overdue: mine.filter((t) => t.status !== 'done' && isOverdue(t.due_date, today)).length,
      members: people,
      unstaffed: people.length === 0,
    };
  });

  return lanes;
}

function stageName(plan: StagePlan[], key: string): string {
  return plan.find((s) => s.key === key)?.name ?? key;
}

/* ------------------------------------------------------------------ */
/* readiness                                                           */
/* ------------------------------------------------------------------ */

export function buildPlan(ctx: PlanContext): TeamPlan {
  const today = todayISO(ctx.today);
  const stages = [...ctx.stages]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.position - b.position)
    .map((s) => planStage(s, ctx));

  // A launch depends on every stage up to and including Launch.
  const launchIndex = Math.max(0, stages.findIndex((s) => s.key === 'launch'));
  const needed = stages.slice(0, launchIndex + 1);
  const criteria = needed.flatMap((s) => s.criteria.map((c) => ({ ...c, stage: s.key, stageName: s.name })));
  const met = criteria.filter((c) => c.met).length;
  const score = criteria.length ? Math.round((met / criteria.length) * 100) : 100;

  const blocking = criteria
    .filter((c) => !c.met)
    .slice(0, 6)
    .map((c) => ({ stage: c.stage, stageName: c.stageName, label: c.label, owner: c.owner }));

  const missingStages = needed
    .filter((s) => s.met < s.total)
    .map((s) => ({ key: s.key, name: s.name, met: s.met, total: s.total }));

  const launchDate = ctx.launchDate ?? null;
  const daysToLaunch = launchDate ? dayDiff(launchDate, today) : null;

  const open = ctx.tasks.filter((t) => t.status !== 'done');

  return {
    readiness: {
      score,
      launchable: criteria.length > 0 && met === criteria.length,
      blocking,
      missingStages,
      daysToLaunch,
      launchDate,
    },
    stages,
    lanes: buildLanes(stages, ctx),
    rhythm: [
      { when: 'Daily · 10 min', what: 'Standup from the board: what moved, what is stuck, who is blocked', who: 'Whole team' },
      { when: 'Twice a week', what: 'Clear the gate criteria for the current stage — not the whole list', who: 'Stage owner' },
      { when: 'Weekly · 45 min', what: 'Meeting in the room, then re-run the problem engine and diff the statement', who: 'PM + team' },
      { when: 'At every gate', what: 'Someone who is not the author reads the documents and ticks the manual criteria', who: 'Reviewer' },
      { when: 'Launch day', what: 'Run the launch checklist top to bottom, then write the release notes', who: 'Growth + eng' },
      { when: 'Weekly after launch', what: 'Read the metrics plan against actuals; write the next bet in the decision log', who: 'PM' },
    ],
    board: {
      total: ctx.tasks.length,
      open: open.length,
      unowned: open.filter((t) => !t.owner).length,
      overdue: open.filter((t) => isOverdue(t.due_date, today)).length,
      inReview: ctx.tasks.filter((t) => t.status === 'review').length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** A one-line next step, used in the room header and the pack. */
export function headlineNext(plan: TeamPlan, role: TeamRole): string {
  const lane = plan.lanes.find((l) => l.role === role) ?? plan.lanes[0];
  if (!lane?.actions.length) return plan.readiness.launchable ? 'Everything is green — launch and start the learning loop.' : 'No next action assigned to your seat yet.';
  return lane.actions[0].title;
}
