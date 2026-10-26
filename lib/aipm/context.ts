import { scrub, scrubDeep } from './scrub';
import type { Artifact, Member, Project, Signal, Stage, Task, TaskNote } from '../types';
import type { TeamPlan } from '../plan';

/*
 * The context slice.
 *
 * The original architecture brief assumed a vector/graph database of the whole
 * codebase. Nothing here does that: every slice is bounded (a handful of tasks,
 * the current stage's documents, the last notes) and every item carries the id
 * a finding will need to cite. If it is not in the slice, the guards must not
 * claim it — that rule is the reason this file exists.
 */

export interface CommitSlice {
  sha: string;
  short: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
  files?: string[];
}

export interface SliceTask {
  id: string;
  title: string;
  owner: string | null;
  status: string;
  priority: string;
  due: string | null;
  stage: string;
  repo: string | null;
  branch: string | null;
  pr: string | null;
}

export interface SliceNote {
  task_id: string;
  task: string;
  author: string;
  kind: string;
  content: string;
  at: string;
}

export interface SliceDoc {
  kind: string;
  title: string;
  stage: string;
  status: string;
  /** Only the requirement-shaped lines, never the whole document. */
  requirements: string[];
}

export interface GuardContext {
  project: { code: string; name: string; stage: string; stageName: string };
  problem: { title: string; status: string; confidence: number; statement: string } | null;
  gates: { key: string; name: string; met: number; total: number; open: string[] }[];
  tasks: SliceTask[];
  notes: SliceNote[];
  docs: SliceDoc[];
  commits: CommitSlice[];
  members: { name: string; role: string; last_seen: string | null; online: boolean }[];
  decisions: { label: string; status: string }[];
  generatedAt: string;
  /** What the slice could not include, so the model does not pretend. */
  gaps: string[];
}

const ONLINE_MS = 5 * 60_000;

/** Requirement-shaped lines: the only part of a document worth spending tokens on. */
const REQUIREMENT_HINT =
  /\b(must|must not|never|required|requirement|shall|should|acceptance|definition of done|api|endpoint|schema|field|validate|validation|limit|pricing|sla|metric)\b/i;

export function requirementLines(content: string, limit = 8): string[] {
  return String(content ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s]+/, '').trim())
    .filter((l) => l.length > 24 && REQUIREMENT_HINT.test(l))
    .slice(0, limit);
}

export interface BuildSliceInput {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  notes: TaskNote[];
  artifacts: Artifact[];
  signals: Signal[];
  members: Member[];
  plan: TeamPlan;
  commits?: CommitSlice[];
  /** True when a GitHub token was available and read successfully. */
  codeVisible?: boolean;
}

export function buildSlice(input: BuildSliceInput): GuardContext {
  const { project, stages, tasks, notes, artifacts, signals, members, plan } = input;
  const now = Date.now();

  const stageName = (key: string) => stages.find((s) => s.key === key)?.name ?? key;

  const open = tasks.filter((t) => t.status !== 'done');

  /* Pre-filter: the current stage plus anything in progress, never all 48 rows. */
  const relevant = open
    .slice()
    .sort((a, b) => {
      const score = (t: Task) => (t.stage_key === project.stage_key ? 0 : 1) + (t.status === 'doing' ? 0 : 1);
      return score(a) - score(b);
    })
    .slice(0, 18);

  const notesFor = (id: string) => notes.filter((n) => n.task_id === id);

  const docs: SliceDoc[] = artifacts
    .filter((a) => !!a.content && a.content.trim().length > 0)
    .map((a) => ({
      kind: a.kind,
      title: a.title,
      stage: stageName(a.stage_key),
      status: a.status,
      requirements: requirementLines(a.content),
    }))
    .filter((d) => d.requirements.length)
    .slice(0, 10);

  const gaps: string[] = [];
  if (!input.codeVisible) {
    gaps.push('No repository telemetry: the GitHub token was missing or unreadable, so nothing here describes code.');
  }
  if (!input.commits?.length) gaps.push('No commits in the slice.');
  gaps.push('No editor buffers, no CRDT state, no test output, no deploy logs.');

  const context: GuardContext = {
    project: {
      code: project.code,
      name: project.name,
      stage: project.stage_key,
      stageName: stageName(project.stage_key),
    },
    problem: project.problem
      ? {
          title: project.problem.title,
          status: project.problem.status,
          confidence: project.problem.confidence,
          statement: scrub(project.problem.statement).text.slice(0, 400),
        }
      : null,
    gates: plan.stages
      .filter((s) => s.key === project.stage_key || s.position <= (stages.find((x) => x.key === project.stage_key)?.position ?? 0))
      .map((s) => ({
        key: s.key,
        name: s.name,
        met: s.met,
        total: s.total,
        open: s.criteria.filter((c) => !c.met).map((c) => c.label).slice(0, 6),
      })),
    tasks: relevant.map((t) => ({
      id: t.id,
      title: scrub(t.title).text,
      owner: t.owner,
      status: t.status,
      priority: t.priority,
      due: t.due_date ? String(t.due_date).slice(0, 10) : null,
      stage: stageName(t.stage_key),
      repo: t.repo ?? null,
      branch: t.branch ?? null,
      pr: t.pr_url ?? null,
    })),
    notes: relevant
      .flatMap((t) =>
        notesFor(t.id)
          .slice(0, 3)
          .map((n) => ({
            task_id: t.id,
            task: t.title.slice(0, 80),
            author: n.author,
            kind: n.kind,
            content: scrub(n.content).text.slice(0, 240),
            at: n.created_at,
          })),
      )
      .slice(0, 24),
    docs,
    commits: (input.commits ?? []).slice(0, 20).map((c) => ({
      ...c,
      message: scrub(c.message).text.slice(0, 180),
      files: c.files?.slice(0, 12),
    })),
    members: members.map((m) => ({
      name: m.name,
      role: m.role,
      last_seen: m.last_seen ?? null,
      online: !!m.last_seen && now - new Date(m.last_seen).getTime() < ONLINE_MS,
    })),
    decisions: signals
      .filter((s) => s.type === 'decision' || s.type === 'blocker')
      .slice(0, 8)
      .map((s) => ({ label: scrub(s.label).text.slice(0, 120), status: s.status })),
    generatedAt: new Date().toISOString(),
    gaps,
  };

  /* Belt and braces: whatever got into a title or note, it leaves scrubbed. */
  return scrubDeep(context);
}

/** Milliseconds since the newest note on a task, or null when it has none. */
export function quietFor(notes: TaskNote[], taskId: string, at = Date.now()): number | null {
  const own = notes.filter((n) => n.task_id === taskId);
  if (!own.length) return null;
  const newest = own.reduce((max, n) => Math.max(max, new Date(n.created_at).getTime()), 0);
  return at - newest;
}
