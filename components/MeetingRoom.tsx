'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, AudioLines, ClipboardPaste, Dot, Lightbulb, MessageSquare, Plus, Sparkles, X,
  CircleHelp, CheckCircle2, StickyNote, Wand2, Mic, MicOff, Trash2,
} from 'lucide-react';
import type { Artifact, Message, MessageKind, ProblemStatement, Signal } from '@/lib/types';
import { del, post } from '@/lib/client';
import { stageAccent } from '@/lib/defaults';
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
  onRemove,
  onAskPrime,
  onOpenProblem,
}: {
  code: string;
  messages: Message[];
  problem: ProblemStatement | null;
  signals: Signal[];
  members: { name: string; role: string; user_id: string }[];
  me: { name: string; role: string; canEdit?: boolean };
  live: boolean;
  engine: string;
  busyAnalyze: boolean;
  onAnalyze: () => Promise<void>;
  onAppend: (m: Message) => void;
  onRemove: (id: string) => void;
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose" />
          </span>
          <span className="text-[12px] font-medium text-slate-600">Live</span>
          <span className="text-[12px] text-slate-500">·</span>
          <span className="text-[12px] text-slate-500">{members.length} in the room</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Pill tone={live ? 'mint' : 'slate'}>
            <Sparkles className="h-3 w-3" /> {live ? 'live model' : 'built-in reasoner'}
          </Pill>
          <button type="button" className="btn-ghost px-2 py-1.5 text-[12px]" onClick={() => setImportOpen(true)}>
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
            className="glass-card group relative w-full overflow-hidden p-3.5 text-left transition"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Pill tone="electric"><Wand2 className="h-3 w-3" /> Working problem statement</Pill>
              <span className="text-[12px] text-slate-500">confidence {problem.confidence}%</span>
              <Pill tone={problem.status === 'approved' ? 'mint' : 'amber'}>{problem.status}</Pill>
              <span className="ml-auto text-[12px] text-slate-500 group-hover:text-slate-700">View details →</span>
            </div>
            <p className="text-[13px] font-medium leading-snug text-slate-900">{problem.statement}</p>
          </button>
        )}

        {real.map((m) => {
          const meta = KIND_META[m.kind] ?? KIND_META.chat;
          const mine = m.author === me.name;
          const isPrime = m.role === 'assistant';
          return (
            <div key={m.id} className="group/msg flex gap-2.5">
              <div className="pt-0.5">
                {isPrime ? (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-electric text-white ring-1 ring-slate-200">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <Avatar name={m.author} size={28} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className={`text-[12px] font-semibold ${isPrime ? 'text-electric' : 'text-slate-800'}`}>
                    {isPrime ? 'Prime' : m.author}
                    {mine && !isPrime && <span className="ml-1 text-[12px] font-normal text-slate-500">(you)</span>}
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-px text-[11px] uppercase tracking-wider text-slate-500">{m.role}</span>
                  {m.kind !== 'chat' && (
                    <span
                      className="inline-flex items-center gap-1 rounded px-1 py-px text-[11px] font-semibold uppercase tracking-wider"
                      style={{ background: `${stageAccent(meta.color)}18`, color: stageAccent(meta.color) }}
                    >
                      <meta.icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  )}
                  <span className="text-[12px] text-slate-500" suppressHydrationWarning>
                    {new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {(mine || (me.canEdit && isPrime)) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await del<{ messages: Message[] }>(`/api/messages?code=${code}&id=${m.id}`);
                          if (res?.messages) onRemove(m.id);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                      className="rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-rose/10 hover:text-rose group-hover/msg:opacity-100"
                      title={mine ? 'Delete your message' : 'Delete this reply (owner)'}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <div
                  className={`whitespace-pre-wrap rounded-xl border px-3 py-2 text-[13px] leading-relaxed ${
                    isPrime
                      ? 'border-slate-900/20 bg-white/60 text-slate-700'
                      : m.kind === 'decision'
                        ? 'border-mint/20 bg-emerald-50 text-slate-700'
                        : m.kind === 'idea'
                          ? 'border-amber/20 bg-amber/[0.06] text-slate-700'
                          : 'border-slate-900/20 bg-white/60 text-slate-700'
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
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl border border-slate-900/20 bg-white/60 text-slate-600">
              <AudioLines className="h-5 w-5" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900">Start the conversation</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
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
                  className="rounded-full border border-slate-900/20 bg-white/60 px-2.5 py-1 text-[12px] text-slate-500 transition hover:border-electric/40 hover:text-slate-900"
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
      <div className="border-t border-slate-200 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[12px] text-slate-500">
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
      <div className="border-t border-slate-200 p-3">
        {error && <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] text-rose">{error}</div>}
        <div className="rounded-xl border border-slate-900/20 bg-white/60 focus-within:border-electric/50">
          <textarea
            className="scroll-thin max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-500 focus:outline-none"
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
          <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 px-2 py-1.5">
            {(['chat', 'idea', 'decision', 'question', 'note'] as MessageKind[]).map((k) => {
              const meta = KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium transition ${
                    kind === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
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
              className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition ${
                listening ? 'bg-rose/10 text-rose' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {listening ? <MicOff className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
              {listening ? 'Stop' : 'Dictate'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-electric px-2.5 py-1.5 text-[12px] font-medium text-white shadow-card transition hover:bg-electric-soft disabled:opacity-40"
              onClick={send}
              disabled={!text.trim() || sending}
            >
              {sending ? <Spinner className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[12px] text-slate-500">
          <Dot className="h-3 w-3" /> Signal extraction runs automatically on ideas, decisions and questions.
        </div>
      </div>

      {/* transcript import */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4-sm" onClick={() => setImportOpen(false)}>
          <div className="panel w-full max-w-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-electric" />
              <h3 className="text-[14px] font-semibold text-slate-900">Paste a transcript or notes</h3>
              <button type="button" className="btn-subtle ml-auto p-1.5" onClick={() => setImportOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-[13px] leading-relaxed text-slate-500">
              One line per message. Use <code className="rounded bg-slate-100 px-1">Name: what they said</code> to keep
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
              <span className="text-[12px] text-slate-500">Max 120 lines per import.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
