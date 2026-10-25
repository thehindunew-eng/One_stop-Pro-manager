'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Bell, Check, ChevronDown, Download, LayoutDashboard, LogOut, MessagesSquare,
  Share2, ShieldCheck, Sparkles, Target, Users, Zap, X,
} from 'lucide-react';
import type { Artifact, Message, ProblemStatement, Project, Signal, StageKey, WorkspaceState } from '@/lib/types';
import { api, post, timeAgo } from '@/lib/client';
import { Avatar, CopyButton, Pill, Spinner, StageIcon, ToolIcon, Wordmark } from './ui';
import MeetingRoom from './MeetingRoom';
import StageView from './StageView';
import SignalRail from './SignalRail';
import PrimePanel from './PrimePanel';
import { ProblemModal, ProblemPanel } from './ProblemPanel';

type View = 'meeting' | 'stage';

export default function Workspace({ initialState }: { initialState: WorkspaceState }) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [view, setView] = useState<View>('meeting');
  const [stageKey, setStageKey] = useState<StageKey>(initialState.project.stage_key);
  const [analyzing, setAnalyzing] = useState(false);
  const [primeOpen, setPrimeOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [mobileContext, setMobileContext] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<{ code: string; name: string; stage: string }[]>([]);
  const pollRef = useRef<number | null>(null);

  const { project, me, members, messages, signals, artifacts, tasks, tools, stages, ai } = state;
  const stage = stages.find((s) => s.key === stageKey) ?? stages[0];
  const currentStage = stages.find((s) => s.key === project.stage_key) ?? stages[0];

  useEffect(() => {
    setMounted(true);
    setShareUrl(`${window.location.origin}/room/${project.code}`);
    document.title = `${project.name} · One Stop Pro Manager`;
  }, [project.code, project.name]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const next = await api<WorkspaceState>(`/api/workspace?code=${project.code}`);
      setState((prev) => ({
        ...next,
        // never clobber a doc that is being edited in another tab of this session
        artifacts: next.artifacts.length ? next.artifacts : prev.artifacts,
      }));
    } catch {
      /* offline: keep what we have */
    }
  }, [project.code]);

  // light-touch live collaboration
  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !analyzing && !primeOpen && !problemOpen) refresh();
    }, 14000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refresh, analyzing, primeOpen, problemOpen]);

  const analyze = useCallback(async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await post<{ problem: ProblemStatement; signals: Signal[]; artifacts: Artifact[]; engine: string }>('/api/analyze', {
        code: project.code,
      });
      setState((s) => ({ ...s, problem: res.problem, signals: res.signals, artifacts: res.artifacts }));
      void refresh();
      setToast(`Problem statement updated · ${res.problem.confidence}% confidence`);
    } catch (e) {
      setError((e as Error).message);
      setMobileContext(false);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, project.code, refresh]);

  const selectStage = useCallback(async (key: StageKey) => {
    setStageKey(key);
    setView('stage');
  }, []);

  const appendMessage = (m: Message) => setState((s) => ({ ...s, messages: [...s.messages, m] }));

  const nextTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.priority === b.priority ? 0 : a.priority < b.priority ? -1 : 1)),
    [tasks],
  );
  const doneRatio = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
  }, [tasks]);
  const online = mounted
    ? members.filter((m) => m.last_seen && Date.now() - new Date(m.last_seen).getTime() < 6 * 60 * 1000)
    : [];

  useEffect(() => {
    if (!menuOpen) return;
    api<{ projects: { code: string; name: string; stage: string }[] }>('/api/me')
      .then((res) => setRooms(res.projects ?? []))
      .catch(() => setRooms([]));
  }, [menuOpen]);

  async function logout() {
    await post('/api/auth/logout', {});
    window.location.href = '/';
  }

  return (
    <div className="app-bg flex h-[100dvh] flex-col overflow-hidden">
      {/* top bar */}
      <header className="z-30 border-b border-white/[0.07] bg-ink-900/70 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <Link href="/" className="shrink-0" title="Home">
            <Wordmark compact />
          </Link>
          <div className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[13px] font-semibold text-white">{project.name}</h1>
              <span className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500 sm:inline">
                /room/{project.code}
              </span>
              <Pill tone="electric" className="hidden md:inline-flex">
                <StageIcon name={currentStage.icon} className="h-2.5 w-2.5" /> {currentStage.name}
              </Pill>
            </div>
            <p className="truncate text-[10.5px] text-slate-500">{project.tagline || 'One room, one thread, one launch.'}</p>
          </div>

          <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-ink-800/70 p-0.5 md:flex">
            <button
              type="button"
              onClick={() => setView('meeting')}
              className={`tab ${view === 'meeting' ? 'tab-active' : ''}`}
            >
              <MessagesSquare className="h-3.5 w-3.5" /> Meeting
            </button>
            <button
              type="button"
              onClick={() => setView('stage')}
              className={`tab ${view === 'stage' ? 'tab-active' : ''}`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Lifecycle
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center -space-x-1.5 lg:flex">
              {online.slice(0, 4).map((m) => (
                <div key={m.user_id} className="relative" title={`${m.name} · ${m.role} (online)`}>
                  <Avatar name={m.name} size={26} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-mint ring-2 ring-ink-900" />
                </div>
              ))}
              {members.length > 4 && (
                <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white/[0.08] text-[9.5px] font-semibold text-slate-300 ring-2 ring-ink-900">
                  +{members.length - 4}
                </div>
              )}
            </div>
            <div className="hidden sm:block">
              <CopyButton value={shareUrl} label="Invite" className="!px-2.5 !py-1.5 !text-[11.5px]" />
            </div>
            <button type="button" className="btn-primary px-2.5 py-1.5 text-[11.5px]" onClick={() => setPrimeOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask Prime</span>
            </button>
            {me.canAdmin && (
              <Link href={`/room/${project.code}/admin`} className="btn-ghost px-2 py-1.5 text-[11.5px]" title="Owner console">
                <ShieldCheck className="h-3.5 w-3.5" /> <span className="hidden md:inline">Owner</span>
              </Link>
            )}
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg px-1 py-1 hover:bg-white/[0.06]">
                <Avatar name={me.name} size={26} />
                <ChevronDown className="hidden h-3 w-3 text-slate-500 sm:block" />
              </button>
              {menuOpen && (
                <div className="panel scroll-thin absolute right-0 top-10 z-40 max-h-[72vh] w-60 overflow-y-auto p-2" onMouseLeave={() => setMenuOpen(false)}>
                  <div className="border-b border-white/[0.07] px-2 py-1.5">
                    <div className="text-[12px] font-semibold text-white">{me.name}</div>
                    <div className="text-[10.5px] text-slate-500">{me.role} · {me.isAdmin ? 'platform admin' : 'member'}</div>
                  </div>
                  <div className="px-2 py-1.5 text-[10.5px] text-slate-500">
                    Engine: {ai.engine}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(shareUrl)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-slate-300 hover:bg-white/[0.05]"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Copy invite link
                  </button>
                  <a
                    href={`/api/export?code=${project.code}`}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-slate-300 hover:bg-white/[0.05]"
                  >
                    <Download className="h-3.5 w-3.5" /> Download product pack
                  </a>
                  {me.canAdmin && (
                    <Link
                      href={`/room/${project.code}/admin`}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-slate-300 hover:bg-white/[0.05]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Owner console
                    </Link>
                  )}
                  <div className="mt-1 border-t border-white/[0.07] px-2 pb-1 pt-2 text-[9.5px] uppercase tracking-[0.14em] text-slate-600">
                    My rooms
                  </div>
                  {rooms.slice(0, 5).map((r) => (
                    <Link
                      key={r.code}
                      href={`/room/${r.code}`}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] ${
                        r.code === project.code ? 'text-white' : 'text-slate-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${r.code === project.code ? 'bg-mint' : 'bg-slate-600'}`} />
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-slate-600">{r.stage}</span>
                    </Link>
                  ))}
                  <Link
                    href="/join?create=1"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-electric-soft hover:bg-white/[0.05]"
                  >
                    + New product room
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-slate-400 hover:bg-rose/10 hover:text-rose"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Leave (sign out)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* mobile view switch */}
        <div className="flex items-center gap-1 border-t border-white/[0.06] px-3 py-1.5 md:hidden">
          <button type="button" onClick={() => setView('meeting')} className={`tab ${view === 'meeting' ? 'tab-active' : ''}`}>
            <MessagesSquare className="h-3.5 w-3.5" /> Meeting
          </button>
          <button type="button" onClick={() => setView('stage')} className={`tab ${view === 'stage' ? 'tab-active' : ''}`}>
            <LayoutDashboard className="h-3.5 w-3.5" /> Lifecycle
          </button>
          <button type="button" onClick={() => setMobileContext(true)} className="tab ml-auto">
            <Target className="h-3.5 w-3.5" /> Problem
          </button>
        </div>
      </header>

      {(error || toast) && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 px-4">
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] shadow-xl backdrop-blur ${
              error ? 'border-rose/40 bg-rose/15 text-rose' : 'border-mint/35 bg-mint/15 text-mint'
            }`}
          >
            {error ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {error || toast}
            <button type="button" className="ml-1 opacity-60 hover:opacity-100" onClick={() => { setError(null); setToast(null); }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {view === 'meeting' ? (
            <MeetingRoom
              code={project.code}
              messages={messages}
              problem={project.problem}
              signals={signals}
              members={members}
              me={me}
              live={ai.live}
              engine={ai.engine}
              busyAnalyze={analyzing}
              onAnalyze={analyze}
              onAppend={(m) => {
                appendMessage(m);
                void refresh();
              }}
              onAskPrime={() => setPrimeOpen(true)}
              onOpenProblem={() => setProblemOpen(true)}
            />
          ) : (
            <StageView
              code={project.code}
              project={project}
              stages={stages}
              stageKey={stageKey}
              artifacts={artifacts}
              tasks={tasks}
              tools={tools}
              members={members}
              problem={project.problem}
              canEdit={me.canEdit}
              live={ai.live}
              engine={ai.engine}
              onStage={selectStage}
              onArtifacts={(a) => setState((s) => ({ ...s, artifacts: a }))}
              onTasks={(t) => setState((s) => ({ ...s, tasks: t }))}
              onProject={(p) => setState((s) => ({ ...s, project: p }))}
              onManage={() => {
                window.location.href = `/room/${project.code}/admin`;
              }}
              onOpenProblem={() => setProblemOpen(true)}
            />
          )}
        </main>

        {/* context rail */}
        <aside className="hidden w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/[0.07] bg-ink-900/40 p-3 xl:flex scroll-thin">
          <ProblemPanel
            code={project.code}
            problem={project.problem}
            canEdit={me.canEdit}
            busy={analyzing}
            onProblem={(p) => setState((s) => ({ ...s, project: { ...s.project, problem: p } }))}
            onAnalyze={analyze}
            onEdit={() => setProblemOpen(true)}
          />
          <SignalRail code={project.code} signals={signals} onSignals={(sig) => setState((s) => ({ ...s, signals: sig }))} />

          <div className="panel p-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber" />
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-300">Next best action</h3>
              <span className="ml-auto text-[10px] text-slate-500">{doneRatio}% shipped</span>
            </div>
            {nextTasks.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-start gap-2 border-t border-white/[0.05] py-1.5 first:border-0 first:pt-0">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] leading-snug text-slate-300">{t.title}</p>
                  <span className="text-[9px] uppercase tracking-wider text-slate-600">
                    {stages.find((s) => s.key === t.stage_key)?.name} · {t.priority}
                  </span>
                </div>
              </div>
            ))}
            {!nextTasks.length && <p className="text-[11px] text-slate-500">Everything is done. Ship it, then start the next problem.</p>}
            <button type="button" onClick={() => setView('stage')} className="btn-ghost mt-2 w-full py-1.5 text-[10.5px]">
              Open the lifecycle <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="panel p-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-cyan" />
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-300">Team</h3>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" /> {online.length || 1} online
              </span>
            </div>
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2">
                  <Avatar name={m.name} size={22} />
                  <span className="truncate text-[11.5px] text-slate-300">{m.name}</span>
                  {m.user_id === project.owner_id && <ShieldCheck className="h-3 w-3 shrink-0 text-amber" />}
                  <span className="ml-auto shrink-0 rounded bg-white/[0.05] px-1 py-px text-[9px] uppercase tracking-wider text-slate-500">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <CopyButton value={shareUrl} label="Invite" className="flex-1 !py-1.5 !text-[10.5px]" />
            </div>
            <p className="mt-1.5 text-[9.5px] text-slate-600">Anyone with the link can join as a member.</p>
          </div>

          <div className="rounded-xl border border-electric/20 bg-gradient-to-br from-electric/[0.12] to-transparent p-3.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-electric-soft" />
              <span className="text-[11.5px] font-semibold text-white">Prime</span>
              <Pill tone={ai.live ? 'mint' : 'slate'} className="ml-auto">{ai.live ? 'live' : 'local'}</Pill>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
              {ai.live
                ? `Connected to ${ai.provider} · ${ai.model}. Ask about scope, risk, metrics or the next ship.`
                : 'Running the built-in reasoner — no API key needed. Add any provider key to upgrade responses.'}
            </p>
            <button type="button" className="btn-primary mt-2 w-full py-1.5 text-[11px]" onClick={() => setPrimeOpen(true)}>
              Ask Prime <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 pb-2 text-[9.5px] text-slate-600">
            <span className="flex items-center gap-1"><Bell className="h-2.5 w-2.5" /> auto-refresh 14s</span>
            <span>{members.length} members · {signals.length} signals</span>
          </div>
        </aside>
      </div>

      {/* mobile floating problem button */}
      <button
        type="button"
        onClick={() => setMobileContext(true)}
        className="fixed bottom-4 right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-electric to-cyan text-white shadow-glow xl:hidden"
        aria-label="Open problem panel"
      >
        <Target className="h-5 w-5" />
      </button>

      {/* mobile context drawer */}
      {mobileContext && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm xl:hidden" onClick={() => setMobileContext(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-ink-850 p-3 scroll-thin" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-white">Room context</span>
              <button type="button" className="btn-subtle ml-auto p-1" onClick={() => setMobileContext(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <ProblemPanel
                code={project.code}
                problem={project.problem}
                canEdit={me.canEdit}
                busy={analyzing}
                onProblem={(p) => setState((s) => ({ ...s, project: { ...s.project, problem: p } }))}
                onAnalyze={analyze}
                onEdit={() => {
                  setMobileContext(false);
                  setProblemOpen(true);
                }}
              />
              <SignalRail code={project.code} signals={signals} onSignals={(sig) => setState((s) => ({ ...s, signals: sig }))} />
            </div>
          </div>
        </div>
      )}

      {primeOpen && (
        <PrimePanel
          code={project.code}
          engine={ai.engine}
          live={ai.live}
          onClose={() => setPrimeOpen(false)}
          onActivity={() => void refresh()}
        />
      )}

      <ProblemModal
        code={project.code}
        problem={project.problem}
        open={problemOpen}
        canEdit={me.canEdit}
        busy={analyzing}
        onClose={() => setProblemOpen(false)}
        onProblem={(p) => setState((s) => ({ ...s, project: { ...s.project, problem: p } }))}
        onAnalyze={analyze}
        signals={signals}
      />
    </div>
  );
}
