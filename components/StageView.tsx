'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronRight, Circle, FileText, LayoutGrid, ListChecks, Sparkles, Wand2,
} from 'lucide-react';
import type { Artifact, Member, ProblemStatement, Project, Stage, StageKey, Task, Tool } from '@/lib/types';
import { ProgressRing, Pill, StageIcon, ToolIcon } from './ui';
import DocView from './DocView';
import Board from './Board';
import ToolWall from './ToolWall';
import { post } from '@/lib/client';

type Tab = 'plan' | 'docs' | 'board' | 'tools';

export default function StageView({
  code,
  project,
  stages,
  stageKey,
  artifacts,
  tasks,
  tools,
  members,
  problem,
  canEdit,
  live,
  engine,
  onStage,
  onArtifacts,
  onTasks,
  onProject,
  onManage,
  onOpenProblem,
}: {
  code: string;
  project: Project;
  stages: Stage[];
  stageKey: StageKey;
  artifacts: Artifact[];
  tasks: Task[];
  tools: Tool[];
  members: Member[];
  problem: ProblemStatement | null;
  canEdit: boolean;
  live: boolean;
  engine: string;
  onStage: (s: StageKey) => Promise<void>;
  onArtifacts: (a: Artifact[]) => void;
  onTasks: (t: Task[]) => void;
  onProject: (p: Project) => void;
  onManage: () => void;
  onOpenProblem: () => void;
}) {
  const [tab, setTab] = useState<Tab>('plan');
  const stage = stages.find((s) => s.key === stageKey) ?? stages[0];
  const idx = stages.findIndex((s) => s.key === stage.key);
  const next = stages[idx + 1];

  const stageTasks = useMemo(() => tasks.filter((t) => t.stage_key === stage.key), [tasks, stage.key]);
  const doneCount = stageTasks.filter((t) => t.status === 'done').length;
  const pct = stageTasks.length ? Math.round((doneCount / stageTasks.length) * 100) : 0;

  const stageArtifacts = artifacts.filter((a) => a.stage_key === stage.key);
  const stageTools = tools.filter((t) => t.stages.includes(stage.key));

  const stageProgress = (key: StageKey) => {
    const t = tasks.filter((x) => x.stage_key === key);
    if (!t.length) return 0;
    return Math.round((t.filter((x) => x.status === 'done').length / t.length) * 100);
  };

  async function advance() {
    if (!next) return;
    const res = await post<{ project: Project }>('/api/project', { code, stage_key: next.key });
    onProject(res.project);
    await onStage(next.key);
  }

  async function toggleChecklist(title: string) {
    const task = stageTasks.find((t) => t.title === title);
    if (!task) return;
    const status = task.status === 'done' ? 'todo' : 'done';
    onTasks(tasks.map((t) => (t.id === task.id ? { ...t, status } : t)));
    const { patch } = await import('@/lib/client');
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', { code, id: task.id, status });
      onTasks(res.tasks);
    } catch {
      /* optimistic */
    }
  }

  const TABS: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'plan', label: 'Stage plan', icon: ListChecks },
    { key: 'docs', label: 'Documents', icon: FileText, count: stageArtifacts.length },
    { key: 'board', label: 'Board', icon: LayoutGrid, count: stageTasks.length },
    { key: 'tools', label: 'Tools', icon: Sparkles, count: stageTools.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {problem?.status !== 'approved' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber/20 bg-amber/[0.07] px-4 py-1.5 text-[11px] text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          {problem
            ? 'The problem statement is still a draft. Approve it to lock scope before the team builds on it.'
            : 'No problem statement yet. Talk it through in the meeting, then run the problem engine.'}
          <button type="button" onClick={onOpenProblem} className="ml-auto rounded-md border border-amber/40 px-2 py-0.5 font-medium hover:bg-amber/15">
            {problem ? 'Review & approve' : 'Open the panel'}
          </button>
        </div>
      )}
      {/* stage strip */}
      <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] px-3 py-2">
        {stages.map((s, i) => {
          const active = s.key === stage.key;
          const p = stageProgress(s.key);
          return (
            <div key={s.key} className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStage(s.key)}
                className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                  active
                    ? 'border-white/20 bg-white/[0.08]'
                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                }`}
                title={`${s.name} — ${p}% complete`}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-md"
                  style={{ background: `${s.color}1f`, color: active ? s.color : '#94a3b8' }}
                >
                  <StageIcon name={s.icon} className="h-3.5 w-3.5" />
                </span>
                <span className={`text-[11.5px] font-medium ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {s.name}
                </span>
                {p > 0 && <ProgressRing value={p} size={14} stroke={2} color={s.color} />}
              </button>
              {i < stages.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />}
            </div>
          );
        })}
      </div>

      {/* stage header */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10"
            style={{ background: `${stage.color}18`, color: stage.color }}
          >
            <StageIcon name={stage.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight text-white">{stage.name}</h2>
              <Pill tone="slate">stage {idx + 1} of {stages.length}</Pill>
              {project.stage_key === stage.key && <Pill tone="electric">current</Pill>}
              <span className="text-[10.5px] text-slate-500">{pct}% complete</span>
            </div>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-slate-400">{stage.tagline}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {stageTools.slice(0, 5).map((t) => (
              <a key={t.id} href={t.url} target="_blank" rel="noreferrer noopener" title={`${t.name} · ${t.free_tier}`}>
                <ToolIcon name={t.name} color={t.color} size={26} rounded={7} />
              </a>
            ))}
            {next && canEdit && (
              <button type="button" className="btn-ghost ml-1 px-2.5 py-1.5 text-[11px]" onClick={advance}>
                Advance to {next.name} <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`tab ${tab === t.key ? 'tab-active' : ''}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {typeof t.count === 'number' && <span className="text-[10px] text-slate-500">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'plan' && (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-4">
              <div className="panel p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-slate-400" />
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-slate-300">Stage checklist</h3>
                  <span className="ml-auto text-[10.5px] text-slate-500">{doneCount}/{stageTasks.length}</span>
                </div>
                <div className="space-y-1">
                  {(stage.checklist?.length ? stage.checklist : ['No checklist yet — add one from the admin console.']).map((item) => {
                    const task = stageTasks.find((t) => t.title === item);
                    const done = task?.status === 'done';
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleChecklist(item)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.03]"
                      >
                        <span
                          className={`mt-px grid h-[17px] w-[17px] shrink-0 place-items-center rounded-md border transition ${
                            done ? 'border-mint/60 bg-mint/25 text-mint' : 'border-white/20 bg-white/[0.03] text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className={`text-[12.5px] leading-relaxed ${done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                          {item}
                        </span>
                        {task?.owner && <span className="ml-auto shrink-0 text-[9.5px] text-slate-600">{task.owner.split(' ')[0]}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="panel p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-electric-soft" />
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-slate-300">What to produce here</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {stageArtifacts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setTab('docs')}
                      className="panel-flat card-hover flex items-start gap-2 p-2.5 text-left"
                    >
                      <FileText className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.content ? 'text-mint' : 'text-slate-600'}`} />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-slate-200">{a.title}</div>
                        <div className="text-[10px] text-slate-500">{a.content ? `${a.status} · ready to edit` : 'not generated'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {problem && (
                <div className="rounded-xl border border-electric/20 bg-electric/[0.06] p-3.5">
                  <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-electric-soft">
                    Building against
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-300">{problem.statement}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="panel p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-slate-300">Free tools for this stage</h3>
                  <button type="button" onClick={() => setTab('tools')} className="ml-auto text-[10.5px] text-electric-soft hover:underline">
                    see all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {stageTools.slice(0, 8).map((t) => (
                    <a
                      key={t.id}
                      href={t.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="panel-flat card-hover flex items-center gap-2 p-2"
                      title={`${t.description}\n${t.free_tier}`}
                    >
                      <ToolIcon name={t.name} color={t.color} size={26} rounded={7} />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-200">{t.name}</div>
                        <div className="truncate text-[9.5px] text-slate-500">{t.free_tier}</div>
                      </div>
                    </a>
                  ))}
                </div>
                {canEdit && (
                  <button type="button" onClick={onManage} className="btn-subtle mt-2 w-full py-1.5 text-[10.5px]">
                    <Wand2 className="h-3 w-3" /> Edit the tool kit
                  </button>
                )}
              </div>

              <div className="panel p-4">
                <h3 className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-slate-300">Who is on it</h3>
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const owned = stageTasks.filter((t) => t.owner === m.name);
                    const done = owned.filter((t) => t.status === 'done').length;
                    return (
                      <div key={m.user_id} className="flex items-center gap-2 text-[11.5px]">
                        <Circle className="h-2 w-2" style={{ color: m.role === 'pm' ? '#818cf8' : '#475569', fill: 'currentColor' }} />
                        <span className="text-slate-300">{m.name}</span>
                        <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] uppercase tracking-wider text-slate-500">{m.role}</span>
                        <span className="ml-auto text-[10px] text-slate-600">{owned.length ? `${done}/${owned.length}` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'docs' && (
          <DocView
            code={code}
            artifacts={artifacts}
            stages={stages}
            stageKey={stage.key}
            onArtifacts={onArtifacts}
            canEdit={canEdit}
            live={live}
            engine={engine}
          />
        )}

        {tab === 'board' && (
          <Board
            code={code}
            tasks={tasks}
            members={members}
            stages={stages}
            stageKey={stage.key}
            canEdit={canEdit}
            onTasks={onTasks}
          />
        )}

        {tab === 'tools' && (
          <ToolWall tools={tools} stages={stages} stageKey={stage.key} canAdmin={canEdit} onManage={onManage} />
        )}
      </div>
    </div>
  );
}
