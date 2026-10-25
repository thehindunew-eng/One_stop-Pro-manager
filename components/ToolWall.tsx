'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight, Check, ChevronRight, ExternalLink, Link2, Plus, Search, SlidersHorizontal,
  Sparkles, X,
} from 'lucide-react';
import type { StackStatus, Stage, StageKey, Task, Tool, ToolStack } from '@/lib/types';
import { del, hostFromUrl, patch, post } from '@/lib/client';
import { Pill, Spinner, ToolIcon } from './ui';

const STATUS: Record<StackStatus, { label: string; blurb: string; tone: string; dot: string }> = {
  planned: { label: 'Planned', blurb: 'We intend to use it', tone: 'border-slate-300 bg-white text-slate-600', dot: '#94a3b8' },
  trial: { label: 'Trial', blurb: 'Someone is testing it', tone: 'border-amber-300 bg-amber-50 text-amber-800', dot: '#d97706' },
  using: { label: 'In use', blurb: 'This is our live tool', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800', dot: '#059669' },
  parked: { label: 'Parked', blurb: 'Not for this product', tone: 'border-slate-200 bg-slate-100 text-slate-500', dot: '#cbd5e1' },
};

export default function ToolWall({
  code,
  tools,
  stages,
  stacks,
  stageKey,
  canAdmin,
  onManage,
  onStacks,
  onTasks,
}: {
  code: string;
  tools: Tool[];
  stages: Stage[];
  stacks: ToolStack[];
  stageKey?: StageKey;
  canAdmin?: boolean;
  onManage?: () => void;
  onStacks: (s: ToolStack[]) => void;
  onTasks?: (t: Task[]) => void;
}) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'stage' | 'all' | 'using'>(stageKey ? 'stage' : 'all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: StackStatus; our_url: string; note: string }>({ status: 'planned', our_url: '', note: '' });
  const [busy, setBusy] = useState<'save' | 'task' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stackOf = (toolId: string) => stacks.find((s) => s.tool_id === toolId);
  const statusOf = (toolId: string): StackStatus => stackOf(toolId)?.status ?? 'planned';

  const filtered = useMemo(() => {
    let list = tools;
    if (scope === 'stage' && stageKey) list = list.filter((t) => t.stages.includes(stageKey));
    if (scope === 'using') list = list.filter((t) => statusOf(t.id) === 'using' || statusOf(t.id) === 'trial');
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle) ||
          t.description.toLowerCase().includes(needle),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, q, scope, stageKey, stacks]);

  const groups = useMemo(() => {
    const map = new Map<string, Tool[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const active = tools.find((t) => t.id === openId) ?? null;
  const activeStack = active ? stackOf(active.id) : undefined;

  function openSheet(t: Tool) {
    const stack = stackOf(t.id);
    setDraft({ status: stack?.status ?? 'planned', our_url: stack?.our_url ?? '', note: stack?.note ?? '' });
    setError(null);
    setSaved(false);
    setOpenId(t.id);
  }

  async function save() {
    if (!active) return;
    setBusy('save');
    setError(null);
    try {
      const res = await patch<{ stacks: ToolStack[] }>('/api/tools/stack', {
        code,
        tool_id: active.id,
        status: draft.status,
        our_url: draft.our_url,
        note: draft.note,
      });
      onStacks(res.stacks);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function addSetupTask() {
    if (!active) return;
    setBusy('task');
    setError(null);
    try {
      const stage = active.stages[0] ?? 'build';
      const res = await post<{ tasks: Task[] }>('/api/tasks', {
        code,
        title: `Set up ${active.name}${active.free_tier ? ` (${active.free_tier})` : ''}`,
        detail: `Decide the ${active.name} setup for this product, record the workspace link and who owns it.`,
        stage_key: stage,
        priority: 'P2',
      });
      onTasks?.(res.tasks);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function clearOurStatus() {
    if (!active) return;
    setBusy('save');
    setError(null);
    try {
      const res = await del<{ stacks: ToolStack[] }>(`/api/tools/stack?code=${code}&tool_id=${active.id}`);
      onStacks(res.stacks);
      setDraft({ status: 'planned', our_url: '', note: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const stageName = stages.find((s) => s.key === stageKey)?.name;
  const inUse = tools.filter((t) => ['using', 'trial'].includes(statusOf(t.id))).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className="field py-2 pl-9 text-[12.5px]"
            placeholder="Find a tool, category or use case…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
          {stageKey && (
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'stage' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setScope('stage')}
            >
              {stageName ?? 'This stage'}
            </button>
          )}
          <button
            type="button"
            className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'all' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setScope('all')}
          >
            All {tools.length}
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'using' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setScope('using')}
          >
            Our stack {inUse}
          </button>
        </div>
        {canAdmin && onManage && (
          <button type="button" className="btn-ghost py-2 text-[12px]" onClick={onManage}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Manage
          </button>
        )}
      </div>

      <p className="mb-4 text-[11.5px] leading-relaxed text-slate-500">
        Click a tool to see what it is for, mark whether your team uses it, paste <em>your</em> workspace link and drop a
        setup task on the board. Everyone in the room can do this — only the owner edits the catalogue.
      </p>

      <div className="space-y-5">
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{cat}</span>
              <span className="text-[10px] text-slate-400">{list.length}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((t) => {
                const st = STATUS[statusOf(t.id)];
                const stack = stackOf(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openSheet(t)}
                    className="group panel-flat card-hover flex items-start gap-2.5 p-2.5 text-left"
                    title={t.description}
                  >
                    <div className="relative">
                      <ToolIcon name={t.name} color={t.color} size={32} rounded={9} />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
                        style={{ background: st.dot }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-medium text-slate-900">{t.name}</span>
                        <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
                      </div>
                      <div className="truncate text-[10.5px] text-slate-500">{t.free_tier || t.category}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-medium" style={{ color: st.dot }}>
                          <span className="h-1 w-1 rounded-full" style={{ background: st.dot }} /> {st.label}
                        </span>
                        {stack?.our_url && (
                          <span className="inline-flex items-center gap-0.5 truncate text-[9.5px] text-slate-400">
                            <Link2 className="h-2.5 w-2.5" /> {hostFromUrl(stack.our_url)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!groups.length && (
          <div className="panel-flat p-6 text-center text-[12.5px] text-slate-500">
            {scope === 'using'
              ? 'No tools marked in use yet. Open a tool and set it to “In use”.'
              : `No tool matches “${q}”. ${canAdmin ? 'Add it from the owner console.' : 'Ask the owner to add it.'}`}
          </div>
        )}
      </div>

      {/* tool sheet */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpenId(null)}>
          <div
            className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-2xl sm:rounded-2xl scroll-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3.5">
              <ToolIcon name={active.name} color={active.color} size={44} rounded={12} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-slate-900">{active.name}</h3>
                <div className="text-[11px] text-slate-500">{active.category} · {hostFromUrl(active.url)}</div>
              </div>
              <button type="button" className="btn-subtle p-1.5" onClick={() => setOpenId(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 px-4 py-4">
              <p className="text-[12.5px] leading-relaxed text-slate-600">{active.description}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Free tier</div>
                  <div className="text-[11.5px] font-medium text-slate-800">{active.free_tier || 'Free to start'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Used in stages</div>
                  <div className="text-[11.5px] font-medium text-slate-800">
                    {active.stages.map((k) => stages.find((s) => s.key === k)?.name ?? k).slice(0, 3).join(', ')}
                    {active.stages.length > 3 ? ` +${active.stages.length - 3}` : ''}
                  </div>
                </div>
              </div>

              <div>
                <span className="label">Our status</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(Object.keys(STATUS) as StackStatus[]).map((key) => {
                    const conf = STATUS[key];
                    const on = draft.status === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDraft({ ...draft, status: key })}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                          on ? conf.tone : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                        title={conf.blurb}
                      >
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="stack-url">Our workspace link <span className="normal-case tracking-normal text-slate-400">(optional)</span></label>
                <input
                  id="stack-url"
                  className="field text-[12px]"
                  placeholder={active.url ? `${hostFromUrl(active.url)}/our-workspace` : 'https://…'}
                  value={draft.our_url}
                  onChange={(e) => setDraft({ ...draft, our_url: e.target.value })}
                />
                <p className="mt-1 text-[10.5px] text-slate-500">
                  Paste the link your team actually works in, so nobody hunts for it during the meeting.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="stack-note">Note for the team</label>
                <textarea
                  id="stack-note"
                  className="field min-h-[64px] text-[12px] leading-relaxed"
                  placeholder="Who owns it, what plan we are on, what to do before we upgrade…"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </div>

              {activeStack?.updated_by && (
                <div className="text-[10.5px] text-slate-500">
                  Last updated by {activeStack.updated_by} · {new Date(activeStack.updated_at).toLocaleDateString()}
                </div>
              )}

              {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose">{error}</div>}
              {saved && (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Saved for the whole team
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
              <button type="button" className="btn-primary px-3 py-2 text-[12px]" onClick={save} disabled={busy !== null}>
                {busy === 'save' ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Save
              </button>
              <button type="button" className="btn-ghost px-3 py-2 text-[12px]" onClick={addSetupTask} disabled={busy !== null}>
                {busy === 'task' ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Setup task
              </button>
              <a href={active.url} target="_blank" rel="noreferrer noopener" className="btn-ghost px-3 py-2 text-[12px]">
                <ExternalLink className="h-3.5 w-3.5" /> Open {active.name}
              </a>
              {activeStack && (
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-2 text-[11.5px] text-slate-500 hover:text-rose"
                  onClick={clearOurStatus}
                  disabled={busy !== null}
                  title="Take this tool out of our stack"
                >
                  Clear
                </button>
              )}
              <a href={active.url} target="_blank" rel="noreferrer noopener" className="ml-auto hidden items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 sm:flex">
                {hostFromUrl(active.url)} <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
