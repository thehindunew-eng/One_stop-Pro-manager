'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Check, CheckCircle2, Circle, ExternalLink, GitBranch, GitPullRequest,
  KeyRound, Loader2, Lock, Plus, RefreshCw, ShieldCheck, Terminal, Trash2, User,
} from 'lucide-react';
import type { CredentialView, TaskNote } from '@/lib/types';
import { ApiError, api, del, post } from '@/lib/client';
import { PROVIDERS, providerInfo, type ProviderInfo } from '@/lib/providers';
import { Avatar, Pill, Spinner } from './ui';
import LiveStatus from './LiveStatus';

interface BuildTask {
  id: string;
  title: string;
  stage_key: string;
  status: string;
  owner: string | null;
  priority: string;
  due_date: string | null;
  repo: string | null;
  branch: string | null;
  pr_url: string | null;
}

interface StatusRow {
  user_id: string;
  name: string;
  role: string;
  last_seen: string | null;
  online: boolean;
  open: number;
  overdue: number;
  in_progress: { id: string; title: string; stage: string; branch?: string | null } | null;
  next_due: string | null;
  credentials: number;
  notes_this_week: number;
  last_note: { content: string; at: string; task: string } | null;
}

interface Repo {
  full_name: string;
  private: boolean;
  default_branch: string;
  pushed_at: string | null;
}

