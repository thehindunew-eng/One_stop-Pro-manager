import { callLLM, engineLabel } from '../ai';
import { buildPlan } from '../plan';
import { commits as fetchCommits, tokenFrom } from '../github';
import { getCredential, listArtifacts, listMembers, listSignals, listStages, listTaskNotes, listTasks } from '../repo';
import type { Project } from '../types';
import { buildSlice, type CommitSlice, type GuardContext } from './context';
import { gateGuard, narrative, overlapGuard, specGuard, velocityGuard, type Finding } from './guards';
import { AI_PM_SYSTEM, OUTPUT_REMINDER, PROMPT_VERSION } from './prompt';
import {
  aipmSettings,
  listFindings,
  persistFinding,
  recentBudget,
  recordRun,
  type AipmSettings,
  type FindingRow,
} from './store';

/*
 * The orchestration loop.
 *
 *   1. Build a bounded, scrubbed slice of the room (./context.ts).
 *   2. Run the four deterministic guards — they need no network and never lie.
 *   3. Optionally ask a model for the part arithmetic cannot see (spec drift in
 *      prose, cross-task intent), with the same slice, and merge only findings
 *      that carry a citation to something in it.
 *   4. Apply the noise budget and de-duplication, then persist.
 *
 * Step 2 running first is the design decision that matters: with no API key and
 * no model, the platform still has governance. The model improves recall; it is
 * not the source of truth.
 */

export interface AipmRunResult {
  findings: FindingRow[];
  ran: boolean;
  engine: string;
  promptVersion: string;
  found: number;
  kept: number;
  duplicates: number;
  suppressed: number;
  ms: number;
  gaps: string[];
  narrative: string;
  settings: AipmSettings;
  /** True when only the deterministic guards ran. */
  roomOnly: boolean;
}

const MAX_FINDINGS = 6;

/** Findings that come out of a model are only accepted if they cite something real. */
function validCitations(finding: Finding, ctx: GuardContext): boolean {
  if (!Array.isArray(finding.citations) || !finding.citations.length) return false;
  const ids = new Set<string>([
    ...ctx.tasks.map((t) => t.id),
    ...ctx.docs.map((d) => d.kind),
    ...ctx.commits.map((c) => c.short),
    ...ctx.gates.map((g) => g.key),
    ...ctx.notes.map((n) => n.task_id),
  ]);
  return finding.citations.every((c) => {
    const ref = String(c.ref ?? '');
    return ids.has(ref) || [...ids].some((id) => ref.includes(id)) || /:\w+$/.test(ref);
  });
}

function normalise(raw: any, ctx: GuardContext): Finding[] {
  const kinds = ['CONFLICT', 'DEVIATION', 'SUGGESTION', 'GATE', 'VELOCITY'];
  const severities = ['LOW', 'MEDIUM', 'HIGH'];
  return (Array.isArray(raw?.findings) ? raw.findings : [])
    .slice(0, MAX_FINDINGS)
    .map((f: any) => {
      const citations = (Array.isArray(f?.citations) ? f.citations : [])
        .slice(0, 4)
        .map((c: any) => ({
          source: ['doc', 'task', 'commit', 'note', 'gate'].includes(c?.source) ? c.source : 'note',
          ref: String(c?.ref ?? '').slice(0, 120),
          detail: String(c?.detail ?? '').slice(0, 200),
        }))
        .filter((c: any) => c.ref);
      const finding: Finding = {
        kind: kinds.includes(f?.kind) ? f.kind : 'SUGGESTION',
        severity: severities.includes(f?.severity) ? f.severity : 'LOW',
        target: String(f?.target ?? 'the room').slice(0, 60),
        task_id: typeof f?.task_id === 'string' && ctx.tasks.some((t) => t.id === f.task_id) ? f.task_id : null,
        message: String(f?.message ?? '').slice(0, 600),
        suggested_action: String(f?.suggested_action ?? '').slice(0, 300),
        confidence: Number.isFinite(f?.confidence) ? Number(f.confidence) : 0.4,
        citations,
        fingerprint: '',
      };
      return finding;
    })
    .filter((f: Finding) => f.message.length > 12 && validCitations(f, ctx))
    .map((f: Finding) => ({
      ...f,
      fingerprint: `${f.kind}|${f.task_id ?? '-'}|${f.citations.map((c) => c.ref).sort().join(',')}`,
    }));
}

async function readCommits(project: Project, userId: string, repo: string | null, taskBranches: string[]): Promise<{
  commits: CommitSlice[];
  codeVisible: boolean;
}> {
  if (!repo) return { commits: [], codeVisible: false };
  const row = await getCredential(project.id, userId, 'github');
  if (!row) return { commits: [], codeVisible: false };
  try {
    const token = tokenFrom(row);
    const list = await fetchCommits(token, repo, 12);
    return {
      commits: list.map((c) => ({ ...c, files: c.sha && taskBranches.includes(c.sha) ? [] : [] })),
      codeVisible: true,
    };
  } catch {
    return { commits: [], codeVisible: false };
  }
}

