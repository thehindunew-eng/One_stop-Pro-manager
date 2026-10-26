'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, Check, Copy, Cpu, Gauge, GitBranch, Play, RefreshCw, ShieldAlert, ShieldCheck,
  Sparkles, Trash2, X,
} from 'lucide-react';
import { api, post } from '@/lib/client';
import { Pill, Spinner } from './ui';

interface Citation {
  source: string;
  ref: string;
  detail: string;
}

interface FindingRow {
  id: string;
  kind: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  target: string;
  task_id: string | null;
  message: string;
  action: string;
  confidence: number;
  citations: Citation[];
  status: 'open' | 'acknowledged' | 'dismissed' | 'actioned';
  engine: string;
  prompt_version: string;
  confirmed_by: string | null;
  created_at: string;
}

interface GuardData {
  settings: { enabled: boolean; strict: boolean; maxPerPersonPerDay: number; maxRunsPerDay: number; digest: string };
  promptVersion: string;
  engine: { engine: string; live: boolean; provider: string | null; model: string | null };
  findings: FindingRow[];
  narrative: string;
  lastRun: { created_at: string; engine: string; kept: number } | null;
  runsToday?: number;
  runsLeft?: number;
  repo: string | null;
  canEdit: boolean;
  me: { name: string; id: string };
}

const SEV: Record<string, { label: string; cls: string }> = {
  HIGH: { label: 'High', cls: 'border-rose-300 text-rose' },
  MEDIUM: { label: 'Medium', cls: 'border-amber-300 text-amber-800' },
  LOW: { label: 'Low', cls: 'border-slate-300 text-slate-600' },
};

const KIND_ICON: Record<string, any> = {
  CONFLICT: GitBranch,
  DEVIATION: ShieldAlert,
  VELOCITY: Gauge,
  GATE: BadgeCheck,
  SUGGESTION: Sparkles,
};

