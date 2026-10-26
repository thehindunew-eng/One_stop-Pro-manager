'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, BookOpen, CheckSquare, ChevronRight, Copy, FileText, Plus, Send, Sparkles,
  Target, Trash2, X, Zap,
} from 'lucide-react';
import { post } from '@/lib/client';
import { Markdown, Spinner } from './ui';

export interface PrimeAction {
  kind: 'doc' | 'task' | 'stage' | 'problem';
  label: string;
  hint?: string;
  payload?: Record<string, string>;
}

interface Turn {
  role: 'you' | 'prime';
  content: string;
  engine?: string;
  actions?: PrimeAction[];
  at?: number;
}

export interface PrimeContext {
  stageName: string;
  stageKey: string;
  problemStatus: 'draft' | 'approved' | 'none';
  confidence: number;
  docsTotal: number;
  docsReady: number;
  openTasks: number;
  signals: number;
  myRole: string;
  nextTask?: { title: string; stage: string } | null;
}

const INTRO =
  "I'm Prime, your operating partner in this room. I can see the problem statement, every document, the board, the signals and the tools your team picked — so ask me like you'd ask a senior PM.\n\nI'll always end with the next thing to do, and you can turn my answer into a task or a document in one click.";

function quickPrompts(ctx: PrimeContext): string[] {
  const base = [
    'What is the single most important thing I should do today?',
    'Where is this plan weakest, and what would a skeptical exec ask?',
    'Which free tools should we actually use to build this?',
    'What is our biggest risk right now?',
    'Write the north-star metric and two guardrails.',
  ];
  if (ctx.problemStatus !== 'approved') base.unshift('Is our problem statement good enough to move on?');
  if (ctx.docsReady < ctx.docsTotal) base.push('Which document should we write next, and why?');
  if (ctx.stageKey === 'launch' || ctx.stageKey === 'grow') base.push('What is missing before we can call this launched?');
  return base.slice(0, 5);
}

function contextChips(ctx: PrimeContext) {
  return [
    `${ctx.stageName}`,
    ctx.problemStatus === 'approved' ? `problem approved · ${ctx.confidence}%` : 'problem still a draft',
    `${ctx.docsReady}/${ctx.docsTotal} docs ready`,
    `${ctx.openTasks} open tasks`,
    `${ctx.signals} signals`,
  ];
}

/** Reveals Prime's answer progressively so long answers feel streamed, not pasted. */
function PrimeBubble({ text, engine }: { text: string; engine?: string }) {
  const [shown, setShown] = useState(text.length);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (text.length < 220) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let n = 0;
    const step = () => {
      n = Math.min(text.length, n + Math.max(24, Math.round(text.length / 90)));
      setShown(n);
      if (n < text.length) raf.current = window.setTimeout(step, 16) as unknown as number;
    };
    step();
    return () => {
      if (raf.current) window.clearTimeout(raf.current);
    };
  }, [text]);
  return (
    <>
      <Markdown text={shown >= text.length ? text : `${text.slice(0, shown)}▌`} />
      {engine && shown >= text.length && (
        <div className="mt-1.5 text-[11px] uppercase tracking-wider text-slate-500">{engine}</div>
      )}
    </>
  );
}

