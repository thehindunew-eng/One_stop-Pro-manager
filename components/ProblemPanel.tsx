'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Check, CircleHelp, Pencil, RefreshCw, Save, Sparkles, Target, X } from 'lucide-react';
import type { ProblemStatement, Signal } from '@/lib/types';
import { patch } from '@/lib/client';
import { Pill, Spinner } from './ui';

const LISTS: { key: keyof ProblemStatement; label: string; hint: string }[] = [
  { key: 'users', label: 'Who feels it', hint: 'Segments, roles, people' },
  { key: 'pains', label: 'Pains', hint: 'One pain per line' },
  { key: 'evidence', label: 'Evidence', hint: 'Numbers, quotes, observations' },
  { key: 'assumptions', label: 'Assumptions', hint: 'What we are taking for granted' },
  { key: 'unknowns', label: 'Unknowns', hint: 'Questions that must be answered next' },
  { key: 'successMetrics', label: 'Success metrics', hint: 'How we will know it worked' },
  { key: 'solutionAngles', label: 'Solution angles', hint: 'Ways to attack it (not features)' },
];

export function ProblemPanel({
  code,
  problem,
  canEdit,
  busy,
  onProblem,
  onAnalyze,
  onEdit,
}: {
  code: string;
  problem: ProblemStatement | null;
  canEdit: boolean;
  busy: boolean;
  onProblem: (p: ProblemStatement) => void;
  onAnalyze: () => Promise<void>;
  onEdit: () => void;
}) {
  const [saving, setSaving] = useState(false);

  if (!problem) {
    return (
      <div className="panel p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-electric" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">Problem statement</h3>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-500">
          Not built yet. Let the team talk, then run the problem engine — Prime reads the whole conversation and proposes
          the real question.
        </p>
        <button type="button" className="btn-primary mt-2.5 w-full py-1.5 text-[12px]" onClick={onAnalyze} disabled={busy}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          Build problem statement
        </button>
      </div>
    );
  }

  const approve = async (action: 'approve' | 'reopen') => {
    setSaving(true);
    try {
      const res = await patch<{ problem: ProblemStatement }>('/api/problem', { code, action });
      onProblem(res.problem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-slate-900/10 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-electric" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">Problem statement</h3>
          <Pill tone={problem.status === 'approved' ? 'mint' : 'amber'} className="ml-auto">{problem.status}</Pill>
        </div>
      </div>
      <div className="p-3.5">
        <p className="text-[13px] font-medium leading-snug text-slate-900">{problem.statement}</p>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="meter h-1.5 flex-1">
            <div
              className="meter-fill"
              style={{
                width: `${problem.confidence}%`,
                background: problem.confidence > 70 ? '#34d399' : problem.confidence > 50 ? '#fbbf24' : '#fb7185',
              }}
            />
          </div>
          <span className="text-[12px] font-medium tabular-nums text-slate-500">{problem.confidence}%</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded bg-white/55 px-1.5 py-0.5 text-[12px] text-slate-500">{problem.productType}</span>
          {problem.users.slice(0, 2).map((u) => (
            <span key={u} className="max-w-[130px] truncate rounded bg-white/55 px-1.5 py-0.5 text-[12px] text-slate-500">{u}</span>
          ))}
        </div>

        <ul className="mt-2.5 space-y-1">
          {problem.pains.slice(0, 2).map((p) => (
            <li key={p} className="flex gap-1.5 text-[12px] leading-snug text-slate-500">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose/70" />
              <span className="line-clamp-2">{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-1.5">
          <button type="button" className="btn-ghost flex-1 py-1.5 text-[12px]" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> Details
          </button>
          {problem.status === 'approved' ? (
            canEdit ? (
              <button type="button" className="btn-subtle py-1.5 text-[12px]" onClick={() => approve('reopen')} disabled={saving}>
                Reopen
              </button>
            ) : null
          ) : (
            <button type="button" className="btn-mint flex-1 py-1.5 text-[12px]" onClick={() => approve('approve')} disabled={saving || !canEdit}>
              {saving ? <Spinner className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
              Approve
            </button>
          )}
        </div>
        {!canEdit && <p className="mt-1.5 text-[12px] text-slate-500">Only the owner can approve the statement.</p>}
      </div>
    </div>
  );
}

export function ProblemModal({
  code,
  problem,
  open,
  canEdit,
  busy,
  onClose,
  onProblem,
  onAnalyze,
  signals = [],
}: {
  code: string;
  problem: ProblemStatement | null;
  open: boolean;
  canEdit: boolean;
  busy: boolean;
  onClose: () => void;
  onProblem: (p: ProblemStatement) => void;
  onAnalyze: () => Promise<void>;
  signals?: Signal[];
}) {
  const [draft, setDraft] = useState<ProblemStatement | null>(problem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft(problem);
  }, [open, problem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const save = async (action?: 'approve' | 'reopen') => {
    setSaving(true);
    setError(null);
    try {
      const res = await patch<{ problem: ProblemStatement }>('/api/problem', { code, ...draft, action });
      onProblem(res.problem);
      setDraft(res.problem);
      if (action) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/35 backdrop-blur-[3px] p-4-sm" onClick={onClose}>
      <div className="panel my-6 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-900/10 px-4 py-3">
          <Target className="h-4 w-4 text-electric" />
          <h2 className="text-[14px] font-semibold text-slate-900">The problem we are solving</h2>
          <Pill tone="electric" className="ml-auto hidden sm:inline-flex"><Sparkles className="h-3 w-3" /> {draft.engine}</Pill>
          <button type="button" className="btn-subtle p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-thin max-h-[70vh] overflow-y-auto p-4">
          {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">{error}</div>}

          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-900/20 bg-white/60 px-3 py-2 text-[12px] text-slate-500">
            <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">How I read the room</span>
            <span>{signals.filter((s) => s.type === 'pain').length} pains</span>
            <span>·</span>
            <span>{signals.filter((s) => s.type === 'user').length} user cues</span>
            <span>·</span>
            <span>{signals.filter((s) => s.type === 'evidence').length} evidence</span>
            <span>·</span>
            <span>{signals.filter((s) => s.type === 'decision').length} decisions</span>
            <span>·</span>
            <span>{signals.filter((s) => s.type === 'metric').length} metrics</span>
            <span className="ml-auto">confidence {draft.confidence}%</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Problem question</label>
              <textarea
                className="field min-h-[90px] leading-relaxed"
                value={draft.statement}
                onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
              />
              <p className="mt-1 text-[12px] text-slate-500">
                A problem question, not a solution. Start with “How might we…” and name the user, the pain and the outcome.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Summary</label>
              <textarea
                className="field min-h-[80px] leading-relaxed"
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Confidence — {draft.confidence}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={draft.confidence}
                onChange={(e) => setDraft({ ...draft, confidence: Number(e.target.value) })}
                className="w-full accent-indigo-400"
              />
              <label className="label mt-3">Product shape</label>
              <input className="field" value={draft.productType} onChange={(e) => setDraft({ ...draft, productType: e.target.value })} />
            </div>
            <div>
              <label className="label">Tags</label>
              <input
                className="field"
                value={draft.tags.join(', ')}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {draft.tags.slice(0, 8).map((t) => (
                  <span key={t} className="rounded bg-white/55 px-1.5 py-0.5 text-[12px] text-slate-500">{t}</span>
                ))}
              </div>
            </div>

            {LISTS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <textarea
                  className="field min-h-[86px] text-[13px] leading-relaxed"
                  value={(draft[f.key] as string[]).join('\n')}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
                  }
                  placeholder={f.hint}
                />
              </div>
            ))}
          </div>

          {draft.history && draft.history.length > 0 && (
            <div className="mt-4">
              <div className="label">History</div>
              <div className="space-y-1.5">
                {draft.history.map((h, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-900/20 bg-white/60 px-2.5 py-2 text-[12px] text-slate-500">
                    <div className="mb-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                      {new Date(h.at).toLocaleString()} · {h.by}
                    </div>
                    {h.statement}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/10 px-4 py-3">
          <button type="button" className="btn-primary px-3 py-2 text-[12px]" onClick={() => save()} disabled={saving || !canEdit}>
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} Save changes
          </button>
          {draft.status !== 'approved' ? (
            <button type="button" className="btn-mint px-3 py-2 text-[12px]" onClick={() => save('approve')} disabled={saving || !canEdit}>
              <BadgeCheck className="h-3.5 w-3.5" /> Approve &amp; lock
            </button>
          ) : (
            <Pill tone="mint"><Check className="h-3 w-3" /> approved</Pill>
          )}
          <button type="button" className="btn-ghost px-3 py-2 text-[12px]" onClick={onAnalyze} disabled={busy}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-run engine
          </button>
          <div className="ml-auto flex items-center gap-1 text-[12px] text-slate-500">
            <CircleHelp className="h-3 w-3" /> Unknowns drive the next meeting.
          </div>
        </div>
      </div>
    </div>
  );
}
