'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2, Flag } from 'lucide-react';
import type { Member, Stage, StageKey, Task, TaskStatus } from '@/lib/types';
import { del, patch, post } from '@/lib/client';
import { Avatar, Pill, Spinner } from './ui';

const COLUMNS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: 'todo', label: 'To do', tone: '#94a3b8' },
  { key: 'doing', label: 'In progress', tone: '#fbbf24' },
  { key: 'review', label: 'In review', tone: '#818cf8' },
  { key: 'done', label: 'Done', tone: '#34d399' },
];

const PRIORITY_TONE: Record<string, 'rose' | 'amber' | 'slate'> = { P0: 'rose', P1: 'amber', P2: 'slate' };

export default function Board({
  code,
  tasks,
  members,
  stages,
  stageKey,
  canEdit,
  onTasks,
}: {
  code: string;
  tasks: Task[];
  members: Member[];
  stages: Stage[];
  stageKey: StageKey;
  canEdit: boolean;
  onTasks: (t: Task[]) => void;
}) {
  const [scope, setScope] = useState<'stage' | 'all'>('stage');
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState({ title: '', owner: '', priority: 'P1', stage_key: stageKey });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const shown = useMemo(
    () => (scope === 'stage' ? tasks.filter((t) => t.stage_key === stageKey) : tasks),
    [tasks, scope, stageKey],
  );

  const move = async (task: Task, status: TaskStatus) => {
    if (!canEdit && task.owner !== undefined) {
      /* members can move their own work */
    }
    onTasks(tasks.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', { code, id: task.id, status });
      onTasks(res.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const add = async (status: TaskStatus) => {
    if (!draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ tasks: Task[] }>('/api/tasks', {
        code,
        title: draft.title,
        status,
        owner: draft.owner || null,
        priority: draft.priority,
        stage_key: draft.stage_key,
      });
      onTasks(res.tasks);
      setDraft({ title: '', owner: '', priority: 'P1', stage_key: stageKey });
      setAdding(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    onTasks(tasks.filter((t) => t.id !== id));
    try {
      const res = await del<{ tasks: Task[] }>(`/api/tasks?code=${code}&id=${id}`);
      onTasks(res.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const total = shown.length;
  const done = shown.filter((t) => t.status === 'done').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
          <button type="button" onClick={() => setScope('stage')} className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'stage' ? 'bg-white/[0.09] text-white' : 'text-slate-400'}`}>
            This stage
          </button>
          <button type="button" onClick={() => setScope('all')} className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'all' ? 'bg-white/[0.09] text-white' : 'text-slate-400'}`}>
            Whole product
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          <span>{done}/{total} done</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[11.5px] text-rose">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = shown.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className="flex min-h-[160px] flex-col rounded-xl border border-white/[0.07] bg-white/[0.015] p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const t = tasks.find((x) => x.id === dragging);
                if (t && t.status !== col.key) move(t, col.key);
                setDragging(null);
              }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.tone }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{col.label}</span>
                <span className="ml-auto text-[10px] text-slate-600">{items.length}</span>
              </div>

              <div className="flex-1 space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`group cursor-grab rounded-lg border border-white/[0.07] bg-ink-800/80 p-2.5 active:cursor-grabbing ${
                      dragging === t.id ? 'opacity-40' : ''
                    } ${t.status === 'done' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] leading-snug ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                          {t.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill tone={PRIORITY_TONE[t.priority] ?? 'slate'} className="!px-1.5 !py-0 !text-[9px]">{t.priority}</Pill>
                          {scope === 'all' && (
                            <span className="rounded bg-white/[0.05] px-1 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                              {stages.find((s) => s.key === t.stage_key)?.name ?? t.stage_key}
                            </span>
                          )}
                          {t.owner && <span className="text-[9.5px] text-slate-500">{t.owner.split(' ')[0]}</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => remove(t.id)}
                          className="rounded p-1 text-slate-700 opacity-0 transition hover:bg-rose/10 hover:text-rose group-hover:opacity-100"
                          aria-label="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {adding === col.key ? (
                <div className="mt-2 space-y-1.5 rounded-lg border border-electric/30 bg-ink-900/80 p-2">
                  <input
                    autoFocus
                    className="field px-2 py-1.5 text-[11.5px]"
                    placeholder="What needs doing?"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') add(col.key);
                      if (e.key === 'Escape') setAdding(null);
                    }}
                  />
                  <div className="flex gap-1.5">
                    <select className="field px-1.5 py-1 text-[10.5px]" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <select className="field px-1.5 py-1 text-[10.5px]" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                      <option value="P0">P0</option>
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className="btn-primary flex-1 px-2 py-1 text-[11px]" onClick={() => add(col.key)} disabled={busy}>
                      {busy ? <Spinner className="h-3 w-3" /> : <Plus className="h-3 w-3" />} Add
                    </button>
                    <button type="button" className="btn-subtle px-2 py-1 text-[11px]" onClick={() => setAdding(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(col.key);
                    setDraft((d) => ({ ...d, stage_key: stageKey }));
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 py-1.5 text-[11px] text-slate-500 transition hover:border-white/25 hover:text-slate-300"
                >
                  <Plus className="h-3 w-3" /> Add task
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-600">
        <Flag className="h-3 w-3" />
        Drag cards between columns. Every stage checklist item is pre-loaded as a task, so nothing gets skipped.
        <div className="ml-auto flex items-center gap-1">
          {members.slice(0, 5).map((m) => (
            <Avatar key={m.user_id} name={m.name} size={18} />
          ))}
        </div>
      </div>
    </div>
  );
}
