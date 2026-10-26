'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronRight, User, Info, CalendarDays } from 'lucide-react';
import type { Member, Stage, StageKey, Task, TaskStatus } from '@/lib/types';
import { del, patch, post } from '@/lib/client';
import { dueWords, isOverdue, isoDate, todayISO } from '@/lib/dates';
import { Avatar, Pill, Spinner } from './ui';

const COLUMNS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: 'todo', label: 'To do', tone: '#98a2b3' },
  { key: 'doing', label: 'In progress', tone: '#4338ca' },
  { key: 'review', label: 'In review', tone: '#b45309' },
  { key: 'done', label: 'Done', tone: '#047857' },
];

const PRIORITY_TONE: Record<string, 'rose' | 'amber' | 'slate'> = { P0: 'rose', P1: 'amber', P2: 'slate' };

export default function Board({
  code,
  tasks,
  members,
  stages,
  stageKey,
  canEdit,
  me,
  onTasks,
}: {
  code: string;
  tasks: Task[];
  members: Member[];
  stages: Stage[];
  stageKey: StageKey;
  canEdit: boolean;
  me: { name: string; role: string };
  onTasks: (t: Task[]) => void;
}) {
  const [scope, setScope] = useState<'stage' | 'all'>('stage');
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState({ title: '', owner: '', priority: 'P1', stage_key: stageKey, due: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const shown = useMemo(
    () => (scope === 'stage' ? tasks.filter((t) => t.stage_key === stageKey) : tasks),
    [tasks, scope, stageKey],
  );

  const move = async (task: Task, status: TaskStatus) => {
    onTasks(tasks.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', { code, id: task.id, status });
      onTasks(res.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Anyone in the room can hand work to anyone else — that is how teams actually work. */
  const assign = async (task: Task, owner: string | null) => {
    onTasks(tasks.map((t) => (t.id === task.id ? { ...t, owner } : t)));
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', { code, id: task.id, owner });
      onTasks(res.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Due dates are what make a board a plan. Anyone can promise a date. */
  const setDue = async (task: Task, due: string) => {
    onTasks(tasks.map((t) => (t.id === task.id ? { ...t, due_date: due || null } : t)));
    try {
      const res = await patch<{ tasks: Task[] }>('/api/tasks', { code, id: task.id, due_date: due || null });
      onTasks(res.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const dueMeta = (task: Task) => {
    const words = dueWords(task.due_date, task.status === 'done');
    if (!words) return null;
    const tone = words.tone === 'late' ? 'text-rose' : words.tone === 'soon' ? 'text-amber-800' : 'text-slate-500';
    return { text: words.text, tone };
  };

  const nextStatus = (s: TaskStatus): TaskStatus =>
    s === 'todo' ? 'doing' : s === 'doing' ? 'review' : s === 'review' ? 'done' : 'todo';

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
        due_date: draft.due || null,
      });
      onTasks(res.tasks);
      setDraft({ title: '', owner: '', priority: 'P1', stage_key: stageKey, due: '' });
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
  const today = todayISO();
  const overdue = shown.filter((t) => t.status !== 'done' && isOverdue(t.due_date, today)).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="well flex items-center gap-1 rounded-lg p-0.5">
          <button type="button" onClick={() => setScope('stage')} className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium ${scope === 'stage' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            This stage
          </button>
          <button type="button" onClick={() => setScope('all')} className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium ${scope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            Whole product
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-slate-500">
          {overdue > 0 && <span className="text-rose">{overdue} overdue</span>}
          <span>{done}/{total} done</span>
          <div className="meter h-1.5 w-24">
            <div className="meter-fill meter-fill-mint" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = shown.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className="well flex min-h-[160px] flex-col rounded-xl p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const t = tasks.find((x) => x.id === dragging);
                if (t && t.status !== col.key) move(t, col.key);
                setDragging(null);
              }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.tone }} />
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">{col.label}</span>
                <span className="ml-auto text-[12px] text-slate-500">{items.length}</span>
              </div>

              <div className="flex-1 space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`glass-card group cursor-grab p-2.5 transition active:cursor-grabbing ${
                      dragging === t.id ? 'opacity-40' : ''
                    } ${t.status === 'done' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] leading-snug ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {t.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill tone={PRIORITY_TONE[t.priority] ?? 'slate'} className="!px-1.5 !py-0 !text-[12px]">{t.priority}</Pill>
                          {scope === 'all' && (
                            <span className="rounded bg-white/55 px-1 py-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                              {stages.find((s) => s.key === t.stage_key)?.name ?? t.stage_key}
                            </span>
                          )}
                          <select
                            value={t.owner ?? ''}
                            onChange={(e) => assign(t, e.target.value || null)}
                            title="Who owns this?"
                            className={`max-w-[92px] cursor-pointer truncate rounded px-1 py-0.5 text-[12px] outline-none ${
                              t.owner ? 'bg-white/55 text-slate-600' : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.user_id} value={m.name}>{m.name}</option>
                            ))}
                            {t.owner && !members.some((m) => m.name === t.owner) && (
                              <option value={t.owner}>{t.owner}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => assign(t, me.name)}
                            title={`Assign to me (${me.name})`}
                            className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-indigo-50 hover:text-electric group-hover:opacity-100"
                          >
                            <User className="h-2.5 w-2.5" />
                          </button>
                          {(() => {
                            const due = dueMeta(t);
                            return (
                              <label
                                className={`inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] ${due ? due.tone : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}
                                title={t.due_date ? `Due ${isoDate(t.due_date)} — click to change` : 'Set a due date'}
                              >
                                <CalendarDays className="h-2.5 w-2.5" />
                                {due?.text ?? 'date'}
                                <input
                                  type="date"
                                  value={isoDate(t.due_date) ?? ''}
                                  onChange={(e) => setDue(t, e.target.value)}
                                  className="w-0 border-0 p-0 opacity-0"
                                  tabIndex={-1}
                                />
                              </label>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => move(t, nextStatus(t.status))}
                          title={`Move to ${nextStatus(t.status)}`}
                          className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-white/60 hover:text-slate-800 group-hover:opacity-100"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        {(canEdit || t.owner === me.name) && (
                          <button
                            type="button"
                            onClick={() => remove(t.id)}
                            className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-rose/10 hover:text-rose group-hover:opacity-100"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {adding === col.key ? (
                <div className="mt-2 space-y-1.5 rounded-lg border border-slate-900/30 bg-white/70 p-2">
                  <input
                    autoFocus
                    className="field px-2 py-1.5 text-[12px]"
                    placeholder="What needs doing?"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') add(col.key);
                      if (e.key === 'Escape') setAdding(null);
                    }}
                  />
                  <div className="flex gap-1.5">
                    <select className="field px-1.5 py-1 text-[12px]" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <select className="field px-1.5 py-1 text-[12px]" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                      <option value="P0">P0</option>
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className="btn-primary flex-1 px-2 py-1 text-[12px]" onClick={() => add(col.key)} disabled={busy}>
                      {busy ? <Spinner className="h-3 w-3" /> : <Plus className="h-3 w-3" />} Add
                    </button>
                    <input
                      type="date"
                      className="field h-8 flex-1 py-0 text-[12px]"
                      value={draft.due}
                      onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                      title="Due date (optional)"
                    />
                    <button type="button" className="btn-subtle px-2 py-1 text-[12px]" onClick={() => setAdding(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(col.key);
                    setDraft((d) => ({ ...d, stage_key: stageKey }));
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-900/10 py-1.5 text-[12px] text-slate-500 transition hover:border-slate-900/70 hover:text-slate-500"
                >
                  <Plus className="h-3 w-3" /> Add task
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Info className="h-3 w-3" />
        Drag cards between columns — or use the arrow for one-tap moves on a phone. Click a name to reassign; anyone in the
        room can hand work to anyone else.
        <div className="ml-auto flex items-center gap-1">
          {members.slice(0, 5).map((m) => (
            <Avatar key={m.user_id} name={m.name} size={18} />
          ))}
        </div>
      </div>
    </div>
  );
}
