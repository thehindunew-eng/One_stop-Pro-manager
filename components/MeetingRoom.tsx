'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, AudioLines, ClipboardPaste, Dot, Lightbulb, MessageSquare, Plus, Sparkles, X,
  CircleHelp, CheckCircle2, StickyNote, Wand2, Mic, MicOff,
} from 'lucide-react';
import type { Artifact, Message, MessageKind, ProblemStatement, Signal } from '@/lib/types';
import { post } from '@/lib/client';
import { Avatar, Pill, Spinner } from './ui';

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  chat: { label: 'Chat', icon: MessageSquare, color: '#94a3b8' },
  idea: { label: 'Idea', icon: Lightbulb, color: '#fbbf24' },
  decision: { label: 'Decision', icon: CheckCircle2, color: '#34d399' },
  question: { label: 'Question', icon: CircleHelp, color: '#22d3ee' },
  note: { label: 'Note', icon: StickyNote, color: '#a78bfa' },
  transcript: { label: 'Transcript', icon: AudioLines, color: '#818cf8' },
  system: { label: 'Copilot', icon: Sparkles, color: '#818cf8' },
};

export default function MeetingRoom({
  code,
  messages,
  problem,
  signals,
  members,
  me,
  live,
  engine,
  busyAnalyze,
  onAnalyze,
  onAppend,
  onAskPrime,
  onOpenProblem,
}: {
  code: string;
  messages: Message[];
  problem: ProblemStatement | null;
  signals: Signal[];
  members: { name: string; role: string; user_id: string }[];
  me: { name: string; role: string };
  live: boolean;
  engine: string;
  busyAnalyze: boolean;
  onAnalyze: () => Promise<void>;
  onAppend: (m: Message) => void;
  onAskPrime: () => void;
  onOpenProblem: () => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MessageKind>('chat');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice capture is not available in this browser — use Chrome/Edge, or paste a transcript.');
      return;
    }
    if (listening) {
      try { recRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-IN';
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += `${e.results[i][0].transcript} `;
      }
      if (final) setText((t) => `${t}${t ? ' ' : ''}${final.trim()}`);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError('Could not reach the microphone. Check browser permissions.');
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setKind('transcript');
    } catch {
      setError('Microphone is already in use.');
    }
  }

  const real = useMemo(() => messages.filter((m) => m.kind !== 'system' || m.content.length > 0), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [real.length]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setText('');
    try {
      const res = await post<{ message: Message }>('/api/messages', { code, content, kind });
      onAppend(res.message);
    } catch (e) {
      setError((e as Error).message);
      setText(content);
    } finally {
      setSending(false);
    }
  }

  async function runImport() {
    if (!paste.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const rows: { author: string; content: string }[] = [];
      const blocks = paste.split(/\n\s*\n|\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of blocks) {
        const m = /^([A-Z][\w .'-]{1,40}):\s*(.+)$/.exec(line);
        if (m) rows.push({ author: m[1], content: m[2] });
        else if (rows.length) rows[rows.length - 1].content += ` ${line}`;
        else rows.push({ author: me.name, content: line });
      }
      if (!rows.length) throw new Error('Nothing to import.');
      for (const r of rows.slice(0, 120)) {
        const res = await post<{ message: Message }>('/api/messages', {
          code,
          content: `${r.author}: ${r.content}`.length > 4000 ? r.content.slice(0, 3800) : r.content,
          kind: 'transcript',
          meta: { speaker: r.author, imported: true },
        });
        onAppend(res.message);
      }
      setPaste('');
      setImportOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const pains = signals.filter((s) => s.type === 'pain').length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* status bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose" />
          </span>
          <span className="text-[11.5px] font-medium text-slate-300">Room live</span>
          <span className="text-[11px] text-slate-600">·</span>
          <span className="text-[11.5px] text-slate-500">{members.length} in the room</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Pill tone={live ? 'mint' : 'slate'}>
            <Sparkles className="h-3 w-3" /> {live ? 'live model' : 'built-in reasoner'}
          </Pill>
          <button type="button" className="btn-ghost px-2 py-1.5 text-[11px]" onClick={() => setImportOpen(true)}>
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste transcript
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {problem && (
          <button
            type="button"
            onClick={onOpenProblem}
            className="group w-full rounded-2xl border border-electric/25 bg-gradient-to-br from-electric/[0.13] via-electric/[0.05] to-transparent p-3.5 text-left transition hover:border-electric/40"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Pill tone="electric"><Wand2 className="h-3 w-3" /> Working problem statement</Pill>
              <span className="text-[10.5px] text-slate-500">confidence {problem.confidence}%</span>
              <Pill tone={problem.status === 'approved' ? 'mint' : 'amber'}>{problem.status}</Pill>
              <span className="ml-auto text-[10.5px] text-slate-500 group-hover:text-slate-300">open details →</span>
            </div>
            <p className="text-[13px] font-medium leading-snug text-white">{problem.statement}</p>
          </button>
        )}

        {real.map((m) => {
          const meta = KIND_META[m.kind] ?? KIND_META.chat;
          const mine = m.author === me.name;
          const isPrime = m.role === 'assistant';
          return (
            <div key={m.id} className={`flex gap-2.5 ${isPrime ? '' : ''}`}>
              <div className="pt-0.5">
                {isPrime ? (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-electric to-cyan text-white ring-1 ring-white/20">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <Avatar name={m.author} size={28} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className={`text-[12px] font-semibold ${isPrime ? 'text-electric-soft' : 'text-slate-200'}`}>
                    {isPrime ? 'Prime' : m.author}
                    {mine && !isPrime && <span className="ml-1 text-[10px] font-normal text-slate-600">(you)</span>}
                  </span>
                  <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] uppercase tracking-wider text-slate-500">{m.role}</span>
                  {m.kind !== 'chat' && (
                    <span
                      className="inline-flex items-center gap-1 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      <meta.icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600" suppressHydrationWarning>
                    {new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`whitespace-pre-wrap rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed ${
                    isPrime
                      ? 'border-electric/20 bg-electric/[0.07] text-slate-200'
                      : m.kind === 'decision'
                        ? 'border-mint/20 bg-mint/[0.06] text-slate-200'
                        : m.kind === 'idea'
                          ? 'border-amber/20 bg-amber/[0.05] text-slate-200'
                          : 'border-white/[0.06] bg-white/[0.025] text-slate-300'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
        {!real.length && (
          <div className="panel-flat p-5 text-center">
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-electric/12 text-electric-soft">
              <AudioLines className="h-5 w-5" />
            </div>
            <h3 className="text-[13.5px] font-semibold text-white">Start the conversation</h3>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-slate-400">
              Describe the problem the team is facing — or paste an existing transcript. Prime will pull out the pains,
              users, evidence and decisions as you talk.
            </p>
            <div className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-1.5">
              {[
                'Our users keep dropping off at…',
                'The team wastes hours every week on…',
                'We have data that shows…',
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setText(`${p} `)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-slate-400 transition hover:border-electric/40 hover:text-slate-100"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* analyze bar */}
      <div className="border-t border-white/[0.06] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] text-slate-500">
            {pains ? `${pains} pains captured` : 'No signals extracted yet'} · engine {engine}
          </div>
          <button type="button" className="btn-primary ml-auto px-3 py-2 text-[12px]" onClick={onAnalyze} disabled={busyAnalyze}>
            {busyAnalyze ? <Spinner className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
            {busyAnalyze ? 'Reading the room…' : problem ? 'Re-run problem engine' : 'Build problem statement'}
          </button>
          <button type="button" className="btn-ghost px-2.5 py-2 text-[12px]" onClick={onAskPrime}>
            <Sparkles className="h-3.5 w-3.5" /> Ask Prime
          </button>
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-white/[0.06] p-3">
        {error && <div className="mb-2 rounded-lg border border-rose/30 bg-rose/10 px-3 py-1.5 text-[11px] text-rose">{error}</div>}
        <div className="rounded-xl border border-white/10 bg-ink-900/70 focus-within:border-electric/50">
          <textarea
            className="scroll-thin max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[12.5px] leading-relaxed text-slate-200 placeholder:text-slate-500 focus:outline-none"
            rows={2}
            placeholder="Type what the team is saying… (Enter to send, Shift+Enter for a new line)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.06] px-2 py-1.5">
            {(['chat', 'idea', 'decision', 'question', 'note'] as MessageKind[]).map((k) => {
              const meta = KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium transition ${
                    kind === k ? 'bg-white/[0.09] text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <meta.icon className="h-3 w-3" style={{ color: kind === k ? meta.color : undefined }} />
                  {meta.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleMic}
              title={listening ? 'Stop dictating' : 'Dictate into the room'}
              className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                listening ? 'bg-rose/20 text-rose' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
            >
              {listening ? <MicOff className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
              {listening ? 'Stop' : 'Dictate'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/[0.14] disabled:opacity-40"
              onClick={send}
              disabled={!text.trim() || sending}
            >
              {sending ? <Spinner className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-600">
          <Dot className="h-3 w-3" /> Signal extraction runs automatically on ideas, decisions and questions.
        </div>
      </div>

      {/* transcript import */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setImportOpen(false)}>
          <div className="panel w-full max-w-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-electric-soft" />
              <h3 className="text-[14px] font-semibold text-white">Paste a transcript or notes</h3>
              <button type="button" className="btn-subtle ml-auto p-1.5" onClick={() => setImportOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-[11.5px] leading-relaxed text-slate-400">
              One line per message. Use <code className="rounded bg-white/10 px-1">Name: what they said</code> to keep
              speakers — otherwise each line is attributed to you. Everything lands as transcript messages for analysis.
            </p>
            <textarea
              className="md-input scroll-thin"
              style={{ height: 240 }}
              placeholder={'Amar: The kickoff ends and nobody agrees what we decided.\nRohan: Scope arrives as vibes, we rework 30% of every sprint.\nPriya: I open four tools before I draw one screen.'}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="btn-primary px-3 py-2 text-[12px]" onClick={runImport} disabled={importing || !paste.trim()}>
                {importing ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                Import {paste.trim() ? `${paste.split(/\n/).filter(Boolean).length} lines` : ''}
              </button>
              <span className="text-[10.5px] text-slate-600">Max 120 lines per import.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
