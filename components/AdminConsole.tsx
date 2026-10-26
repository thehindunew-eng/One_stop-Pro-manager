'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowLeft, Check, Copy, Plus, Save, ShieldCheck, Sliders, Sparkles, Trash2, Users, Wand2, Wrench, X,
} from 'lucide-react';
import type { Member, Stage, Tool, WorkspaceState, StageKey } from '@/lib/types';
import { api, del, patch, post, setAuthToken } from '@/lib/client';
import { stageAccent } from '@/lib/defaults';
import { defaultGate, describeRule, gateFor, type GateRule } from '@/lib/plan';
import LiveStatus from './LiveStatus';
import { Avatar, Pill, StageIcon, STAGE_ICONS, Spinner, ToolIcon, Wordmark } from './ui';
import LocalAI from './LocalAI';

const ICON_NAMES = Object.keys(STAGE_ICONS);
const ROLES = ['pm', 'design', 'eng', 'qa', 'growth', 'member'];
const CATEGORIES = [
  'Meetings & Docs', 'Whiteboard & Ideation', 'Research & Validation', 'Design & Prototype',
  'Code & Repo', 'Database & Backend', 'Deploy & Infra', 'AI & Models', 'Payments & Auth',
  'Testing & QA', 'Analytics & Feedback', 'Growth & Launch', 'Project Management', 'Automation',
];

type Tab = 'stages' | 'tools' | 'team' | 'live' | 'engine';