export async function runAipm(input: {
  project: Project;
  userId: string;
  userName: string;
  /** Skip the model even when one is configured (used by the preview button). */
  roomOnly?: boolean;
  repo?: string | null;
}): Promise<AipmRunResult> {
  const started = Date.now();
  const { project } = input;
  const settings = aipmSettings(project);

  const [stages, tasks, notes, artifacts, signals, members] = await Promise.all([
    listStages(false),
    listTasks(project.id),
    listTaskNotes(project.id, 200),
    listArtifacts(project.id),
    listSignals(project.id),
    listMembers(project.id),
  ]);

  const plan = buildPlan({ project, stages, tasks, artifacts, problem: project.problem, signals, members, stacks: [], checks: (project.settings as any)?.gates ?? {} });
  const repo = input.repo || tasks.find((t) => t.repo)?.repo || null;
  const { commits, codeVisible } = await readCommits(
    project,
    input.userId,
    repo,
    tasks.map((t) => t.branch ?? '').filter(Boolean),
  );

  const ctx = buildSlice({ project, stages, tasks, notes, artifacts, signals, members, plan, commits, codeVisible });

  /* 2. Deterministic guards — always. */
  const local: Finding[] = [
    ...overlapGuard(ctx),
    ...specGuard(ctx),
    ...velocityGuard(ctx),
    ...gateGuard(ctx),
  ];

  /* 3. The model, when there is one, over the same slice. */
  const label = await engineLabel();
  let remote: Finding[] = [];
  if (label.live && !input.roomOnly) {
    const answer = await callLLM(
      AI_PM_SYSTEM,
      `${OUTPUT_REMINDER}\n\nCONTEXT SLICE (JSON):\n${JSON.stringify(ctx)}`,
      { json: true, maxTokens: 1400, temperature: 0.2 },
    );
    if (answer) {
      try {
        const parsed = JSON.parse(answer.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
        remote = normalise(parsed, ctx);
      } catch {
        remote = [];
      }
    }
  }

  /* 4. Noise budget: no repeats, at most 3 per person per day, 1 HIGH per task/day. */
  const budget = await recentBudget(project.id);
  const perTarget = new Map<string, number>();
  const highPerTask = new Set<string>();
  for (const row of budget) {
    perTarget.set(row.target, (perTarget.get(row.target) ?? 0) + 1);
    if (row.severity === 'HIGH' && row.task_id) highPerTask.add(row.task_id);
  }

  const merged = dedupe([...local, ...remote]);
  const kept: FindingRow[] = [];
  let duplicates = 0;
  let suppressed = 0;

  for (const finding of merged) {
    const used = perTarget.get(finding.target) ?? 0;
    if (used >= settings.maxPerPersonPerDay) {
      suppressed++;
      continue;
    }
    /*
     * One HIGH per task per day — except a CONFLICT, which is about two people
     * and must reach both of them or it is useless.
     */
    if (finding.severity === 'HIGH' && finding.kind !== 'CONFLICT' && finding.task_id && highPerTask.has(finding.task_id)) {
      suppressed++;
      continue;
    }
    const stored = await persistFinding(project.id, finding, {
      promptVersion: PROMPT_VERSION,
      engine: label.engine,
      createdBy: input.userName,
    });
    if (stored.duplicate) {
      duplicates++;
      continue;
    }
    perTarget.set(finding.target, used + 1);
    if (finding.severity === 'HIGH' && finding.kind !== 'CONFLICT' && finding.task_id) highPerTask.add(finding.task_id);
    if (stored.row) kept.push(stored.row);
  }

  const all = await listFindings(project.id);
  const text = narrative(ctx, merged);

  await recordRun({
    projectId: project.id,
    engine: label.engine,
    promptVersion: PROMPT_VERSION,
    found: merged.length,
    kept: kept.length,
    ms: Date.now() - started,
    gaps: ctx.gaps,
    createdBy: input.userName,
  });

  return {
    findings: all,
    ran: true,
    engine: label.engine,
    promptVersion: PROMPT_VERSION,
    found: merged.length,
    kept: kept.length,
    duplicates,
    suppressed,
    ms: Date.now() - started,
    gaps: ctx.gaps,
    narrative: text,
    settings,
    roomOnly: !label.live || !!input.roomOnly,
  };
}

function dedupe(list: Finding[]): Finding[] {
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const seen = new Set<string>();
  return list
    .filter((f) => {
      const key = `${f.kind}|${f.task_id ?? '-'}|${f.message.slice(0, 60)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => order[a.severity] - order[b.severity] || b.confidence - a.confidence)
    .slice(0, 12);
}

/** Read-only view for the room: stored findings + the last narrative, no writes. */
export async function aipmSnapshot(project: Project, repo?: string | null) {
  const [stored, stages, tasks, notes, artifacts, signals, members, label] = await Promise.all([
    listFindings(project.id),
    listStages(false),
    listTasks(project.id),
    listTaskNotes(project.id, 200),
    listArtifacts(project.id),
    listSignals(project.id),
    listMembers(project.id),
    engineLabel(),
  ]);
  const plan = buildPlan({ project, stages, tasks, artifacts, problem: project.problem, signals, members, stacks: [], checks: (project.settings as any)?.gates ?? {} });
  const ctx = buildSlice({
    project,
    stages,
    tasks,
    notes,
    artifacts,
    signals,
    members,
    plan,
    commits: [],
    codeVisible: false,
  });
  const live = stored.filter((f) => f.status === 'open');
  const findings: Finding[] = live.map((f) => ({
    kind: f.kind as Finding['kind'],
    severity: f.severity as Finding['severity'],
    target: f.target,
    task_id: f.task_id,
    message: f.message,
    suggested_action: f.action,
    confidence: f.confidence,
    citations: f.citations as Finding['citations'],
    fingerprint: f.fingerprint,
  }));
  return {
    stored,
    /* A calm digest is still a digest — the lead PM should see the trajectory even on a quiet day. */
    narrative: narrative(ctx, findings),
    engine: label,
    settings: aipmSettings(project),
    repo: repo ?? tasks.find((t) => t.repo)?.repo ?? null,
  };
}
