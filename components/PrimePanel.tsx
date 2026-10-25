'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X, Zap } from 'lucide-react';
import { post } from '@/lib/client';
import { Markdown, Spinner } from './ui';

interface Turn {
  role: 'you' | 'prime';
  content: string;
  engine?: string;
}

const QUICK = [
  'What problem are we actually solving?',
  'What are the three highest-leverage next moves?',
  'Which free tools should we use to build this?',
  'What is our biggest risk right now?',
  'Draft the north-star metric for this product.',
];

export default function PrimePanel({
  code,
  engine,
  live,
  onClose,
  onActivity,
}: {
  code: string;
  engine: string;
  live: boolean;
  onClose: () => void;
  onActivity: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: 'prime',
      content:
        "I'm Prime, your operating partner in this room. I've read the conversation, the problem statement and every artifact. Ask me anything — or pick a prompt below. I'll always end with one next action.",
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    setTurns((t) => [...t, { role: 'you', content: q }]);
    try {
      const res = await post<{ reply: { content: string }; engine: string }>('/api/agent', { code, question: q });
      setTurns((t) => [...t, { role: 'prime', content: res.reply.content, engine: res.engine }]);
      onActivity();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[440px] flex-col border-l border-white/10 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-electric to-cyan text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white">Prime</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Zap className="h-2.5 w-2.5 text-mint" /> {live ? 'live model' : 'built-in reasoner'} · {engine}
            </div>
          </div>
          <button type="button" className="btn-subtle ml-auto p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'you' ? 'flex justify-end' : ''}>
              <div
                className={`max-w-[92%] rounded-xl border px-3 py-2 ${
                  t.role === 'you'
                    ? 'border-electric/30 bg-electric/15 text-[12.5px] text-slate-100'
                    : 'border-white/[0.07] bg-white/[0.03]'
                }`}
              >
                {t.role === 'prime' ? (
                  <>
                    <Markdown text={t.content} />
                    {t.engine && <div className="mt-1.5 text-[9px] uppercase tracking-wider text-slate-600">{t.engine}</div>}
                  </>
                ) : (
                  t.content
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
              <Spinner className="h-3.5 w-3.5" /> Prime is reading the room and the artifacts…
            </div>
          )}
          {error && <div className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[11px] text-rose">{error}</div>}
          <div ref={endRef} />
        </div>

        {turns.length < 3 && (
          <div className="border-t border-white/[0.07] px-3 py-2">
            <div className="mb-1.5 text-[9.5px] uppercase tracking-[0.14em] text-slate-600">Try</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-400 transition hover:border-electric/40 hover:text-slate-100"
                  onClick={() => ask(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-ink-900/70 p-2 focus-within:border-electric/50">
            <textarea
              className="scroll-thin max-h-28 flex-1 resize-none bg-transparent px-1 py-1 text-[12.5px] text-slate-200 placeholder:text-slate-500 focus:outline-none"
              rows={1}
              placeholder="Ask Prime about the problem, plan or launch…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-electric to-cyan text-white disabled:opacity-40"
              onClick={() => ask(input)}
              disabled={!input.trim() || busy}
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
