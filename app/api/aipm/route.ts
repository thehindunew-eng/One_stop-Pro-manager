import { NextResponse } from 'next/server';
import { bad, guard, isGuard } from '@/lib/api';
import { addMessage, addTaskNote, createTask, updateProject } from '@/lib/repo';
import { aipmSnapshot, runAipm } from '@/lib/aipm';
import {
  aipmSettings,
  DEFAULT_AIPM_SETTINGS,
  getFinding,
  lastRun,
  runsInLastDay,
  listFindings,
  setFindingStatus,
  type AipmSettings,
} from '@/lib/aipm/store';
import { PROMPT_VERSION } from '@/lib/aipm/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * The AI PM's only interface with the world.
 *
 * Read: anyone in the room sees the findings, because governance that only the
 * owner can read is surveillance rather than governance.
 * Write: 'run' needs edit access. Every action a finding suggests is executed
 * here, by a human, with that human's name on the row — the agent itself never
 * writes to a repository, a task or a gate.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code') ?? '');
  if (!isGuard(g)) return g;

  const repo = url.searchParams.get('repo');
  const [snapshot, stored, run, runsToday] = await Promise.all([
    aipmSnapshot(g.project, repo),
    listFindings(g.project.id),
    lastRun(g.project.id),
    runsInLastDay(g.project.id),
  ]);
  const settings = snapshot.settings;

  return NextResponse.json({
    settings,
    runsToday,
    runsLeft: Math.max(0, settings.maxRunsPerDay - runsToday),
    promptVersion: PROMPT_VERSION,
    engine: snapshot.engine,
    findings: stored,
    narrative: snapshot.narrative,
    lastRun: run,
    repo: snapshot.repo,
    canEdit: g.access.canEdit,
    me: { name: g.user.name, id: g.user.id },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;

  const action = String(body.action ?? '');

  /* ---------------------------------------------------------------- run */
  if (action === 'run') {
    if (!g.access.canEdit) return bad('Only people who can edit the room can run the guards.', 403);
    if (!aipmSettings(g.project).enabled) return bad('The AI PM is switched off for this room.', 409);
    const result = await runAipm({
      project: g.project,
      userId: g.user.id,
      userName: g.user.name,
      roomOnly: body.roomOnly === true,
      repo: typeof body.repo === 'string' ? body.repo : null,
    });
    if (result.blocked) {
      return NextResponse.json(
        { error: result.blocked.reason, runsToday: result.blocked.runsToday, maxRunsPerDay: result.blocked.maxRunsPerDay },
        { status: 429 },
      );
    }
    return NextResponse.json(result);
  }

  /* ------------------------------------------------------------ settings */
  if (action === 'settings') {
    if (!g.access.canAdmin) return bad('Only the owner can change governance settings.', 403);
    const current = aipmSettings(g.project);
    const next: AipmSettings = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      strict: typeof body.strict === 'boolean' ? body.strict : current.strict,
      maxPerPersonPerDay:
        typeof body.maxPerPersonPerDay === 'number'
          ? Math.max(0, Math.min(10, Math.round(body.maxPerPersonPerDay)))
          : current.maxPerPersonPerDay,
      maxRunsPerDay:
        typeof body.maxRunsPerDay === 'number'
          ? Math.max(1, Math.min(500, Math.round(body.maxRunsPerDay)))
          : current.maxRunsPerDay,
      digest: body.digest === 'weekly' || body.digest === 'off' || body.digest === 'daily' ? body.digest : current.digest,
    };
    const project = await updateProject(g.project.id, {
      settings: { ...(g.project.settings as Record<string, unknown>), aipm: next },
    });
    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: 'Prime',
      role: 'assistant',
      kind: 'system',
      content: `AI PM settings updated by ${g.user.name}: ${
        next.enabled ? 'guards on' : 'guards off'
      }, strict architecture ${next.strict ? 'on' : 'off'}, ${next.maxPerPersonPerDay} findings per person per day, ${next.maxRunsPerDay} runs per day.`,
      meta: { aipm: 'settings' },
    });
    return NextResponse.json({ settings: aipmSettings(project) });
  }

  /* ------------------------------------------------- confirm / dismiss */
  if (action === 'confirm' || action === 'dismiss' || action === 'acknowledge') {
    const id = String(body.findingId ?? '');
    const finding = await getFinding(g.project.id, id);
    if (!finding) return bad('That finding does not exist.', 404);
    if (!g.access.canEdit && finding.target !== g.user.name) {
      return bad('Only the owner, or the person this finding is about, can close it.', 403);
    }

    if (action === 'dismiss') {
      const row = await setFindingStatus(g.project.id, id, 'dismissed', g.user.name);
      return NextResponse.json({ finding: row });
    }

    if (action === 'acknowledge') {
      const row = await setFindingStatus(g.project.id, id, 'acknowledged', g.user.name);
      return NextResponse.json({ finding: row });
    }

    /*
     * Confirm = a human chose to act. Two safe effects are allowed, both inside
     * the room: create a board task from the suggestion, and/or write the
     * finding into the work log of the task it is about. Nothing external.
     */
    const createBoardTask = body.createTask !== false;
    const writeNote = body.note !== false;
    let taskId: string | null = null;

    if (createBoardTask) {
      const created = await createTask(g.project.id, {
        title: `Fix: ${finding.message.slice(0, 90)}`,
        detail: `${finding.action}\n\nRaised by the AI PM (${finding.kind} · ${finding.severity} · ${Math.round(
          finding.confidence * 100,
        )}% confidence). Confirmed by ${g.user.name}.\n\nEvidence: ${finding.citations
          .map((c) => `${c.source}:${c.ref}`)
          .join(', ')}`,
        stage_key: (g.project.stage_key as any) ?? 'build',
        status: 'todo',
        priority: finding.severity === 'HIGH' ? 'P0' : finding.severity === 'MEDIUM' ? 'P1' : 'P2',
        owner: null,
      });
      taskId = created.id;
    }

    if (writeNote && finding.task_id) {
      await addTaskNote({
        projectId: g.project.id,
        taskId: finding.task_id,
        userId: g.user.id,
        author: g.user.name,
        kind: finding.kind === 'CONFLICT' ? 'blocker' : 'note',
        content: `AI PM ${finding.kind} (${finding.severity}, ${Math.round(finding.confidence * 100)}%) — ${finding.message}`,
        url: '',
      });
    }

    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: g.user.name,
      role: g.user.role,
      kind: 'decision',
      content: `Acted on an AI PM finding: ${finding.message.slice(0, 160)}${taskId ? ' — a board task was created.' : ''}`,
      meta: { aipm: 'confirmed', findingId: id, taskId },
    });

    const row = await setFindingStatus(g.project.id, id, 'actioned', g.user.name);
    return NextResponse.json({ finding: row, taskId, settings: aipmSettings(g.project) });
  }

  return bad('Unknown action.');
}

/** Used by the owner console to show defaults next to the stored values. */
export async function DELETE() {
  return NextResponse.json({ defaults: DEFAULT_AIPM_SETTINGS, promptVersion: PROMPT_VERSION });
}
