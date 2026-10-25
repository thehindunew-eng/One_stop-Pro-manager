'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight, Check, CheckCircle2, Circle, ClipboardList, FileText, Target, Users2, AlertTriangle,
} from 'lucide-react';
import type { Artifact, Member, ProblemStatement, Project, Signal, Stage, Task } from '@/lib/types';
import { patch, post } from '@/lib/client';
import { Avatar, Pill, Spinner } from './ui';

const ROLE_PLAYBOOK: Record<string, { title: string; blurb: string; moves: string[] }> = {
  pm: {
    title: 'You are the product manager',
    blurb: 'Your job this week: keep one problem in focus, get the documents agreed, and unblock the build.',
    moves: [
      'Approve the problem statement so scope stops moving.',
      'Draft the next missing document for the current stage.',
      'Close the oldest open question in the room.',
    ],
  },
  design: {
    title: 'You are the designer',
    blurb: 'Your job this week: turn the problem into flows the team can argue about, not screens they guess at.',
    moves: [
      'Sketch the main user journey for the approved problem.',
      'Review the design spec and mark it ready.',
      'Add a usability question as a signal for the team.',
    ],
  },
  eng: {
    title: 'You are the engineer',
    blurb: 'Your job this week: get a deployable slice live behind a URL, with the smallest possible surface.',
    moves: [
      'Pick the highest-priority build task and move it to doing.',
      'Confirm the architecture doc names the database and hosting.',
      'Record the deploy URL against your stack so the team can see it.',
    ],
  },
  qa: {
    title: 'You are quality',
    blurb: 'Your job this week: know exactly what “working” means before it ships, and prove it.',
    moves: [
      'Turn the acceptance criteria into test cases on the board.',
      'Walk the happy path and log every break as a task.',
      'Agree the launch checklist with the PM.',
    ],
  },
  growth: {
    title: 'You are growth',
    blurb: 'Your job this week: make sure the launch has one metric, one audience and one channel.',
    moves: [
      'Fix the north-star metric and its baseline.',
      'Write the launch announcement and the first channel plan.',
      'Pick the analytics tool in the stack and mark it in use.',
    ],
  },
  member: {
    title: 'You are on the team',
    blurb: 'Your job this week: pick work off the board, report what you learn, and keep the room current.',
    moves: [
      'Claim a task on the board and move it to doing.',
      'Add what you learned as a note or a decision.',
      'Check the stage checklist before the next meeting.',
    ],
  },
};