interface Commit {
  sha: string;
  short: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

interface BuildData {
  github: { connected: true; login: string; repos: Repo[] } | { connected: false; reason: string };
  tasks: BuildTask[];
  notes: TaskNote[];
  commits: Commit[];
  commitsRepo: string;
  status: StatusRow[];
  me: { id: string; name: string; role: string; canEdit: boolean; canAdmin: boolean };
}

interface CredData {
  providers: ProviderInfo[];
  mine: CredentialView[];
  everyone: CredentialView[];
  coverage: { user_id: string; name: string; role: string; connected: number; saved: number; providers: string[]; blocked: boolean }[];
  canAdmin: boolean;
  vault: { strong: boolean; source: string };
}

const ago = (iso: string | null): string => {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const STATUS_TONE: Record<string, 'mint' | 'amber' | 'rose' | 'slate'> = {
  connected: 'mint',
  unverified: 'slate',
  error: 'rose',
  revoked: 'slate',
};

export default function BuildView({
  code,
  me,
  stageNames,
  onToast,
}: {
  code: string;
  me: { id: string; name: string; role: string; canEdit: boolean; canAdmin: boolean };
  stageNames: Record<string, string>;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<'work' | 'connections' | 'team'>('work');
  const [build, setBuild] = useState<BuildData | null>(null);
  const [creds, setCreds] = useState<CredData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* connection form */
  const [provider, setProvider] = useState('github');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  /* per-task drafts */
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteKind, setNoteKind] = useState('note');
  const [branchDraft, setBranchDraft] = useState('');
  const [prDraft, setPrDraft] = useState('');
  const [repo, setRepo] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const [b, c] = await Promise.all([
          api<BuildData>(
            `/api/build?code=${encodeURIComponent(code)}${repo ? `&repo=${encodeURIComponent(repo)}` : ''}`,
          ),
          api<CredData>(`/api/credentials?code=${encodeURIComponent(code)}`),
        ]);
        setBuild(b);
        setCreds(c);
        if (!repo) {
          const remembered = (() => {
            try {
              return localStorage.getItem(`ospm_repo_${code}`) ?? '';
            } catch {
              return '';
            }
          })();
          const firstTaskRepo = b.tasks.find((t) => t.repo)?.repo ?? '';
          setRepo(remembered || firstTaskRepo || (b.github.connected ? b.github.repos[0]?.full_name ?? '' : ''));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const rememberRepo = (value: string) => {
    setRepo(value);
    try {
      localStorage.setItem(`ospm_repo_${code}`, value);
    } catch {
      /* storage blocked, the field still works for this session */
    }
  };

  const mine = useMemo(
    () => (build?.tasks ?? []).filter((t) => t.owner && t.owner.toLowerCase() === me.name.toLowerCase() && t.status !== 'done'),
    [build?.tasks, me.name],
  );
  const unowned = useMemo(() => (build?.tasks ?? []).filter((t) => !t.owner && t.status !== 'done'), [build?.tasks]);

  async function act(label: string, run: () => Promise<unknown>, done: string) {
    setBusy(label);
    setError(null);
    try {
      await run();
      await load(true);
      onToast(done);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  const saveCredential = () =>
    act(
      'save-cred',
      async () => {
        await post('/api/credentials', { code, provider, secret: secret.trim(), label: label.trim() });
        setSecret('');
        setLabel('');
      },
      'Credential saved encrypted',
    );

  const removeCredential = (p: string) =>
    act(`del-${p}`, () => del(`/api/credentials?code=${encodeURIComponent(code)}&provider=${p}`), 'Credential removed');

  const createBranch = (task: BuildTask) =>
    act(
      `branch-${task.id}`,
      () => post('/api/build', { code, action: 'create_branch', taskId: task.id, repo, branch: branchDraft || undefined }),
      'Branch created on GitHub',
    );

  const linkBranch = (task: BuildTask) =>
    act(
      `link-${task.id}`,
      () => post('/api/build', { code, action: 'link_branch', taskId: task.id, repo, branch: branchDraft }),
      'Branch linked',
    );

  const setPr = (task: BuildTask) =>
    act(
      `pr-${task.id}`,
      () => post('/api/build', { code, action: 'set_pr', taskId: task.id, prUrl: prDraft }),
      'Pull request linked',
    );

  const addNote = (task: BuildTask) =>
    act(
      `note-${task.id}`,
      async () => {
        await post('/api/build', { code, action: 'note', taskId: task.id, content: noteDraft, kind: noteKind });
        setNoteDraft('');
      },
      'Work log updated',
    );

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    api<BuildData>(`/api/build?code=${encodeURIComponent(code)}&repo=${encodeURIComponent(repo)}`)
      .then((next) => {
        if (alive) setBuild((prev) => (prev ? { ...prev, commits: next.commits, commitsRepo: next.commitsRepo } : prev));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code, repo]);

  const connectedGithub = build?.github.connected ? build.github : null;
  const notesByTask = useMemo(() => {
    const map = new Map<string, TaskNote[]>();
    for (const n of build?.notes ?? []) {
      const list = map.get(n.task_id) ?? [];
      list.push(n);
      map.set(n.task_id, list);
    }
    return map;
  }, [build?.notes]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="panel flex items-start gap-2 border-rose-300 bg-rose-50/80 p-3 text-[13px] text-rose">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[12px] underline">
            dismiss
          </button>
        </div>
      )}

      {/* header + tabs */}
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
          <Terminal className="h-4 w-4 text-slate-700" />
          <h2 className="text-[16px] font-semibold text-slate-900">Build room</h2>
          <span className="hidden text-[12px] text-slate-500 sm:inline">
            Attach your own access, then work the board from here — every branch, note and PR stays with the task.
          </span>
          <div className="ml-auto flex items-center gap-1">
            {build?.github.connected ? (
              <Pill tone="mint">
                <GitBranch className="h-2.5 w-2.5" /> {build.github.login}
              </Pill>
            ) : (
              <Pill tone="slate">
                <KeyRound className="h-2.5 w-2.5" /> no GitHub yet
              </Pill>
            )}
            <button type="button" className="btn-ghost h-7 px-2" onClick={() => void load()} title="Refresh">
              {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex gap-1 px-3 py-2">
          {([
            ['work', 'My build', Terminal],
            ['connections', 'Connections', KeyRound],
            ['team', 'Live status', ShieldCheck],
          ] as const).map(([key, text, Icon]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`tab ${tab === key ? 'tab-active' : ''}`}>
              <Icon className="h-3.5 w-3.5" /> {text}
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-1 text-[12px] text-slate-500 sm:flex">
            <Lock className="h-3 w-3" /> secrets are encrypted and never leave the server
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- work */}
      {tab === 'work' && (
        <>
          <div className="panel p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label">Build repo</span>
              <select
                className="field h-8 w-full max-w-[340px] py-0 text-[12px]"
                value={repo}
                onChange={(e) => rememberRepo(e.target.value)}
              >
                <option value="">{connectedGithub ? 'choose a repository' : 'connect GitHub to list repositories'}</option>
                {connectedGithub?.repos.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                    {r.private ? ' (private)' : ''}
                  </option>
                ))}
                {!connectedGithub && repo && <option value={repo}>{repo}</option>}
              </select>
              <span className="text-[12px] text-slate-500">
                Branches are created from the repo’s default branch with your own token.
              </span>
              {!connectedGithub && (
                <button type="button" className="btn-ghost ml-auto h-7 px-2 text-[12px]" onClick={() => setTab('connections')}>
                  <KeyRound className="h-3 w-3" /> Attach GitHub
                </button>
              )}
            </div>
            {!connectedGithub && (
              <p className="mt-1.5 text-[12px] text-slate-500">
                {build && !build.github.connected ? build.github.reason : 'No GitHub token yet.'} You can still link a
                branch or a PR by hand.
              </p>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
              <h3 className="text-[14px] font-semibold text-slate-900">Assigned to me</h3>
              <Pill tone="slate">{mine.length}</Pill>
              <span className="text-[12px] text-slate-500">Start a branch, write what you did, open the PR.</span>
            </div>

            {loading && !build && (
              <div className="space-y-2 p-4">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            )}

            {!loading && !mine.length && (
              <div className="p-4 text-[13px] text-slate-600">
                Nothing is assigned to you. Claim something from the board or the Run plan first.
                {!!unowned.length && (
                  <span className="mt-1 block text-[12px] text-slate-500">
                    {unowned.length} unclaimed task{unowned.length === 1 ? '' : 's'} in the room.
                  </span>
                )}
              </div>
            )}

            <div className="divide-y divide-slate-900/10">
              {mine.map((task) => {
                const isOpen = openTask === task.id;
                const prUrl = task.pr_url;
                return (
                  <div key={task.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip h-6">{stageNames[task.stage_key] ?? task.stage_key}</span>
                      <button
                        type="button"
                        onClick={() => setOpenTask(isOpen ? null : task.id)}
                        className="min-w-0 flex-1 text-left text-[13px] font-medium text-slate-900 hover:underline"
                      >
                        {task.title}
                      </button>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500">{task.status}</span>
                      {task.branch ? (
                        <span className="chip h-6 font-mono text-[11px]">
                          <GitBranch className="h-2.5 w-2.5" /> {task.branch}
                        </span>
                      ) : (
                        <span className="chip h-6 text-[11px] text-slate-500">
                          <Circle className="h-2.5 w-2.5" /> no branch
                        </span>
                      )}
                      {prUrl && (
                        <a href={prUrl} target="_blank" rel="noreferrer noopener" className="chip h-6 text-[11px]">
                          <GitPullRequest className="h-2.5 w-2.5" /> PR
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        </a>
                      )}
                      <button type="button" className="btn-ghost h-7 px-2 text-[12px]" onClick={() => setOpenTask(isOpen ? null : task.id)}>
                        {isOpen ? 'Close' : 'Work on it'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-900/20 bg-white/70 p-2.5">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <label className="label">Branch</label>
                            <div className="flex gap-1.5">
                              <input
                                className="field h-8 py-0 font-mono text-[12px]"
                                placeholder={task.branch ?? `${task.stage_key}/short-name`}
                                value={branchDraft}
                                onChange={(e) => setBranchDraft(e.target.value)}
                              />
                              {connectedGithub && (
                                <button
                                  type="button"
                                  className="btn-primary h-8 px-2 text-[12px]"
                                  onClick={() => createBranch(task)}
                                  disabled={busy === `branch-${task.id}` || !repo}
                                  title={repo ? 'Create this branch on GitHub' : 'Choose a repo first'}
                                >
                                  {busy === `branch-${task.id}` ? <Spinner className="h-3 w-3" /> : <GitBranch className="h-3 w-3" />}
                                  Create
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-ghost h-8 px-2 text-[12px]"
                                onClick={() => linkBranch(task)}
                                disabled={busy === `link-${task.id}` || !branchDraft.trim()}
                              >
                                Link
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="label">Pull request</label>
                            <div className="flex gap-1.5">
                              <input
                                className="field h-8 py-0 text-[12px]"
                                placeholder={prUrl ?? 'https://github.com/…/pull/12'}
                                value={prDraft}
                                onChange={(e) => setPrDraft(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn-ghost h-8 px-2 text-[12px]"
                                onClick={() => setPr(task)}
                                disabled={busy === `pr-${task.id}` || !prDraft.trim()}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="label">Work log — what did you do, what is blocking you</label>
                          <div className="flex flex-wrap gap-1.5">
                            <select
                              className="field h-8 w-[110px] py-0 text-[12px]"
                              value={noteKind}
                              onChange={(e) => setNoteKind(e.target.value)}
                            >
                              <option value="note">note</option>
                              <option value="commit">pushed</option>
                              <option value="link">link</option>
                              <option value="blocker">blocked</option>
                              <option value="status">status</option>
                            </select>
                            <input
                              className="field h-8 min-w-[180px] flex-1 py-0 text-[12px]"
                              placeholder="e.g. API returns 401 on refresh — swapping the middleware"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && noteDraft.trim()) addNote(task);
                              }}
                            />
                            <button
                              type="button"
                              className="btn-primary h-8 px-2.5 text-[12px]"
                              onClick={() => addNote(task)}
                              disabled={busy === `note-${task.id}` || !noteDraft.trim()}
                            >
                              {busy === `note-${task.id}` ? <Spinner className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              Log
                            </button>
                          </div>
                        </div>

                        {(notesByTask.get(task.id) ?? []).length > 0 && (
                          <div className="space-y-1 border-t border-slate-900/10 pt-1.5">
                            {(notesByTask.get(task.id) ?? []).slice(0, 4).map((n) => (
                              <div key={n.id} className="flex items-start gap-1.5 text-[12px] leading-snug text-slate-600">
                                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1 text-[10px] uppercase tracking-wide text-slate-600">
                                  {n.kind}
                                </span>
                                <span className="min-w-0 flex-1">
                                  {n.content}
                                  <span className="text-slate-500">
                                    {' '}
                                    · {n.author} · {ago(n.created_at)}
                                  </span>
                                </span>
                                {n.url && (
                                  <a href={n.url} target="_blank" rel="noreferrer noopener" className="shrink-0 text-slate-500 hover:text-slate-900">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!!(build?.commits ?? []).length && (
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
                <GitBranch className="h-3.5 w-3.5 text-slate-700" />
                <h3 className="text-[14px] font-semibold text-slate-900">Recent commits</h3>
                <span className="font-mono text-[11px] text-slate-500">{build?.commitsRepo}</span>
                <span className="text-[12px] text-slate-500">read from GitHub — nobody types these in</span>
              </div>
              <div className="divide-y divide-slate-900/10">
                {(build?.commits ?? []).map((c) => (
                  <a
                    key={c.sha}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 px-4 py-1.5 text-[12px] hover:bg-white/60"
                  >
                    <span className="font-mono text-[11px] text-slate-500">{c.short}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{c.message}</span>
                    <span className="text-slate-500">{c.author ?? ''}</span>
                    <span className="text-slate-500">{c.date ? ago(c.date) : ''}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* recent activity */}
          <div className="panel overflow-hidden">
            <div className="border-b border-slate-900/15 px-4 py-2.5">
              <h3 className="text-[14px] font-semibold text-slate-900">Work log across the room</h3>
            </div>
            <div className="divide-y divide-slate-900/10">
              {(build?.notes ?? []).slice(0, 12).map((n) => (
                <div key={n.id} className="flex items-start gap-2 px-4 py-2 text-[12px]">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold uppercase tracking-wide ${
                      n.kind === 'blocker' ? 'bg-rose-100 text-rose' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {n.kind}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-700">
                    {n.content}
                    <span className="text-slate-500">
                      {' '}
                      · {n.author} · {ago(n.created_at)}
                    </span>
                  </span>
                </div>
              ))}
              {!(build?.notes ?? []).length && (
                <p className="px-4 py-3 text-[13px] text-slate-600">
                  Nothing logged yet. The first note is the difference between a plan and progress.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------- connections */}
      {tab === 'connections' && (
        <>
          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-700" />
              <h3 className="text-[14px] font-semibold text-slate-900">Attach your access</h3>
              <span className="text-[12px] text-slate-500">
                Each person connects their own accounts. Nobody — including the owner — can read a secret back.
              </span>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[190px_1fr_auto]">
              <div>
                <label className="label">Service</label>
                <select className="field h-9 py-0" value={provider} onChange={(e) => setProvider(e.target.value)}>
                  {PROVIDERS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  {providerInfo(provider).secretLabel}
                  <button type="button" className="ml-2 text-[11px] uppercase tracking-wide text-slate-500 underline" onClick={() => setShowSecret((v) => !v)}>
                    {showSecret ? 'hide' : 'show while typing'}
                  </button>
                </label>
                <input
                  className="field h-9 py-0 font-mono text-[12px]"
                  type={showSecret ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={providerInfo(provider).placeholder}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary h-9 px-3"
                  onClick={saveCredential}
                  disabled={busy === 'save-cred' || secret.trim().length < 8}
                >
                  {busy === 'save-cred' ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  Save encrypted
                </button>
              </div>
            </div>

            <div className="mt-2 grid gap-1.5 text-[12px] text-slate-600 md:grid-cols-2">
              <p>
                <strong className="font-medium text-slate-800">{providerInfo(provider).name}:</strong>{' '}
                {providerInfo(provider).hint}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                {providerInfo(provider).free && <span className="chip h-6">{providerInfo(provider).free}</span>}
                {providerInfo(provider).docs && (
                  <a href={providerInfo(provider).docs} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-slate-700 underline decoration-slate-300 underline-offset-2">
                    where to get it <ArrowUpRight className="h-2.5 w-2.5" />
                  </a>
                )}
                {providerInfo(provider).check === 'none' && (
                  <span className="text-slate-500">No live check available — it is stored and marked unverified.</span>
                )}
              </p>
            </div>
            {!creds?.vault.strong && (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
                Vault key is the development default. Set <code className="font-mono">AUTH_SECRET</code> (or{' '}
                <code className="font-mono">CREDENTIAL_SECRET</code>) on the deployment before the team stores real tokens.
              </p>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-900/15 px-4 py-2.5">
              <h3 className="text-[14px] font-semibold text-slate-900">My connections</h3>
            </div>
            <div className="divide-y divide-slate-900/10">
              {(creds?.mine ?? []).map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <span className="text-[13px] font-medium text-slate-900">{providerInfo(c.provider).name}</span>
                  <span className="font-mono text-[12px] text-slate-500">{c.hint || '••••'}</span>
                  <Pill tone={STATUS_TONE[c.status] ?? 'slate'}>{c.status}</Pill>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600">{c.detail}</span>
                  <span className="text-[11px] text-slate-500">checked {ago(c.last_checked)}</span>
                  <button
                    type="button"
                    className="btn-danger h-7 px-2 text-[12px]"
                    onClick={() => removeCredential(c.provider)}
                    disabled={busy === `del-${c.provider}`}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              ))}
              {!(creds?.mine ?? []).length && (
                <p className="px-4 py-3 text-[13px] text-slate-600">
                  Nothing attached yet. GitHub is the one that changes what you can do here — the rest is optional.
                </p>
              )}
            </div>
          </div>

          {!!creds?.canAdmin && (
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
                <h3 className="text-[14px] font-semibold text-slate-900">Owner view — who is connected</h3>
                <span className="text-[12px] text-slate-500">Status only. Secrets are never shown, not even to you.</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-900/10 text-left text-[11px] uppercase tracking-[.08em] text-slate-500">
                    <th className="px-4 py-1.5 font-semibold">Person</th>
                    <th className="px-2 py-1.5 font-semibold">Seat</th>
                    <th className="px-2 py-1.5 font-semibold">Connected</th>
                    <th className="px-2 py-1.5 font-semibold">Services</th>
                    <th className="px-4 py-1.5 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {(creds.coverage ?? []).map((c) => (
                    <tr key={c.user_id} className="border-b border-slate-900/5">
                      <td className="px-4 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={c.name} size={18} /> {c.name}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{c.role}</td>
                      <td className="px-2 py-1.5 tnum text-slate-700">
                        {c.connected}/{c.saved}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{c.providers.join(', ') || '—'}</td>
                      <td className="px-4 py-1.5">
                        {c.blocked ? (
                          <Pill tone="rose">needs attention</Pill>
                        ) : c.saved ? (
                          <Pill tone="mint">ok</Pill>
                        ) : (
                          <Pill tone="amber">not connected</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------------------- team */}
      {tab === 'team' && <LiveStatus code={code} stageNames={stageNames} />}
    </div>
  );
}