export default function PrimePanel({
  code,
  engine,
  live,
  context,
  onClose,
  onActivity,
  onGotoStage,
  onOpenDoc,
  onCreateTask,
  onOpenProblem,
  onShared,
}: {
  code: string;
  engine: string;
  live: boolean;
  context: PrimeContext;
  onClose: () => void;
  onActivity: () => void;
  onGotoStage: (key: string) => void;
  onOpenDoc: (kind?: string) => void;
  onCreateTask: (title: string, stageKey?: string) => Promise<void> | void;
  onOpenProblem: () => void;
  onShared: () => void;
}) {
  const storageKey = `ospm_prime_${code}`;
  const [turns, setTurns] = useState<Turn[]>([{ role: 'prime', content: INTRO }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  const endRef = useRef<HTMLDivElement>(null);

  // restore the thread so Prime remembers the conversation across reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Turn[];
        if (Array.isArray(saved) && saved.length) setTurns(saved.slice(-40));
      }
    } catch {
      /* storage blocked — start fresh */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(turns.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [turns, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, busy]);

  const prompts = useMemo(() => quickPrompts(context), [context]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setError(null);
      setInput('');
      setTurns((t) => [...t, { role: 'you', content: q }]);
      try {
        const res = await post<{ reply: { content: string }; engine: string; actions?: PrimeAction[] }>('/api/agent', {
          code,
          question: q,
        });
        setTurns((t) => [...t, { role: 'prime', content: res.reply.content, engine: res.engine, actions: res.actions ?? [] }]);
        onActivity();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [busy, code, onActivity],
  );

  async function runAction(action: PrimeAction, index: number) {
    try {
      if (action.kind === 'doc') {
        onOpenDoc(action.payload?.kind);
        setDone((d) => ({ ...d, [index]: 'Opened the document editor' }));
      } else if (action.kind === 'stage') {
        onGotoStage(action.payload?.stage ?? context.stageKey);
        setDone((d) => ({ ...d, [index]: 'Opened the stage' }));
        onClose();
      } else if (action.kind === 'problem') {
        onOpenProblem();
        setDone((d) => ({ ...d, [index]: 'Opened the problem statement' }));
      } else if (action.kind === 'task') {
        const lastQuestion = [...turns].reverse().find((t) => t.role === 'you')?.content ?? action.label;
        const title = lastQuestion.replace(/^[a-z]/, (c) => c.toUpperCase()).slice(0, 140);
        await onCreateTask(title, action.payload?.stage ?? context.stageKey);
        setDone((d) => ({ ...d, [index]: 'Added to the board' }));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function shareToRoom(turn: Turn) {
    try {
      await post('/api/messages', {
        code,
        kind: 'note',
        content: `**Prime's answer, shared by the room:**\n\n${turn.content}`,
        meta: { from: 'prime' },
      });
      onShared();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function clearThread() {
    setTurns([{ role: 'prime', content: INTRO }]);
    setDone({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35-sm" onClick={onClose}>
      <aside
        className="glass-rail flex h-full w-full max-w-[480px] flex-col shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-900/10 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-electric text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">Prime</div>
            <div className="flex items-center gap-1 text-[12px] text-slate-500">
              <Zap className="h-2.5 w-2.5 text-mint" />
              {live ? 'live model' : 'built-in reasoner'} · {engine}
            </div>
          </div>
          <button
            type="button"
            className="btn-subtle ml-auto p-1.5"
            onClick={clearThread}
            title="Start a new conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" className="btn-subtle p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-900/20 bg-white/60 px-3 py-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
            <Target className="h-3 w-3 text-electric" /> Prime can see
          </span>
          {contextChips(context).map((c) => (
            <span
              key={c}
              className="rounded-full border border-slate-900/40 bg-white/80 px-1.5 py-0.5 text-[12px] text-slate-500"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'you' ? 'flex justify-end' : ''}>
              <div
                className={`max-w-[94%] rounded-xl border px-3 py-2 ${
                  t.role === 'you'
                    ? 'border-slate-900/20 bg-white/60 text-[13px] text-slate-800'
                    : 'border-slate-900/25 bg-white/75 shadow-card'
                }`}
              >
                {t.role === 'prime' ? (
                  <>
                    <PrimeBubble text={t.content} engine={t.engine} />
                    {!!t.actions?.length && (
                      <div className="mt-2 border-t border-slate-900/10 pt-2">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
                          Do it from here
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {t.actions.map((a, k) => (
                            <button
                              key={`${a.kind}-${k}`}
                              type="button"
                              onClick={() => runAction(a, i * 10 + k)}
                              className="group inline-flex items-center gap-1 rounded-lg border border-slate-900/20 bg-white/60 px-2 py-1 text-left text-[12px] font-medium text-slate-600 transition hover:border-electric/40 hover:bg-white hover:text-slate-900"
                              title={a.hint}
                            >
                              {a.kind === 'doc' ? (
                                <FileText className="h-3 w-3 text-cyan" />
                              ) : a.kind === 'task' ? (
                                <CheckSquare className="h-3 w-3 text-mint" />
                              ) : a.kind === 'problem' ? (
                                <Target className="h-3 w-3 text-amber" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-electric" />
                              )}
                              {a.label}
                            </button>
                          ))}
                        </div>
                        {Object.entries(done)
                          .filter(([k]) => Number(k) >= i * 10 && Number(k) < i * 10 + 10)
                          .map(([k, v]) => (
                            <div key={k} className="mt-1 text-[12px] text-mint">
                              ✓ {v}
                            </div>
                          ))}
                      </div>
                    )}
                    {t.role === 'prime' && t.content !== INTRO && (
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-slate-700"
                          onClick={() => navigator.clipboard?.writeText(t.content)}
                        >
                          <Copy className="h-2.5 w-2.5" /> Copy
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-slate-700"
                          onClick={() => shareToRoom(t)}
                        >
                          <Send className="h-2.5 w-2.5" /> Share to room
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  t.content
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <Spinner className="h-3.5 w-3.5" /> Prime is reading the problem, the docs and the board…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-900/10 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
              {context.nextTask ? `Suggested next: ${context.nextTask.title}` : 'Try asking'}
            </span>
            <button
              type="button"
              onClick={clearThread}
              className="inline-flex items-center gap-0.5 text-[12px] text-slate-500 hover:text-rose"
            >
              <Trash2 className="h-2.5 w-2.5" /> clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full border border-slate-900/20 bg-white/60 px-2 py-1 text-[12px] text-slate-500 transition hover:border-electric/40 hover:bg-white hover:text-slate-900"
                onClick={() => ask(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-900/10 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-900/20 bg-white/60 p-2 focus-within:border-electric/50">
            <textarea
              className="scroll-thin max-h-28 flex-1 resize-none bg-transparent px-1 py-1 text-[13px] text-slate-800 placeholder:text-slate-500 focus:outline-none"
              rows={1}
              placeholder="Ask Prime about scope, risk, metrics, tools or the next ship…"
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
              className="grid h-8 w-8 place-items-center rounded-lg bg-electric text-white disabled:opacity-40"
              onClick={() => ask(input)}
              disabled={!input.trim() || busy}
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-slate-500">
            <BookOpen className="h-2.5 w-2.5" /> Every answer is grounded in this room. {context.myRole} view.
          </p>
        </div>
      </aside>
    </div>
  );
}
