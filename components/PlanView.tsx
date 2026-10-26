'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleDashed, FileText, Flag,
  RefreshCw, Target, User, Users,
} from 'lucide-react';
import type { Project, StageKey } from '@/lib/types';
import { Pill, Spinner, StageIcon } from './ui';

interface Criterion {
  id: string;
  label: string;
  met: boolean;
  evidence: string;
  kind: string;
  manual: boolean;
  owner: string;
}
interface StagePlan {
  key: StageKey;
  name: string;
  tagline: string;
  state: 'open' | 'in_progress' | 'met';
  criteria: Criterion[];
  met: number;
  total: number;
  pct: number;
  docs: { kind: string; title: string; filled: boolean; status: string }[];
  tasks: { total: number; open: number; overdue: number; unowned: number };
}
interface Action {
  title: string;
  why: string;
  kind: 'doc' | 'stage' | 'task' | 'gate' | 'problem';
  stage?: string;
  docKind?: string;
  taskId?: string;
  criterion?: string;
  urgent?: boolean;
}
interface Lane {
  role: string;
  label: string;
  headline: string;
  actions: Action[];
  openTasks: number;
  overdue: number;
  members: string[];
  unstaffed: boolean;
}
interface Plan {
  readiness: {
    score: number;
    launchable: boolean;
    blocking: { stage: string; stageName: string; label: string; owner: string }[];
    missingStages: { key: string; name: string; met: number; total: number }[];
    daysToLaunch: number | null;
    launchDate: string | null;
  };
  stages: StagePlan[];
  lanes: Lane[];
  rhythm: { when: string; what: string; who: string }[];
  board: { total: number; open: number; unowned: number; overdue: number; inReview: number };
  canEdit: boolean;
  me: string;
}

const ROLE_ALIAS: Record<string, string> = { product: 'pm', pm: 'pm' };

