'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, LayoutGrid, Radar, X } from 'lucide-react';
import type { Signal, SignalType } from '@/lib/types';
import { patch } from '@/lib/client';
import { Pill } from './ui';

const TYPE_META: Record<SignalType, { label: string; color: string }> = {
  pain: { label: 'Pain', color: '#fb7185' },
  user: { label: 'User', color: '#22d3ee' },
  evidence: { label: 'Evidence', color: '#34d399' },
  idea: { label: 'Idea', color: '#fbbf24' },
  decision: { label: 'Decision', color: '#818cf8' },
  blocker: { label: 'Risk', color: '#f97316' },
  metric: { label: 'Metric', color: '#2dd4bf' },
  question: { label: 'Open Q', color: '#a78bfa' },
};

const ORDER: SignalType[] = ['pain', 'user', 'evidence', 'decision', 'metric', 'idea', 'blocker', 'question'];

export default function SignalRail({
  code,
  signals,
  onSignals,
  onCreateTask,
}: {
  code: string;
  signals: Signal[];
  onSignals: (s: Signal[]) => void;
  onCreateTask?: (title: string) => Promise<void> | void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignalType | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hideDismissed, setHideDismissed] = useState(true);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signals) map.set(s.type, (map.get(s.type) ?? 0) + 1);
    return map;
  }, [signals]);

  const list = useMemo(
    () =>
      signals
        .filter((s) => (filter === 'all' ? true : s.type === filter))
        .filter((s) => (hideDismissed ? s.status !== 'dismissed' : true))
        .slice(0, 40),
    [signals, filter, hideDismissed],
  );

  async function setStatus(signal: Signal, status: 'accepted' | 'dismissed' | 'open') {
    onSignals(signals.map((s) => (s.id === signal.id ? { ...s, status } : s)));
    try {
      await patch('/api/signals', { code, id: signal.id, status });
    } catch {
      /* optimistic */
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-3.5 py-2.5">
        <Radar className="h-3.5 w-3.5 text-cyan" />
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">Live signals</h3>
        <span className="ml-auto text-[10px] text-slate-500">{signals.length}</span>
      </div>

      <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-slate-200/80 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${filter === 'all' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-400'}`}
        >
          All
        </button>
        {ORDER.filter((t) => counts.get(t)).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition ${
              filter === t ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-400'
            }`}
            style={filter === t ? { color: TYPE_META[t].color } : undefined}
          >
            {TYPE_META[t].label} {counts.get(t)}
          </button>
        ))}
      </div>

      <div className="scroll-thin max-h-[320px] divide-y divide-slate-100 overflow-y-auto">
        {list.map((s) => {
          const meta = TYPE_META[s.type] ?? TYPE_META.pain;
          const isOpen = expanded === s.id;
          return (
            <div key={s.id} className={`px-3 py-2 transition ${s.status === 'accepted' ? 'bg-mint/[0.04]' : s.status === 'dismissed' ? 'opacity-40' : 'hover:bg-slate-50'}`}>
              <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setExpanded(isOpen ? null : s.id)}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[9px] text-slate-500">{s.score}</span>
                    {s.status === 'accepted' && <Check className="h-2.5 w-2.5 text-mint" />}
                    <ChevronDown className={`ml-auto h-3 w-3 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">{s.label}</p>
                </div>
              </button>

              {isOpen && (
                <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-slate-100 p-2">
                  {s.detail && <p className="text-[10.5px] leading-relaxed text-slate-500">{s.detail}</p>}
                  {s.evidence?.slice(0, 2).map((e, i) => (
                    <div key={i} className="mt-1.5 border-l-2 border-slate-200 pl-2">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">{e.author}</div>
                      <p className="line-clamp-3 text-[10px] italic leading-relaxed text-slate-500">“{e.content}”</p>
                    </div>
                  ))}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-mint/30 bg-mint/10 px-1.5 py-0.5 text-[9.5px] font-medium text-mint"
                      onClick={() => setStatus(s, s.status === 'accepted' ? 'open' : 'accepted')}
                    >
                      <Check className="h-2.5 w-2.5" /> {s.status === 'accepted' ? 'Accepted' : 'Accept'}
                    </button>
                    {onCreateTask && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[9.5px] text-slate-500 hover:border-electric/40 hover:text-electric"
                        onClick={async () => {
                          setAdding(s.id);
                          try {
                            await onCreateTask(s.label);
                            await setStatus(s, 'accepted');
                          } finally {
                            setAdding(null);
                          }
                        }}
                        title="Turn this signal into work"
                      >
                        <LayoutGrid className="h-2.5 w-2.5" /> {adding === s.id ? 'Adding…' : 'Put on board'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[9.5px] text-slate-500 hover:border-rose/30 hover:text-rose"
                      onClick={() => setStatus(s, 'dismissed')}
                    >
                      <X className="h-2.5 w-2.5" /> Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="px-3 py-4 text-center text-[11px] text-slate-500">
            {signals.length ? 'Nothing in this filter.' : 'Signals appear as the team talks.'}
          </div>
        )}
      </div>

      {signals.some((s) => s.status === 'dismissed') && (
        <button
          type="button"
          onClick={() => setHideDismissed((v) => !v)}
          className="w-full border-t border-slate-200/80 py-1.5 text-[9.5px] uppercase tracking-wider text-slate-500 hover:text-slate-500"
        >
          {hideDismissed ? 'show dismissed' : 'hide dismissed'}
        </button>
      )}
    </div>
  );
}
