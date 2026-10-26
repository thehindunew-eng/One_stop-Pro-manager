import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import {
  addMessage,
  addTaskNote,
  deleteTaskNote,
  getCredential,
  listCredentialRows,
  listMembers,
  listTaskNotes,
  listTasks,
  updateTask,
} from '@/lib/repo';
import { account, commits, compareUrl, createBranch, GitHubError, repos, tokenFrom } from '@/lib/github';
import { isOverdue, todayISO } from '@/lib/dates';
import type { BuildStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * The build room.
 *
 * GET  → my build setup (GitHub account + repos when a token is attached), the
 *        board with its build fields, the work log feed, and live per-person
 *        status for the whole room.
 * POST → attach a branch to a task, create that branch on GitHub with the
 *        caller's own token, set a pull-request link, or write in the work log.
 *
 * Everything that touches GitHub uses the *caller's* credential. The owner
 * sees status, never somebody else's token.
 */

const ONLINE_MS = 5 * 60_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') ?? '';
  const repoParam = url.searchParams.get('repo') ?? '';
  const g = await guard(code);
  if (!isGuard(g)) return g;

  const [tasks, notes, members, creds] = await Promise.all([
    listTasks(g.project.id),
    listTaskNotes(g.project.id, 120),
    listMembers(g.project.id),
    listCredentialRows(g.project.id),
  ]);

  const mineCreds = creds.filter((c) => c.user_id === g.user.id);
  const github = mineCreds.find((c) => c.provider === 'github');

  /* Only fetch repos when the member actually has a working GitHub token. */
  let githubState:
    | { connected: true; login: string; repos: Awaited<ReturnType<typeof repos>> }
    | { connected: false; reason: string } = { connected: false, reason: 'No GitHub token attached yet.' };
  if (github) {
    try {
      const token = tokenFrom(github);
      const [me, list] = await Promise.all([account(token), repos(token)]);
      githubState = { connected: true, login: me.login, repos: list };
    } catch (err) {
      githubState = { connected: false, reason: (err as Error).message };
    }
  }

  /* Recent commits for the repo the member is working in, when GitHub is live. */
  let feed: Awaited<ReturnType<typeof commits>> = [];
  let feedRepo = '';
  if (github && /^[\w.-]+\/[\w.-]+$/.test(repoParam)) {
    try {
      feed = await commits(tokenFrom(github), repoParam, 12);
      feedRepo = repoParam;
    } catch {
      feed = [];
    }
  }

  const today = todayISO();
  const open = tasks.filter((t) => t.status !== 'done');

  const status: BuildStatus[] = members.map((m) => {
    const own = open.filter((t) => t.owner && t.owner.toLowerCase() === m.name.toLowerCase());
    const doing =
      tasks.find((t) => t.owner && t.owner.toLowerCase() === m.name.toLowerCase() && t.status === 'review') ??
      tasks.find((t) => t.owner && t.owner.toLowerCase() === m.name.toLowerCase() && t.status === 'doing') ??
      null;
    const ownNotes = notes.filter((n) => n.author.toLowerCase() === m.name.toLowerCase());
    const lastNote = ownNotes[0];
    const dues = own
      .map((t) => t.due_date)
      .filter((d): d is string => !!d)
      .sort();
    return {
      user_id: m.user_id,
      name: m.name,
      role: m.role,
      last_seen: m.last_seen ?? null,
      online: !!m.last_seen && Date.now() - new Date(m.last_seen).getTime() < ONLINE_MS,
      open: own.length,
      overdue: own.filter((t) => isOverdue(t.due_date, today)).length,
      in_progress: doing
        ? { id: doing.id, title: doing.title, stage: doing.stage_key, branch: doing.branch ?? null }
        : null,
      next_due: dues[0] ?? null,
      credentials: creds.filter((c) => c.user_id === m.user_id).length,
      notes_this_week: ownNotes.filter((n) => Date.now() - new Date(n.created_at).getTime() < 7 * 86_400_000).length,
      last_note: lastNote
        ? {
            content: lastNote.content.slice(0, 140),
            at: lastNote.created_at,
            task: tasks.find((t) => t.id === lastNote.task_id)?.title ?? 'a task',
          }
        : null,
    };
  });

  return NextResponse.json({
    github: githubState,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      stage_key: t.stage_key,
      status: t.status,
      owner: t.owner,
      priority: t.priority,
      due_date: t.due_date,
      repo: t.repo ?? null,
      branch: t.branch ?? null,
      pr_url: t.pr_url ?? null,
    })),
    notes,
    commits: feed,
    commitsRepo: feedRepo,
    status,
    me: { id: g.user.id, name: g.user.name, role: g.user.role, canEdit: g.access.canEdit, canAdmin: g.access.canAdmin },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;

  const action = String(body.action ?? '');
  const tasks = await listTasks(g.project.id);
  const task = body.taskId ? tasks.find((t) => t.id === body.taskId) : null;
  if (body.taskId && !task) return bad('That task is not on this board.', 404);

  /* Anyone may write in the work log — it is how the room sees progress. */
  if (action === 'note') {
    if (!task) return bad('Which task?');
    const content = String(body.content ?? '').trim();
    if (!content) return bad('Write something first.');
    const kind = ['note', 'commit', 'link', 'blocker', 'status'].includes(String(body.kind))
      ? String(body.kind)
      : 'note';
    const note = await addTaskNote({
      projectId: g.project.id,
      taskId: task.id,
      userId: g.user.id,
      author: g.user.name,
      kind,
      content,
      url: typeof body.url === 'string' ? body.url : '',
    });
    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: g.user.name,
      role: g.user.role,
      kind: 'note',
      content: `${kind === 'blocker' ? 'Blocked on' : kind === 'commit' ? 'Pushed' : 'Working note'} · ${task.title}: ${content}`,
      meta: { build: true, taskId: task.id, noteKind: kind },
    });
    return NextResponse.json({ ok: true, note });
  }

  /* Linking a branch / pull request is a build action, so it needs edit. */
  if (action === 'link_branch' || action === 'set_pr' || action === 'create_branch') {
    if (!task) return bad('Which task?');
    if (!g.access.canEdit && task.owner && task.owner.toLowerCase() !== g.user.name.toLowerCase()) {
      return bad('That task belongs to someone else in the room.', 403);
    }

    if (action === 'link_branch') {
      const branch = String(body.branch ?? '').trim().slice(0, 120);
      const repo = String(body.repo ?? '').trim().slice(0, 140);
      if (!branch) return bad('Branch name required.');
      await updateTask(g.project.id, task.id, {
        branch,
        repo: repo || task.repo || null,
        status: task.status === 'todo' ? 'doing' : task.status,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'set_pr') {
      const prUrl = String(body.prUrl ?? '').trim().slice(0, 400);
      if (prUrl && !/^https?:\/\//i.test(prUrl)) return bad('That does not look like a URL.');
      await updateTask(g.project.id, task.id, { pr_url: prUrl || null, status: prUrl ? 'review' : task.status });
      return NextResponse.json({ ok: true });
    }

    /* create_branch talks to GitHub with the caller's own token. */
    const row = await getCredential(g.project.id, g.user.id, 'github');
    if (!row) return bad('Attach your GitHub token under Build → Connections first.', 400);
    const repo = String(body.repo ?? task.repo ?? '').trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return bad('Pick a repository first (owner/name).');
    const base = String(body.base ?? '').trim();
    const suggested =
      String(body.branch ?? '').trim() ||
      `${task.stage_key}/${task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)}`;

    try {
      const result = await createBranch(tokenFrom(row), repo, suggested, base || undefined);
      await updateTask(g.project.id, task.id, {
        repo,
        branch: result.branch,
        status: task.status === 'todo' ? 'doing' : task.status,
      });
      await addTaskNote({
        projectId: g.project.id,
        taskId: task.id,
        userId: g.user.id,
        author: g.user.name,
        kind: 'commit',
        content: result.created
          ? `Created branch ${result.branch} from ${result.base}`
          : `Branch ${result.branch} already existed — linked it`,
        url: result.url,
      });
      return NextResponse.json({
        ok: true,
        branch: result.branch,
        repo,
        created: result.created,
        url: result.url,
        prUrl: compareUrl(repo, result.base, result.branch),
      });
    } catch (err) {
      const e = err as GitHubError;
      return bad(e.message, e.status >= 400 && e.status < 600 ? e.status : 400);
    }
  }

  if (action === 'delete_note') {
    const id = String(body.id ?? '');
    if (!id) return bad('Which note?');
    await deleteTaskNote(g.project.id, id);
    return NextResponse.json({ ok: true });
  }

  return bad('Unknown action.');
}