export default function PlanView({
  code,
  project,
  stagesMeta,
  me,
  onGotoStage,
  onOpenDoc,
  onClaimTask,
  onRefreshRoom,
}: {
  code: string;
  project: Project;
  stagesMeta: { key: StageKey; name: string; icon: string; color: string }[];
  me: { name: string; role: string; canEdit: boolean };
  onGotoStage: (key: StageKey) => void;
  onOpenDoc: (kind: string) => void;
  onClaimTask: (id: string) => void;
  onRefreshRoom: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lane, setLane] = useState<string>(ROLE_ALIAS[me.role] ?? me.role);
  const [dateDraft, setDateDraft] = useState('');

  const load = useCallback(
    async (announce = false) => {
      setBusy('load');
      try {
        const res = await fetch(`/api/plan?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load the plan.');
        setPlan(data);
        setDateDraft(data.readiness.launchDate ?? '');
        if (announce) onRefreshRoom();
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [code, onRefreshRoom],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setPlan(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (stage: string, criterion: string, value: boolean) =>
    act({ action: 'gate', stage, criterion, value }, `gate:${criterion}`);

  const saveDate = () => act({ action: 'launch_date', launchDate: dateDraft }, 'date');

  const current = useMemo(
    () => plan?.stages.find((s) => s.key === project.stage_key) ?? plan?.stages[0] ?? null,
    [plan, project.stage_key],
  );
  const activeLane = plan?.lanes.find((l) => l.role === lane) ?? plan?.lanes[0] ?? null;

  return (
    <div className="scroll-thin flex h-full min-h-0 flex-col overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">{error}</div>
        )}

        {/* readiness */}
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <Flag className="h-4 w-4 text-slate-500" />
            <h2 className="text-[16px] font-semibold text-slate-900">Launch readiness</h2>
            <Pill tone={plan?.readiness.launchable ? 'mint' : 'slate'}>
              {plan ? `${plan.readiness.score}% of gates cleared` : '…'}
            </Pill>
            {plan?.readiness.launchable && <Pill tone="mint">launchable</Pill>}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-[.08em] text-slate-500" htmlFor="launch-date">
                Launch date
              </label>
              <input
                id="launch-date"
                type="date"
                className="field h-8 w-[140px] py-0"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                disabled={!plan?.canEdit}
              />
              <button
                type="button"
                className="btn-ghost h-8 px-2"
                onClick={saveDate}
                disabled={!plan?.canEdit || busy === 'date' || dateDraft === (plan?.readiness.launchDate ?? '')}
              >
                {busy === 'date' ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className="btn-subtle h-8 px-2" onClick={() => load(true)} disabled={busy === 'load'}>
                {busy === 'load' ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-3 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-[30px] font-semibold leading-none text-slate-900">
                  {plan?.readiness.score ?? 0}%
                </span>
                <span className="text-[13px] text-slate-500">
                  of every gate up to and including launch
                  {plan?.readiness.daysToLaunch != null && (
                    <>
                      {' · '}
                      {plan.readiness.daysToLaunch >= 0
                        ? `${plan.readiness.daysToLaunch} day${plan.readiness.daysToLaunch === 1 ? '' : 's'} to the date you set`
                        : `${Math.abs(plan.readiness.daysToLaunch)} days past the date you set`}
                    </>
                  )}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${plan?.readiness.launchable ? 'bg-emerald-600' : 'bg-electric'}`}
                  style={{ width: `${plan?.readiness.score ?? 0}%` }}
                />
              </div>
              {plan?.readiness.missingStages.length ? (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
                    Stages still open
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.readiness.missingStages.map((s) => (
                      <button key={s.key} type="button" onClick={() => onGotoStage(s.key as StageKey)} className="chip">
                        {s.name}
                        <span className="tnum text-slate-500">{s.met}/{s.total}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Every gate before launch is cleared.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-slate-900/20 bg-white/60 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
                <AlertTriangle className="h-3 w-3 text-amber" /> What is blocking launch
              </div>
              {plan?.readiness.blocking.length ? (
                <ol className="space-y-1.5">
                  {plan.readiness.blocking.map((b) => (
                    <li key={`${b.stage}-${b.label}`} className="text-[12px] leading-snug text-slate-700">
                      <button
                        type="button"
                        onClick={() => onGotoStage(b.stage as StageKey)}
                        className="text-left hover:text-slate-900"
                      >
                        <span className="font-medium">{b.stageName}:</span> {b.label}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12px] text-slate-600">Nothing. Ship it, then start the Grow loop.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-2 text-[12px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-slate-400" /> {plan?.board.open ?? 0} open task{plan?.board.open === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" /> {plan?.board.unowned ?? 0} unowned
            </span>
            <span className={`inline-flex items-center gap-1 ${plan?.board.overdue ? 'text-rose' : ''}`}>
              <CalendarDays className="h-3 w-3" /> {plan?.board.overdue ?? 0} overdue
            </span>
            <span className="inline-flex items-center gap-1">{plan?.board.inReview ?? 0} in review</span>
            <span className="ml-auto text-slate-500">Stage gates update as the room changes.</span>
          </div>
        </div>

        {/* role lanes */}
        <div className="panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-[16px] font-semibold text-slate-900">Who does what next</h2>
            <span className="text-[12px] text-slate-500">Read-only seats can still see the whole plan.</span>
          </div>
          <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
            {(plan?.lanes ?? []).map((l) => (
              <button
                key={l.role}
                type="button"
                onClick={() => setLane(l.role)}
                className={`tab shrink-0 ${lane === l.role ? 'tab-active' : ''}`}
              >
                {l.label}
                {l.role === (ROLE_ALIAS[me.role] ?? me.role) && <span className="text-[11px] text-electric">you</span>}
                {l.unstaffed && <span className="text-[11px] text-amber-800">no one</span>}
                <span className="tnum text-slate-500">{l.actions.length}</span>
              </button>
            ))}
          </div>
          {activeLane && (
            <div className="px-4 py-3">
              <p className="text-[13px] leading-relaxed text-slate-600">{activeLane.headline}</p>
              <div className="mb-2 mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                {activeLane.members.length ? (
                  <span>
                    Covered by <strong className="font-medium text-slate-700">{activeLane.members.join(', ')}</strong>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                    <User className="h-3 w-3" /> No one holds this seat — assign it before the next gate
                  </span>
                )}
                <span className="text-slate-300">·</span>
                <span>{activeLane.openTasks} open task{activeLane.openTasks === 1 ? '' : 's'}</span>
                {activeLane.overdue > 0 && <span className="text-rose">· {activeLane.overdue} late</span>}
              </div>
              <div className="mt-2.5 space-y-1.5">
                {activeLane.actions.map((a) => (
                  <div key={`${a.kind}-${a.title}`} className="flex items-start gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
                    <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full ${a.urgent ? 'bg-rose-100 text-rose' : 'bg-slate-100 text-slate-500'}`}>
                      {a.kind === 'doc' ? <FileText className="h-2.5 w-2.5" /> : <ArrowRight className="h-2.5 w-2.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-snug text-slate-800">{a.title}</div>
                      <div className="text-[11px] text-slate-500">{a.why}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.kind === 'doc' && a.docKind && (
                        <button type="button" className="btn-ghost h-7 px-2 text-[11px]" onClick={() => onOpenDoc(a.docKind as string)}>
                          Open doc
                        </button>
                      )}
                      {a.kind === 'gate' && a.criterion && plan?.canEdit && (
                        <button
                          type="button"
                          className="btn-ghost h-7 px-2 text-[11px]"
                          onClick={() => toggle(a.stage as string, a.criterion as string, true)}
                          disabled={busy === `gate:${a.criterion}`}
                        >
                          <Check className="h-3 w-3" /> Confirm
                        </button>
                      )}
                      {a.kind === 'task' && a.taskId && (
                        <button
                          type="button"
                          className="btn-ghost h-7 px-2 text-[11px]"
                          onClick={() => onClaimTask(a.taskId as string)}
                        >
                          {a.title.startsWith('Take:') ? 'Claim' : 'Open'}
                        </button>
                      )}
                      {(a.kind === 'stage' || (!a.docKind && !a.taskId && !a.criterion)) && a.stage && (
                        <button type="button" className="btn-ghost h-7 px-2 text-[11px]" onClick={() => onGotoStage(a.stage as StageKey)}>
                          Open stage
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!activeLane.actions.length && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[12px] text-emerald-800">
                    <CheckCircle2 className="mr-1 inline h-3 w-3" /> Nothing on this seat right now.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* stage gates */}
        <div className="panel">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-[16px] font-semibold text-slate-900">Stage gates</h2>
            <span className="text-[12px] text-slate-500">
              A stage is finished when its criteria are met, not when the checklist is ticked.
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {(plan?.stages ?? []).map((s) => {
              const meta = stagesMeta.find((m) => m.key === s.key);
              const isCurrent = s.key === project.stage_key;
              return (
                <details key={s.key} className="group px-4 py-2.5" open={isCurrent}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-900/20 bg-white/60 text-slate-600">
                      <StageIcon name={meta?.icon ?? 'Compass'} className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[13px] font-semibold text-slate-900">{s.name}</span>
                    {isCurrent && <Pill tone="electric">current</Pill>}
                    <Pill tone={s.state === 'met' ? 'mint' : s.state === 'in_progress' ? 'amber' : 'slate'}>
                      {s.met}/{s.total} · {s.pct}%
                    </Pill>
                    {s.tasks.overdue > 0 && <Pill tone="rose">{s.tasks.overdue} overdue</Pill>}
                    <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
                      {s.tasks.open} open · {s.docs.filter((d) => d.filled).length}/{s.docs.length} docs written
                    </span>
                  </summary>

                  <div className="mt-2 grid gap-2 pl-8 md:grid-cols-2">
                    {s.criteria.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <button
                          type="button"
                          disabled={!c.manual || !plan?.canEdit || busy === `gate:${c.id}`}
                          onClick={() => toggle(s.key, c.id, !c.met)}
                          title={c.manual ? 'Tick when a human has confirmed this' : 'Read from the room — cannot be ticked by hand'}
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                            c.met
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : c.manual
                                ? 'border-slate-400 bg-white text-transparent hover:border-slate-600'
                                : 'border-slate-200 bg-slate-100 text-transparent'
                          } ${!c.manual ? 'cursor-default' : ''}`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </button>
                        <div className="min-w-0">
                          <div className={`text-[12px] leading-snug ${c.met ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                            {c.label}
                          </div>
                          <div className="text-[11px] text-slate-500">{c.evidence}</div>
                        </div>
                      </div>
                    ))}
                    {!s.criteria.length && (
                      <p className="text-[12px] text-slate-500">No criteria yet — add them in the owner console.</p>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                    <button type="button" className="btn-subtle h-7 px-2 text-[11px]" onClick={() => onGotoStage(s.key)}>
                      <CircleDashed className="h-3 w-3" /> Open {s.name}
                    </button>
                    {s.docs.filter((d) => !d.filled).slice(0, 2).map((d) => (
                      <button
                        key={d.kind}
                        type="button"
                        className="chip text-[11px]"
                        onClick={() => onOpenDoc(d.kind)}
                      >
                        <FileText className="h-2.5 w-2.5" /> {d.title} is empty
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {/* rhythm */}
        <div className="panel p-4">
          <h2 className="text-[16px] font-semibold text-slate-900">Operating rhythm</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            The sequence that keeps a small team moving without another status meeting.
          </p>
          <div className="mt-2.5 divide-y divide-slate-100">
            {(plan?.rhythm ?? []).map((r) => (
              <div key={r.when} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <span className="w-[118px] shrink-0 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
                  {r.when}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-slate-700">{r.what}</span>
                <span className="text-[11px] text-slate-500">{r.who}</span>
              </div>
            ))}
          </div>
        </div>

        {!plan?.canEdit && (
          <p className="px-1 text-[11px] text-slate-500">
            Only people with edit access can tick manual criteria or set the launch date. Everything else is visible to the
            whole team.
          </p>
        )}
      </div>
    </div>
  );
}