const ago = (iso: string | null): string => {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * The AI PM's console.
 *
 * Read-only for the team, actionable for whoever the finding is about or the
 * owner. Every action here is a human decision written into the room; the
 * panel says so instead of implying the agent did it.
 */
export default function GuardPanel({
  code,
  repo,
  onToast,
}: {
  code: string;
  repo?: string | null;
  onToast: (m: string) => void;
}) {
  const [data, setData] = useState<GuardData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api<GuardData>(
        `/api/aipm?code=${encodeURIComponent(code)}${repo ? `&repo=${encodeURIComponent(repo)}` : ''}`,
      );
      setData(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [code, repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (roomOnly: boolean) => {
    setBusy(roomOnly ? 'room' : 'model');
    setError(null);
    try {
      const result = await post<{ found: number; kept: number; suppressed: number; duplicates: number; roomOnly: boolean }>(
        '/api/aipm',
        { code, action: 'run', roomOnly, repo },
      );
      await load();
      onToast(
        `${result.found} finding${result.found === 1 ? '' : 's'} · ${result.kept} new` +
          (result.suppressed ? ` · ${result.suppressed} held by the noise budget` : '') +
          (result.roomOnly ? ' · room data only' : ''),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, action: 'confirm' | 'acknowledge' | 'dismiss') => {
    setBusy(id);
    setError(null);
    try {
      await post('/api/aipm', { code, action, findingId: id, createTask: true, note: true });
      await load();
      onToast(action === 'confirm' ? 'Turned into a board task, with your name on it' : `Finding ${action}d`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown = (data?.findings ?? []).filter((f) => (filter === 'open' ? f.status === 'open' : true));
  const counts = {
    high: shown.filter((f) => f.severity === 'HIGH').length,
    medium: shown.filter((f) => f.severity === 'MEDIUM').length,
    low: shown.filter((f) => f.severity === 'LOW').length,
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="panel flex items-center gap-2 border-rose-300 bg-rose-50/80 p-3 text-[13px] text-rose">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[12px] underline">
            dismiss
          </button>
        </div>
      )}

      {/* header */}
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          <h2 className="text-[16px] font-semibold text-slate-900">AI PM guard</h2>
          <Pill tone={data?.engine.live ? 'mint' : 'slate'}>
            <Cpu className="h-2.5 w-2.5" /> {data?.engine.engine ?? '…'}
          </Pill>
          {data?.settings.strict && <Pill tone="amber">strict architecture</Pill>}
          <span className="hidden text-[12px] text-slate-500 md:inline">
            {data?.settings.enabled === false
              ? 'Switched off for this room.'
              : 'Overlap, spec drift, stalls and gate order — checked against the room, the plan and your repo.'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {data?.canEdit && data.settings.enabled !== false && (
              <>
                <button type="button" className="btn-ghost h-7 px-2 text-[12px]" onClick={() => run(true)} disabled={!!busy}>
                  {busy === 'room' ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3" />} Run (room only)
                </button>
                <button
                  type="button"
                  className="btn-primary h-7 px-2 text-[12px]"
                  onClick={() => run(false)}
                  disabled={!!busy}
                  title={data?.engine.live ? 'Guards plus the model' : 'No model configured — this runs the room-only guards'}
                >
                  {busy === 'model' ? <Spinner className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />} Run guards
                </button>
              </>
            )}
            <button type="button" className="btn-ghost h-7 px-2" onClick={() => void load()} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12px] text-slate-600">
          <button type="button" onClick={() => setFilter('open')} className={`tab h-7 ${filter === 'open' ? 'tab-active' : ''}`}>
            Open <span className="tnum text-slate-500">{data?.findings.filter((f) => f.status === 'open').length ?? 0}</span>
          </button>
          <button type="button" onClick={() => setFilter('all')} className={`tab h-7 ${filter === 'all' ? 'tab-active' : ''}`}>
            Everything <span className="tnum text-slate-500">{data?.findings.length ?? 0}</span>
          </button>
          <span className="text-rose">{counts.high} high</span>
          <span className="text-amber-800">{counts.medium} medium</span>
          <span className="text-slate-500">{counts.low} low</span>
          <span className="ml-auto text-slate-500">
            prompt <span className="font-mono text-[11px]">{data?.promptVersion ?? '—'}</span> · last run {ago(data?.lastRun?.created_at ?? null)}
            {typeof data?.runsLeft === 'number' && data.settings.maxRunsPerDay ? (
              <> · <span className="tnum">{data.runsLeft}</span> of{' '}
              <span className="tnum">{data.settings.maxRunsPerDay}</span> runs left today</>
            ) : null}
          </span>
        </div>
      </div>

      {/* findings */}
      {!shown.length && (
        <div className="panel p-4 text-[13px] leading-relaxed text-slate-600">
          <strong className="text-slate-900">Nothing open.</strong> Either the room is clean or the guards have not run
          yet — press <em>Run (room only)</em> for what can be proven without a model.
        </div>
      )}

      {shown.map((f) => {
        const Icon = KIND_ICON[f.kind] ?? Sparkles;
        const sev = SEV[f.severity] ?? SEV.LOW;
        const mine = f.target === data?.me.name || data?.canEdit;
        return (
          <div key={f.id} className={`panel overflow-hidden ${f.status !== 'open' ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2">
              <Icon className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[12px] font-semibold uppercase tracking-[.06em] text-slate-700">{f.kind}</span>
              <span className={`chip h-6 ${sev.cls}`}>{sev.label}</span>
              <span className="text-[12px] text-slate-600">for {f.target || 'the room'}</span>
              {f.status !== 'open' && <Pill tone="slate">{f.status}</Pill>}
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-slate-700" style={{ width: `${Math.round(f.confidence * 100)}%` }} />
                </span>
                <span className="tnum">{Math.round(f.confidence * 100)}%</span>
              </span>
            </div>

            <div className="px-4 py-2.5">
              <p className="text-[13px] leading-relaxed text-slate-800">{f.message}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                <strong className="font-medium text-slate-800">Next:</strong> {f.action}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {f.citations.map((c) => (
                  <span key={`${c.source}-${c.ref}`} className="chip h-6 max-w-full gap-1 text-[11px]" title={c.detail}>
                    <span className="uppercase tracking-wide text-slate-500">{c.source}</span>
                    <span className="truncate font-mono">{c.ref}</span>
                  </span>
                ))}
                {f.confirmed_by && <span className="text-[11px] text-slate-500">closed by {f.confirmed_by}</span>}
              </div>

              {f.status === 'open' && mine && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="btn-primary h-7 px-2 text-[12px]"
                    onClick={() => act(f.id, 'confirm')}
                    disabled={busy === f.id}
                    title="Creates a board task from this suggestion and logs it on the task. Nothing is written to GitHub."
                  >
                    {busy === f.id ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />} Act on it
                  </button>
                  <button type="button" className="btn-ghost h-7 px-2 text-[12px]" onClick={() => act(f.id, 'acknowledge')} disabled={busy === f.id}>
                    <Check className="h-3 w-3" /> Seen
                  </button>
                  <button type="button" className="btn-ghost h-7 px-2 text-[12px] text-slate-600" onClick={() => act(f.id, 'dismiss')} disabled={busy === f.id}>
                    <X className="h-3 w-3" /> Not true
                  </button>
                  <span className="text-[11px] text-slate-500">A person decides — the guard cannot change the repo or the board by itself.</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* digest */}
      {!!data?.narrative && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
            <h3 className="text-[14px] font-semibold text-slate-900">Governance digest</h3>
            <span className="text-[12px] text-slate-500">The version a lead PM reads — trajectory, blockers, spec gaps.</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost h-7 px-2 text-[12px]"
                onClick={() => {
                  void navigator.clipboard?.writeText(data.narrative);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <a href={`/api/export?code=${code}`} className="btn-ghost h-7 px-2 text-[12px]">
                Full pack
              </a>
            </div>
          </div>
          <pre className="scroll-thin overflow-x-auto whitespace-pre-wrap px-4 py-3 font-sans text-[12.5px] leading-relaxed text-slate-700">
            {data.narrative}
          </pre>
        </div>
      )}

      <div className="panel px-4 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
        <strong className="text-slate-700">What this cannot see:</strong>{' '}
        {data?.engine.live ? '' : 'it is running without a model, so only arithmetic findings exist. '}
        No editor buffers, no test output, no deploy logs — and repository checks need the member&apos;s own GitHub token.
        Anything you mark <code className="rounded bg-white px-1 font-mono">@aipm-ignore</code> in a note is stripped
        before it is read, and credentials are never part of the context.
      </div>
    </div>
  );
}