export default function MyWork({
  code,
  project,
  problem,
  me,
  members,
  tasks,
  artifacts,
  signals,
  stages,
  onTasks,
  onGotoStage,
  onOpenProblem,
}: {
  code: string;
  project: Project;
  problem: ProblemStatement | null;
  me: { name: string; role: string; canEdit: boolean };
  members: Member[];
  tasks: Task[];
  artifacts: Artifact[];
  signals: Signal[];
  stages: Stage[];
  onTasks: (t: Task[]) => void;
  onGotoStage: (key: string) => void;
  onOpenProblem: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const playbook = ROLE_PLAYBOOK[me.role] ?? ROLE_PLAYBOOK.member;
  const stage = stages.find((s) => s.key === project.stage_key) ?? stages[0];

  const mine = useMemo(
    () => tasks.filter((t) => t.owner && t.owner.toLowerCase() === me.name.toLowerCase()),
    [tasks, me.name],
  );
  const myOpen = mine.filter((t) => t.status !== 'done');
  const unassigned = tasks.filter((t) => !t.owner && t.status !== 'done');

  const stageDocs = artifacts.filter((a) => a.stage_key === project.stage_key);
  const draftDocs = stageDocs.filter((a) => a.status === 'draft');
  const openQuestions = signals.filter((s) => s.type === 'question' && s.status === 'open');
  const blockers = signals.filter((s) => s.type === 'blocker' && s.status !== 'dismissed');

  // Plain-language, ordered next actions — a PM should never wonder what to do.
  const nextMoves: { label: string; why: string; action: () => void; tone: 'primary' | 'plain' }[] = [];
  if (problem && problem.status !== 'approved') {
    nextMoves.push({
      label: me.canEdit ? 'Approve the problem statement' : 'Review the problem statement',
      why: me.canEdit
        ? 'Until it is approved, scope keeps moving and documents get rewritten.'
        : 'The owner approves it. Read it and flag anything that is wrong for your part of the work.',
      action: onOpenProblem,
      tone: 'primary',
    });
  }
  if (!problem) {
    nextMoves.push({
      label: 'Build the problem statement',
      why: 'Prime needs a few lines of conversation to infer the real question.',
      action: onOpenProblem,
      tone: 'primary',
    });
  }
  if (myOpen[0]) {
    nextMoves.push({
      label: `Finish: ${myOpen[0].title}`,
      why: `Yours, ${myOpen[0].priority} in ${stages.find((s) => s.key === myOpen[0].stage_key)?.name ?? 'this stage'}.`,
      action: () => {},
      tone: 'plain',
    });
  }
  if (draftDocs[0]) {
    nextMoves.push({
      label: `Write “${draftDocs[0].title}”`,
      why: 'Still a draft on the current stage. Drafting takes one click.',
      action: () => onGotoStage(project.stage_key),
      tone: 'plain',
    });
  }
  if (openQuestions[0]) {
    nextMoves.push({
      label: `Answer: ${openQuestions[0].label}`,
      why: 'An open question is blocking a decision in this room.',
      action: () => {},
      tone: 'plain',
    });
  }

  async function claim(task: Task) {
    setBusy(task.id);
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', {
        code,
        id: task.id,
        status: task.status === 'todo' ? 'doing' : 'done',
        owner: task.owner ?? me.name,
      });
      onTasks(res.tasks);
    } catch {
      /* the poll will catch up */
    } finally {
      setBusy(null);
    }
  }

  async function addPlaybookTask(label: string) {
    setBusy(`new:${label}`);
    try {
      const res = await post<{ tasks: Task[] }>('/api/tasks', {
        code,
        title: label,
        detail: `Suggested by the ${me.role} playbook.`,
        stage_key: project.stage_key,
        priority: 'P1',
        owner: me.name,
      });
      onTasks(res.tasks);
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  const load = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === 'done' || !t.owner) continue;
      map.set(t.owner, (map.get(t.owner) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tasks]);

  return (
    <div className="panel p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5 text-electric" />
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">My work</h3>
        <Pill tone="slate" className="ml-auto">{playbook.title.replace('You are ', '')}</Pill>
      </div>

      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">{playbook.blurb}</p>

      <div className="space-y-1.5">
        {nextMoves.slice(0, 3).map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={m.action}
            className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
              m.tone === 'primary'
                ? 'border-electric/30 bg-electric/[0.05] hover:border-electric/50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Circle className={`h-2.5 w-2.5 shrink-0 ${m.tone === 'primary' ? 'text-electric' : 'text-amber'}`} />
              <span className="text-[11.5px] font-medium leading-snug text-slate-800">{m.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-slate-400" />
            </div>
            <p className="mt-0.5 pl-4 text-[10px] leading-snug text-slate-500">{m.why}</p>
          </button>
        ))}
        {!nextMoves.length && (
          <div className="rounded-lg border border-mint/25 bg-mint/[0.06] px-2.5 py-2 text-[11px] text-mint">
            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Nothing is waiting on you. Pick the next board task.
          </div>
        )}
      </div>

      {!!myOpen.length && (
        <div className="mt-2.5">
          <div className="mb-1 text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Assigned to you</div>
          {myOpen.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-start gap-1.5 border-t border-slate-100 py-1.5">
              <button
                type="button"
                onClick={() => claim(t)}
                className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded border border-slate-300 text-transparent transition hover:border-mint hover:text-mint"
                title={t.status === 'todo' ? 'Start this' : 'Mark done'}
              >
                {busy === t.id ? <Spinner className="h-2.5 w-2.5 text-slate-400" /> : <Check className="h-2.5 w-2.5" />}
              </button>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[11px] leading-snug text-slate-700">{t.title}</p>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">
                  {stages.find((s) => s.key === t.stage_key)?.name} · {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!unassigned.length && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <div className="text-[10px] text-slate-500">
            <Users2 className="mr-1 inline h-2.5 w-2.5" />
            {unassigned.length} unclaimed task{unassigned.length === 1 ? '' : 's'} in the room
          </div>
          <button
            type="button"
            onClick={() => claim(unassigned[0])}
            className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-electric hover:text-electric-soft"
          >
            Take “{unassigned[0].title.slice(0, 42)}{unassigned[0].title.length > 42 ? '…' : ''}”
            <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      <div className="mt-2.5 border-t border-slate-200 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Your playbook</span>
          <span className="text-[9px] text-slate-400">tap to add as a task</span>
        </div>
        {playbook.moves.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => addPlaybookTask(m)}
            className="flex w-full items-start gap-1.5 rounded px-1 py-1 text-left text-[10.5px] leading-snug text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-electric/60" />
            <span className="min-w-0">{m}</span>
            {busy === `new:${m}` && <Spinner className="ml-auto h-2.5 w-2.5 shrink-0" />}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
        <button type="button" onClick={() => onGotoStage(project.stage_key)} className="inline-flex items-center gap-1 hover:text-slate-800">
          <Target className="h-2.5 w-2.5 text-electric" /> {stage?.name} stage
        </button>
        <button type="button" onClick={() => onGotoStage(project.stage_key)} className="inline-flex items-center gap-1 hover:text-slate-800">
          <FileText className="h-2.5 w-2.5 text-cyan" /> {draftDocs.length} draft
        </button>
        {!!blockers.length && (
          <span className="inline-flex items-center gap-1 text-rose">
            <AlertTriangle className="h-2.5 w-2.5" /> {blockers.length} risk{blockers.length === 1 ? '' : 's'}
          </span>
        )}
        {!!load.length && (
          <span className="ml-auto inline-flex items-center gap-1">
            {load.map(([name, n]) => (
              <span key={name} className="inline-flex items-center gap-0.5" title={`${name}: ${n} open`}>
                <Avatar name={name} size={14} />
                <span className="text-[9px]">{n}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      {me.canEdit && members.length < 2 && (
        <p className="mt-1.5 text-[9.5px] text-slate-400">
          You are alone in this room — share the invite link so the team can pick up their own work.
        </p>
      )}
    </div>
  );
}