export default function AdminConsole({
  initialState,
  token = null,
}: {
  initialState: WorkspaceState;
  token?: string | null;
}) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<Tab>('stages');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aipm, setAipm] = useState({ enabled: true, strict: false, maxPerPersonPerDay: 3, digest: 'daily' });
  const [aipmSaving, setAipmSaving] = useState(false);

  const code = state.project.code;

  useEffect(() => {
    api<{ settings: typeof aipm }>(`/api/aipm?code=${encodeURIComponent(code)}`)
      .then((d) => setAipm(d.settings))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function saveAipm(patch: Partial<typeof aipm>) {
    const next = { ...aipm, ...patch };
    setAipm(next);
    setAipmSaving(true);
    try {
      const res = await post<{ settings: typeof aipm }>('/api/aipm', { code, action: 'settings', ...next });
      setAipm(res.settings);
      flash('AI PM settings saved');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAipmSaving(false);
    }
  }

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    api<{ tools: Tool[] }>(`/api/admin/tools?code=${code}`)
      .then((data) => {
        if (data?.tools) setState((v) => ({ ...v, tools: data.tools }));
      })
      .catch(() => undefined);
  }, [code]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const fail = (e: unknown) => setError((e as Error).message);

  async function reload() {
    try {
      const res = await api<WorkspaceState>(`/api/workspace?code=${code}`);
      if (res?.project) setState(res);
    } catch {
      /* keep the current view */
    }
  }

  /* ------------------------------ stages ------------------------------ */
  const [stageEdits, setStageEdits] = useState<Record<string, Partial<Stage>>>({});
  const stageOf = (s: Stage): Stage => ({ ...s, ...(stageEdits[s.key] ?? {}) });

  async function saveStage(s: Stage) {
    const edit = stageOf(s);
    try {
      const res = await post<{ stages: Stage[] }>('/api/admin/stages', {
        code,
        key: s.key,
        name: edit.name,
        tagline: edit.tagline,
        icon: edit.icon,
        color: edit.color,
        position: edit.position,
        enabled: edit.enabled,
        checklist: edit.checklist,
        gate: (edit as Stage & { gate?: GateRule[] }).gate,
      });
      setState((v) => ({ ...v, stages: res.stages }));
      setStageEdits((v) => {
        const next = { ...v };
        delete next[s.key];
        return next;
      });
      flash(`${edit.name} updated`);
    } catch (e) {
      fail(e);
    }
  }

  const [newStage, setNewStage] = useState({ key: '', name: '', tagline: '', icon: 'Compass', color: '#6366f1' });
  async function createStage() {
    try {
      const res = await post<{ stages: Stage[] }>('/api/admin/stages', { code, action: 'create', ...newStage });
      setState((v) => ({ ...v, stages: res.stages }));
      setNewStage({ key: '', name: '', tagline: '', icon: 'Compass', color: '#6366f1' });
      flash('Stage added to the lifecycle');
    } catch (e) {
      fail(e);
    }
  }

  /* ------------------------------ tools ------------------------------ */
  const [toolEdits, setToolEdits] = useState<Record<string, Partial<Tool>>>({});
  const [newTool, setNewTool] = useState<Partial<Tool>>({ name: '', category: CATEGORIES[0], stages: [], color: '6366f1', url: '', free_tier: '', description: '', enabled: true });
  const [showNewTool, setShowNewTool] = useState(false);
  const [toolQuery, setToolQuery] = useState('');

  const toolOf = (t: Tool): Tool => ({ ...t, ...(toolEdits[t.id] ?? {}) });

  async function saveTool(t: Tool) {
    const edit = toolOf(t);
    try {
      const res = await post<{ tools: Tool[] }>('/api/admin/tools', {
        code,
        id: t.id,
        name: edit.name,
        category: edit.category,
        stages: edit.stages,
        url: edit.url,
        color: edit.color,
        free_tier: edit.free_tier,
        description: edit.description,
        enabled: edit.enabled !== false,
      });
      setState((v) => ({ ...v, tools: res.tools }));
      setToolEdits((v) => {
        const next = { ...v };
        delete next[t.id];
        return next;
      });
      flash(`${edit.name} saved`);
    } catch (e) {
      fail(e);
    }
  }

  async function createTool() {
    if (!newTool.name || !newTool.category) return;
    try {
      const res = await post<{ tools: Tool[] }>('/api/admin/tools', {
        code,
        name: newTool.name,
        category: newTool.category,
        stages: newTool.stages?.length ? newTool.stages : ['build'],
        url: newTool.url,
        color: newTool.color,
        free_tier: newTool.free_tier,
        description: newTool.description,
      });
      setState((v) => ({ ...v, tools: res.tools }));
      setNewTool({ name: '', category: CATEGORIES[0], stages: [], color: '6366f1', url: '', free_tier: '', description: '', enabled: true });
      setShowNewTool(false);
      flash('Tool added to the wall');
    } catch (e) {
      fail(e);
    }
  }

  async function removeTool(t: Tool) {
    if (!confirm(`Remove ${t.name} from the tool wall?`)) return;
    try {
      const res = await del<{ tools: Tool[] }>(`/api/admin/tools?code=${code}&id=${t.id}`);
      setState((v) => ({ ...v, tools: res.tools }));
      flash(`${t.name} removed`);
    } catch (e) {
      fail(e);
    }
  }

  /* ------------------------------ team ------------------------------ */
  const [members, setMembers] = useState<Member[]>(state.members);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  async function teamAction(body: Record<string, unknown>) {
    try {
      const res = await post<{ members: Member[] }>('/api/admin/team', { code, ...body });
      setMembers(res.members);
      setState((v) => ({ ...v, members: res.members }));
      flash('Team updated');
    } catch (e) {
      fail(e);
    }
  }

  /* ------------------------------ settings ------------------------------ */
  const [identity, setIdentity] = useState({ name: state.project.name, tagline: state.project.tagline ?? '' });
  async function saveIdentity() {
    try {
      const res = await patch<{ project: typeof state.project }>('/api/project', { code, ...identity });
      setState((v) => ({ ...v, project: res.project }));
      flash('Workspace saved');
    } catch (e) {
      fail(e);
    }
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : `/room/${code}`;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'stages', label: 'Lifecycle', icon: Sliders },
    { key: 'tools', label: 'Tools', icon: Wrench },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'live', label: 'Live', icon: Activity },
    { key: 'engine', label: 'Workspace', icon: Sparkles },
  ];

  return (
    <div className="app-bg min-h-screen">
      <header className="glass-bar sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Wordmark compact />
          <div className="h-6 w-px bg-slate-200" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[13px] font-semibold text-slate-900">Owner console</h1>
              <Pill tone="amber"><ShieldCheck className="h-3 w-3" /> full edit access</Pill>
            </div>
            <div className="truncate text-[12px] text-slate-500">{state.project.name} · /room/{code}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href={`/room/${code}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to the room
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 pb-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`tab ${tab === t.key ? 'tab-active' : ''}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
          <span className="ml-auto hidden text-[12px] text-slate-500 sm:block">
            Changes are stored in Postgres — no deploy needed.
          </span>
        </div>
      </header>

      {(toast || error) && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] shadow-pop ${error ? 'border-rose-200 bg-white text-rose' : 'border-emerald-200 bg-white text-emerald-800'}`}>
            {error ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {error || toast}
            <button type="button" onClick={() => { setError(null); setToast(null); }} className="ml-1 opacity-60"><X className="h-3 w-3" /></button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'stages' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-semibold text-slate-900">The lifecycle</h2>
                <p className="text-[12px] text-slate-500">
                  Rename stages, change icons and colours, edit the checklist that becomes board tasks, or disable a stage.
                  New stages appear in the room immediately.
                </p>
              </div>
              <Pill tone="slate">{state.stages.length} stages</Pill>
            </div>

            <div className="space-y-3">
              {state.stages.map((raw) => {
                const s = stageOf(raw);
                const dirty = !!stageEdits[raw.key];
                return (
                  <div key={raw.key} className="panel p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="label">Name</label>
                        <input
                          className="field"
                          value={s.name}
                          onChange={(e) => setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], name: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <label className="label">Tagline</label>
                        <input
                          className="field"
                          value={s.tagline}
                          onChange={(e) => setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], tagline: e.target.value } }))}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div>
                          <label className="label">Icon</label>
                          <select
                            className="field w-[110px]"
                            value={s.icon}
                            onChange={(e) => setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], icon: e.target.value } }))}
                          >
                            {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Colour</label>
                          <input
                            type="color"
                            className="h-[42px] w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent"
                            value={s.color}
                            onChange={(e) => setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], color: e.target.value } }))}
                          />
                        </div>
                        <div className="pb-2">
                          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={s.enabled !== false}
                              onChange={(e) => setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], enabled: e.target.checked } }))}
                              className="accent-indigo-500"
                            />
                            visible
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <div>
                        <label className="label">Checklist (one item per line → board tasks)</label>
                        <textarea
                          className="field min-h-[78px] text-[13px] leading-relaxed"
                          value={(s.checklist ?? []).join('\n')}
                          onChange={(e) =>
                            setStageEdits((v) => ({
                              ...v,
                              [raw.key]: { ...v[raw.key], checklist: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) },
                            }))
                          }
                        />
                      </div>
                    <div className="mt-3 rounded-lg border border-slate-900/20 bg-white/5560 p-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
                          Gate criteria — what “done” means
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {(s as Stage & { gate?: GateRule[] }).gate?.length
                            ? 'custom'
                            : 'the default for this stage'}
                        </span>
                        <button
                          type="button"
                          className="btn-subtle ml-auto h-6 px-1.5 text-[11px]"
                          onClick={() =>
                            setStageEdits((v) => ({
                              ...v,
                              [raw.key]: { ...v[raw.key], gate: defaultGate(raw.key) },
                            }))
                          }
                          title="Restore the default criteria for this stage"
                        >
                          Reset to default
                        </button>
                      </div>
                      <div className="space-y-1">
                        {gateFor(s).map((rule, i) => (
                          <div key={`${raw.key}-gate-${i}`} className="flex items-center gap-1.5">
                            <span
                              className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                rule.kind === 'manual' ? 'bg-amber-50 text-amber-800' : 'bg-slate-200 text-slate-600'
                              }`}
                              title={
                                rule.kind === 'manual'
                                  ? 'A person ticks this in the Run plan'
                                  : 'Read automatically from the room'
                              }
                            >
                              {rule.kind === 'manual' ? 'human' : 'auto'}
                            </span>
                            <input
                              className="field h-7 py-0 text-[12px]"
                              value={rule.label ?? describeRule(rule)}
                              onChange={(e) => {
                                const current = gateFor(s);
                                const next = current.map((r, idx) =>
                                  idx === i ? ({ ...r, label: e.target.value } as GateRule) : r,
                                );
                                setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], gate: next } }));
                              }}
                            />
                            <button
                              type="button"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose"
                              title="Remove this criterion"
                              onClick={() => {
                                const next = gateFor(s).filter((_, idx) => idx !== i);
                                setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], gate: next } }));
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {!gateFor(s).length && (
                          <p className="text-[12px] text-slate-500">
                            No criteria yet. A stage without a gate can never be proven done.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost mt-1.5 h-7 px-2 text-[11px]"
                        onClick={() => {
                          const next: GateRule[] = [
                            ...gateFor(s),
                            {
                              kind: 'manual',
                              id: `${raw.key}.custom.${Date.now().toString(36)}`,
                              label: 'Something a person must confirm',
                            },
                          ];
                          setStageEdits((v) => ({ ...v, [raw.key]: { ...v[raw.key], gate: next } }));
                        }}
                      >
                        <Plus className="h-3 w-3" /> Add a human criterion
                      </button>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Auto criteria read the room: the approved problem, document state, board progress, accepted decisions
                        and tools in use. Human criteria are ticked from the Run plan by whoever did the work.
                      </p>
                    </div>

                      <div className="flex flex-col items-end justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"
                            style={{ background: `${stageAccent(s.color)}18`, color: stageAccent(s.color) }}
                          >
                            <StageIcon name={s.icon} className="h-4 w-4" />
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-500">{s.key}</span>
                        </div>
                        <button type="button" className={`${dirty ? 'btn-primary' : 'btn-ghost'} px-3 py-1.5 text-[12px]`} onClick={() => saveStage(raw)} disabled={!dirty}>
                          <Save className="h-3.5 w-3.5" /> {dirty ? 'Save stage' : 'Saved'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panel p-4">
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                <Plus className="h-4 w-4 text-mint" /> Add a stage
              </h3>
              <div className="grid gap-2 md:grid-cols-4">
                <input className="field" placeholder="key (e.g. support)" value={newStage.key} onChange={(e) => setNewStage({ ...newStage, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
                <input className="field" placeholder="Name (e.g. Support)" value={newStage.name} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} />
                <input className="field" placeholder="Tagline" value={newStage.tagline} onChange={(e) => setNewStage({ ...newStage, tagline: e.target.value })} />
                <button type="button" className="btn-primary" onClick={createStage} disabled={!newStage.key || !newStage.name}>
                  <Plus className="h-4 w-4" /> Add stage
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500">
                Stages are additive — the default nine always stay compatible with existing docs.
              </p>
            </div>
          </div>
        )}

        {tab === 'tools' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-semibold text-slate-900">The tool wall</h2>
                <p className="text-[12px] text-slate-500">
                  {state.tools.length} live tools. Edit the free-tier note, link, colour and which stages each tool appears in.
                </p>
              </div>
              <button type="button" className="btn-primary px-3 py-2 text-[12px]" onClick={() => setShowNewTool((v) => !v)}>
                <Plus className="h-3.5 w-3.5" /> Add tool
              </button>
            </div>

            {showNewTool && (
              <div className="panel border-mint/25 p-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <input className="field" placeholder="Tool name" value={newTool.name ?? ''} onChange={(e) => setNewTool({ ...newTool, name: e.target.value })} />
                  <select className="field" value={newTool.category} onChange={(e) => setNewTool({ ...newTool, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="field" placeholder="https://tool.com" value={newTool.url ?? ''} onChange={(e) => setNewTool({ ...newTool, url: e.target.value })} />
                  <input className="field" placeholder="Free tier (e.g. 1,000 events / month)" value={newTool.free_tier ?? ''} onChange={(e) => setNewTool({ ...newTool, free_tier: e.target.value })} />
                  <input className="field" placeholder="What it is for" value={newTool.description ?? ''} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} />
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-[42px] w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent" value={`#${newTool.color}`} onChange={(e) => setNewTool({ ...newTool, color: e.target.value.replace('#', '') })} />
                    <button type="button" className="btn-primary flex-1" onClick={createTool}><Plus className="h-4 w-4" /> Add</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {state.stages.map((s) => {
                    const on = (newTool.stages ?? []).includes(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() =>
                          setNewTool({
                            ...newTool,
                            stages: on
                              ? (newTool.stages ?? []).filter((k) => k !== s.key)
                              : [...(newTool.stages ?? []), s.key],
                          })
                        }
                        className={`rounded-full border px-2 py-0.5 text-[12px] ${on ? 'border-slate-900 bg-white text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <input className="field" placeholder="Search tools…" value={toolQuery} onChange={(e) => setToolQuery(e.target.value)} />

            <div className="space-y-2">
              {state.tools
                .filter((t) => toolQuery ? (t.name + t.category + t.description).toLowerCase().includes(toolQuery.toLowerCase()) : true)
                .slice(0, 80)
                .map((raw) => {
                  const t = toolOf(raw);
                  const dirty = !!toolEdits[raw.id];
                  return (
                    <div key={raw.id} className="panel p-3">
                      <div className="grid gap-2 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-center">
                        <div className="flex items-center gap-2">
                          <ToolIcon name={t.name} color={t.color} size={34} rounded={9} />
                        </div>
                        <input className="field" value={t.name} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], name: e.target.value } }))} />
                        <select className="field" value={t.category} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], category: e.target.value } }))}>
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input className="field" value={t.free_tier} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], free_tier: e.target.value } }))} />
                        <div className="flex items-center gap-1.5">
                          <input type="color" className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 bg-transparent" value={`#${t.color.replace('#', '')}`} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], color: e.target.value.replace('#', '') } }))} />
                          <button
                            type="button"
                            title={raw.enabled === false ? 'Enable tool' : 'Disable tool'}
                            className={`rounded-lg border px-1.5 py-1.5 text-[12px] ${raw.enabled === false ? 'border-rose/30 text-rose' : 'border-mint/25 text-mint'}`}
                            onClick={() => {
                              setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], enabled: raw.enabled === false } }));
                              setTimeout(() => saveTool({ ...raw, enabled: raw.enabled === false }), 0);
                            }}
                          >
                            {raw.enabled === false ? 'off' : 'on'}
                          </button>
                          <button type="button" className={`${dirty ? 'btn-primary' : 'btn-ghost'} px-2 py-1.5 text-[12px]`} onClick={() => saveTool(raw)} disabled={!dirty}>
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="btn-subtle px-2 py-1.5 text-[12px] text-slate-500 hover:text-rose" onClick={() => removeTool(raw)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr]">
                        <input className="field text-[12px]" value={t.url} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], url: e.target.value } }))} />
                        <input className="field text-[12px]" value={t.description} onChange={(e) => setToolEdits((v) => ({ ...v, [raw.id]: { ...v[raw.id], description: e.target.value } }))} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {state.stages.map((s) => {
                          const on = t.stages.includes(s.key);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() =>
                                setToolEdits((v) => ({
                                  ...v,
                                  [raw.id]: {
                                    ...v[raw.id],
                                    stages: on ? t.stages.filter((k) => k !== s.key) : [...t.stages, s.key as StageKey],
                                  },
                                }))
                              }
                              className={`rounded-full border px-1.5 py-0.5 text-[12px] ${on ? 'border-slate-900 bg-white text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {tab === 'live' && (
          <div className="space-y-4">
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
                <ShieldCheck className="h-4 w-4 text-slate-700" />
                <h3 className="text-[14px] font-semibold text-slate-900">AI PM governance</h3>
                <span className="text-[12px] text-slate-500">
                  The guard reads the room, the plan and — with a member&apos;s token — the repo. It never writes.
                </span>
                <button
                  type="button"
                  className="btn-ghost ml-auto h-7 px-2 text-[12px]"
                  onClick={() => saveAipm(aipm)}
                  disabled={aipmSaving}
                >
                  {aipmSaving ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />} Save
                </button>
              </div>
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                <label className="flex items-start gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-slate-900"
                    checked={aipm.enabled}
                    onChange={(e) => setAipm({ ...aipm, enabled: e.target.checked })}
                  />
                  <span>
                    Guards on
                    <span className="block text-[12px] text-slate-500">
                      Overlap, spec drift, stalls and gate order. Off means nobody can run them in this room.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-slate-900"
                    checked={aipm.strict}
                    onChange={(e) => setAipm({ ...aipm, strict: e.target.checked })}
                  />
                  <span>
                    Strict architecture mode
                    <span className="block text-[12px] text-slate-500">
                      A HIGH spec deviation blocks marking that task done — nothing else. There is no editor to block.
                    </span>
                  </span>
                </label>
                <div>
                  <label className="label">Findings per person per day</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    className="field h-9 py-0"
                    value={aipm.maxPerPersonPerDay}
                    onChange={(e) => setAipm({ ...aipm, maxPerPersonPerDay: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">The noise budget. High-severity repeats are capped separately.</p>
                </div>
                <div>
                  <label className="label">Digest cadence</label>
                  <select
                    className="field h-9 py-0"
                    value={aipm.digest}
                    onChange={(e) => setAipm({ ...aipm, digest: e.target.value })}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="off">Off</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Stored with the room; the digest itself is generated on demand in the Build → AI PM guard tab.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">What the team is doing</h2>
              <p className="text-[12px] text-slate-500">
                Live view of every seat: the task in hand, what is late, who is online, and who has attached access.
                Secrets are never shown here — only whether an account is connected and verified.
              </p>
            </div>
            <LiveStatus
              code={code}
              stageNames={Object.fromEntries(state.stages.map((s) => [s.key, s.name]))}
              owner
            />
          </div>
        )}

        {tab === 'team' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-900/20 bg-white/60 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
              Roles decide the playbook and the default owner for each stage. Membership is the only permission that
              exists today: everyone in the room can edit documents, tasks, signals and the tool wall — the owner
              console is the one restricted area.
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">The team</h2>
              <p className="text-[12px] text-slate-500">Roles decide the seat each member sees. Anyone with the room link can join.</p>
            </div>

            <div className="panel flex flex-wrap items-center gap-2 p-3">
              <input className="field flex-1" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select className="field w-40" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                type="button"
                className="btn-primary px-3 py-2 text-[12px]"
                onClick={() => {
                  if (!inviteEmail.trim()) return;
                  void teamAction({ action: 'add', email: inviteEmail, role: inviteRole });
                  setInviteEmail('');
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add member
              </button>
              <button type="button" className="btn-ghost px-2.5 py-2 text-[12px]" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                <Copy className="h-3.5 w-3.5" /> Copy invite link
              </button>
            </div>

            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user_id} className="panel flex flex-wrap items-center gap-2 p-3">
                  <Avatar name={m.name} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-900">
                      {m.name}
                      {m.user_id === state.project.owner_id && <Pill tone="amber">owner</Pill>}
                      {m.is_admin && m.user_id !== state.project.owner_id && <Pill tone="electric">admin</Pill>}
                    </div>
                    <div className="text-[12px] text-slate-500">{m.email || 'guest'} · joined {String(m.joined_at).slice(0, 10)}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      className="field w-36 py-1.5 text-[12px]"
                      value={m.role}
                      onChange={(e) => teamAction({ user_id: m.user_id, role: e.target.value })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {m.user_id !== state.project.owner_id && (
                      <button type="button" className="btn-subtle px-2 py-1.5 text-[12px] text-slate-500 hover:text-rose" onClick={() => teamAction({ action: 'remove', user_id: m.user_id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'engine' && (
          <div className="space-y-4">
            <div className="panel p-4">
              <h2 className="mb-3 text-[16px] font-semibold text-slate-900">Workspace identity</h2>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="label">Product name</label>
                  <input className="field" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tagline</label>
                  <input className="field" value={identity.tagline} onChange={(e) => setIdentity({ ...identity, tagline: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" className="btn-primary px-3 py-2 text-[12px]" onClick={saveIdentity}>
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
                <span className="text-[12px] text-slate-500">Share link: <span className="font-mono text-slate-500">{shareUrl}</span></span>
                <a href="/setup" className="btn-ghost ml-auto px-2.5 py-1.5 text-[12px]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Setup &amp; access keys
                </a>
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-electric" /> Intelligence engine
              </h2>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Current engine: <span className="text-slate-800">{state.ai.engine}</span>{' '}
                <Pill tone={state.ai.live ? 'mint' : 'slate'} className="ml-1">{state.ai.live ? 'live' : 'built-in'}</Pill>
              </p>
              <div className="mt-3 grid gap-2 text-[12px] text-slate-500 md:grid-cols-2">
                <div className="panel-flat p-3">
                  <div className="mb-1 font-medium text-slate-800">To switch on a live model</div>
                  Set any one of these in Vercel → Settings → Environment Variables, then redeploy:
                  <ul className="mt-1.5 space-y-0.5 font-mono text-[12px] text-cyan-800">
                    <li>OPENAI_API_KEY</li>
                    <li>ANTHROPIC_API_KEY</li>
                    <li>GEMINI_API_KEY</li>
                    <li>GROQ_API_KEY</li>
                    <li>OPENROUTER_API_KEY</li>
                  </ul>
                </div>
                <div className="panel-flat p-3">
                  <div className="mb-1 font-medium text-slate-800">Access &amp; security</div>
                  <ul className="space-y-1">
                    <li>· Owner passcode: <code className="text-cyan-800">ADMIN_PASSCODE</code></li>
                    <li>· Admin emails: <code className="text-cyan-800">ADMIN_EMAILS</code></li>
                    <li>· Session secret: <code className="text-cyan-800">AUTH_SECRET</code></li>
                    <li>· Database: <code className="text-cyan-800">DATABASE_URL</code> (Neon)</li>
                  </ul>
                  <div className="mt-2 flex items-center gap-1 text-[12px] text-mint">
                    <ShieldCheck className="h-3 w-3" /> Members cannot call owner routes.
                  </div>
                </div>
              </div>
            </div>

            <LocalAI
              code={code}
              onEngine={(label) => setState((prev) => ({ ...prev, ai: { ...prev.ai, ...label } }))}
            />

            <div className="panel p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <Wand2 className="h-4 w-4 text-amber" /> What stays editable without code
              </h2>
              <div className="grid gap-2 text-[12px] text-slate-500 sm:grid-cols-2">
                {[
                  'Stage names, icons, colours, order and visibility',
                  'Each stage checklist (drives the board)',
                  'Every tool tile: name, colour, link, free tier, description',
                  'Which stages each tool appears in',
                  'Team roles and membership',
                  'Problem statement and its history',
                  'Workspace name and tagline',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
