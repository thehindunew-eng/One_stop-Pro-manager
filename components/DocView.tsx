'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, Copy, Eye, FileText, Pencil, RefreshCw, Sparkles, Wand2, Save, X,
} from 'lucide-react';
import type { Artifact, Stage, StageKey } from '@/lib/types';
import { patch, post } from '@/lib/client';
import { Markdown, Pill, Spinner } from './ui';

const TONE: Record<string, 'slate' | 'amber' | 'mint'> = { draft: 'slate', ready: 'amber', approved: 'mint' };

export default function DocView({
  code,
  artifacts,
  stages,
  stageKey,
  onArtifacts,
  canEdit,
  live,
  engine,
  focusKind,
}: {
  code: string;
  artifacts: Artifact[];
  stages: Stage[];
  stageKey: StageKey;
  onArtifacts: (a: Artifact[]) => void;
  canEdit: boolean;
  live: boolean;
  engine: string;
  focusKind?: string | null;
}) {
  const stageArtifacts = useMemo(
    () => artifacts.filter((a) => a.stage_key === stageKey).sort((a, b) => a.title.localeCompare(b.title)),
    [artifacts, stageKey],
  );
  const [activeId, setActiveId] = useState<string | null>(stageArtifacts[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = artifacts.find((a) => a.id === activeId) ?? stageArtifacts[0] ?? null;

  useEffect(() => {
    const first = artifacts.filter((a) => a.stage_key === stageKey).sort((a, b) => a.title.localeCompare(b.title))[0];
    setActiveId(first?.id ?? null);
    setEditing(false);
  }, [stageKey, artifacts.length]);

  useEffect(() => {
    if (active) setDraft(active.content);
  }, [active?.id]);

  useEffect(() => {
    if (!focusKind) return;
    const target = artifacts.find((a) => a.kind === focusKind);
    if (target) {
      setActiveId(target.id);
      setEditing(false);
    }
  }, [focusKind, artifacts]);

  const generate = async (kind: string) => {
    setBusy(kind);
    setError(null);
    try {
      const res = await post<{ artifacts: Artifact[] }>('/api/docs', { code, kind });
      onArtifacts(res.artifacts);
      const target = res.artifacts.find((a) => a.kind === kind);
      if (target) setActiveId(target.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const generateStage = async () => {
    setBusy('stage');
    setError(null);
    try {
      const res = await post<{ artifacts: Artifact[]; generated?: unknown[]; skipped?: string[] }>('/api/docs', {
        code,
        stage: stageKey,
      });
      onArtifacts(res.artifacts);
      if (res.skipped?.length) {
        setError(
          `Generated ${res.generated?.length ?? 0} document(s). ${res.skipped.length} left for the next run — press “Generate this stage” again to continue.`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!active) return;
    setBusy('save');
    setError(null);
    try {
      const res = await patch<{ artifacts: Artifact[] }>('/api/docs', { code, id: active.id, content: draft, status: 'ready' });
      onArtifacts(res.artifacts);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    try {
      const res = await patch<{ artifacts: Artifact[] }>('/api/docs', { code, id: active.id, status });
      onArtifacts(res.artifacts);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stageName = stages.find((s) => s.key === stageKey)?.name ?? stageKey;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill tone="slate"><FileText className="h-3 w-3" /> {stageArtifacts.length} docs · {stageName}</Pill>
        <Pill tone={live ? 'mint' : 'slate'}>
          <Sparkles className="h-3 w-3" /> {live ? 'AI drafting on' : 'Template engine'}
        </Pill>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-ghost py-1.5 text-[12px]" onClick={generateStage} disabled={busy !== null}>
            {busy === 'stage' ? <Spinner className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
            Generate this stage
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {stageArtifacts.map((a) => {
            const selected = active?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setActiveId(a.id);
                  setEditing(false);
                }}
                className={`min-w-[200px] shrink-0 rounded-xl border p-2.5 text-left transition lg:min-w-0 ${
                  selected
                    ? 'border-slate-900/25 bg-white/40'
                    : 'border-slate-900/20 bg-white/60 hover:border-slate-900/70 hover:bg-white/60/70'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[12px] font-medium text-slate-900">{a.title}</span>
                  {a.content ? <Check className="h-3 w-3 shrink-0 text-mint" /> : <Sparkles className="h-3 w-3 shrink-0 text-slate-500" />}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                    a.content ? 'bg-white/55 text-slate-500' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {a.content ? a.status : 'empty'}
                  </span>
                  {a.content && <span className="text-[12px] text-slate-500">{a.content.split(/\s+/).length} words</span>}
                </div>
              </button>
            );
          })}
          {!stageArtifacts.length && (
            <div className="panel-flat p-3 text-[12px] text-slate-500">No docs mapped to this stage.</div>
          )}
        </div>

        <div className="panel min-h-[420px] overflow-hidden">
          {active ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/10 px-3.5 py-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold text-slate-900">{active.title}</h3>
                  <div className="text-[12px] text-slate-500">
                    {active.updated_by ? `Edited by ${active.updated_by}` : 'Workspace starter'} · {active.content ? `${active.content.split(/\s+/).length} words` : 'not generated yet'}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Pill tone={TONE[active.status] ?? 'slate'}>{active.status}</Pill>
                  {editing ? (
                    <button type="button" className="btn-subtle p-1.5" title="Preview" onClick={() => setEditing(false)}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-subtle p-1.5"
                      title="Edit this document"
                      onClick={() => {
                        setDraft(active.content || `# ${active.title}\n\n## Summary\n\n## Detail\n\n## Decisions\n\n## Open questions\n`);
                        setEditing(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!!active.content && (
                    <button
                      type="button"
                      className="btn-subtle p-1.5"
                      title="Copy markdown"
                      onClick={() => navigator.clipboard?.writeText(active.content)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1.5 text-[12px]"
                    onClick={() => generate(active.kind)}
                    disabled={busy !== null}
                  >
                    {busy === active.kind ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {active.content ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="p-3">
                  {!active.content && (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber">
                      Nothing here yet — write the first version, or cancel and let Prime draft it.
                    </p>
                  )}
                  <div className="mb-2 flex items-center gap-2">
                    <button type="button" className="btn-primary px-2.5 py-1.5 text-[12px]" onClick={save} disabled={busy === 'save'}>
                      {busy === 'save' ? <Spinner className="h-3 w-3" /> : <Save className="h-3 w-3" />} Save
                    </button>
                    <button type="button" className="btn-subtle px-2.5 py-1.5 text-[12px]" onClick={() => { setEditing(false); setDraft(active.content); }}>
                      <X className="h-3 w-3" /> Cancel
                    </button>
                    <span className="ml-auto text-[12px] text-slate-500">Markdown supported</span>
                  </div>
                  <textarea
                    className="md-input scroll-thin"
                    style={{ height: 520 }}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
              ) : active.content ? (
                <div className="scroll-thin max-h-[600px] overflow-y-auto p-4">
                  <Markdown text={active.content} />
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-900/10 pt-3">
                    <span className="text-[11px] uppercase tracking-[.08em] text-slate-500">Mark as</span>
                    {['draft', 'ready', 'approved'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`rounded-full border px-2.5 py-1 text-[12px] font-medium capitalize transition ${
                          active.status === s
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-900/20 bg-white/60 text-slate-500 hover:border-slate-900/70'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <span className="ml-auto text-[12px] text-slate-500">engine: {engine}</span>
                  </div>
                </div>
              ) : (
                <div className="grid place-items-center p-10 text-center">
                  <div>
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-electric/25 bg-indigo-50 text-electric">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h4 className="text-[14px] font-semibold text-slate-900">This document is empty</h4>
                    <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
                      Generate a starter draft tailored to your problem statement, then edit it in place. Nothing is
                      invented about your market — assumptions are marked.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button type="button" className="btn-primary" onClick={() => generate(active.kind)} disabled={busy !== null}>
                        {busy === active.kind ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                        Generate “{active.title}”
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setDraft(`# ${active.title}\n\n_Owner:_ ${''}\n\n## Summary\n\n## Detail\n\n## Decisions\n\n## Open questions\n`);
                          setEditing(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Write it myself
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-[13px] text-slate-500">Select a document.</div>
          )}
        </div>
      </div>
    </div>
  );
}
