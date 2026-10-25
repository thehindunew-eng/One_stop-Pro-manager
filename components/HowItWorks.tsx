'use client';

import { useState } from 'react';
import {
  ArrowRight, Check, CircleDollarSign, ClipboardList, FileText, MessagesSquare, Sparkles,
  Target, Users, X,
} from 'lucide-react';
import { Pill } from './ui';

const STEPS = [
  {
    icon: MessagesSquare,
    title: '1 · Talk in the meeting room',
    body: 'Say what is going wrong in plain words — or paste an existing transcript. Prime picks out pains, users, evidence, decisions and risks as you go.',
    tone: 'text-electric',
  },
  {
    icon: Target,
    title: '2 · Approve the problem statement',
    body: 'Prime turns the conversation into one sharp question with confidence, assumptions and unknowns. Read it, fix it, approve it. Scope stops moving after this.',
    tone: 'text-amber',
  },
  {
    icon: ClipboardList,
    title: '3 · Work the nine stages',
    body: 'Each stage has a checklist, the documents that stage needs, a board and the free tools for the job. Tick items off — the whole team sees the same room.',
    tone: 'text-mint',
  },
  {
    icon: FileText,
    title: '4 · Ship documents, not notes',
    body: 'Every stage writes real artifacts: PRD, design spec, architecture, test plan, launch plan. Edit them in place, mark ready, approve, then export the pack.',
    tone: 'text-cyan',
  },
];

export default function HowItWorks({
  open,
  me,
  roomName,
  hasProblem,
  onClose,
  onOpenProblem,
  onGoStage,
  onInvite,
}: {
  open: boolean;
  me: { name: string; role: string };
  roomName: string;
  hasProblem: boolean;
  onClose: () => void;
  onOpenProblem: () => void;
  onGoStage: () => void;
  onInvite: () => void;
}) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-electric to-cyan text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900">How {roomName} works</div>
            <div className="text-[10.5px] text-slate-500">Four steps from meeting to launch — no training needed.</div>
          </div>
          <Pill tone="slate" className="ml-auto">{me.role}</Pill>
          <button type="button" className="btn-subtle p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-xl border p-3 text-left transition ${
                step === i ? 'border-electric/40 bg-electric/[0.05]' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <s.icon className={`h-4 w-4 ${s.tone}`} />
              <div className="mt-1.5 text-[12px] font-semibold text-slate-900">{s.title}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{s.body}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <Users className="h-3 w-3" /> Your next click
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!hasProblem ? (
              <button type="button" className="btn-primary" onClick={onOpenProblem}>
                <Target className="h-3.5 w-3.5" /> Build the problem statement
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={onOpenProblem}>
                <Check className="h-3.5 w-3.5" /> Review the problem statement
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onGoStage}>
              <ClipboardList className="h-3.5 w-3.5" /> Open the lifecycle
            </button>
            <button type="button" className="btn-ghost" onClick={onInvite}>
              <Users className="h-3.5 w-3.5" /> Invite the team
            </button>
            <button type="button" className="btn-subtle ml-auto" onClick={onClose}>
              Got it <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
            <CircleDollarSign className="h-2.5 w-2.5 text-mint" /> Every tool on the wall has a free tier. Nothing here
            needs a paid account to start.
          </p>
        </div>
      </div>
    </div>
  );
}
