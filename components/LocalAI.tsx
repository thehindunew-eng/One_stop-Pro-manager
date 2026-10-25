'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Cpu, HardDrive, RefreshCw, Save } from 'lucide-react';
import { Pill, Spinner } from './ui';

interface LocalModel {
  name: string;
  size: number | null;
  params: string | null;
  family: string | null;
  modified: string | null;
}

interface ModelState {
  engine: string;
  provider: string | null;
  model: string | null;
  live: boolean;
  local?: boolean;
  baseUrl?: string | null;
  embedModel?: string | null;
  embedAvailable?: boolean;
  reachable: boolean;
  models: LocalModel[];
  error: string | null;
  canEdit: boolean;
}

const mb = (size: number | null) => (size ? `${(size / 1024 ** 3).toFixed(1)} GB` : null);

/**
 * Model switcher for a local Ollama server. Everything is stored in Postgres, so
 * choosing a model here changes it for the whole room without a redeploy.
 */
export default function LocalAI({
  code,
  onEngine,
}: {
  code: string;
  onEngine?: (label: { engine: string; provider: string | null; model: string | null; live: boolean }) => void;
}) {
  const [state, setState] = useState<ModelState | null>(null);
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState<null | 'load' | 'save' | 'reset'>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (announce = false) => {
      setBusy('load');
      setError(null);
      try {
        const res = await fetch(`/api/ai/models?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
        const data = (await res.json()) as ModelState & { error?: string };
        if (!res.ok) throw new Error((data as any).error || 'Could not read the model list.');
        setState(data);
        setModel(data.model ?? data.models[0]?.name ?? '');
        setBaseUrl(data.baseUrl ?? '');
        if (announce) setNote(data.reachable ? `${data.models.length} model(s) found` : 'No local server answered');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [code],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!model) return;
    setBusy('save');
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, action: 'select', model, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not switch model.');
      setNote(`Now using ${data.engine}`);
      onEngine?.(data);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy('reset');
    setError(null);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset.');
      setNote('Model choice cleared — back to the environment default.');
      onEngine?.(data);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const running = state?.local;
  const installed = state?.models ?? [];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
          <Cpu className="h-4 w-4 text-slate-500" /> Local AI models
        </h2>
        <Pill tone={state?.reachable ? 'mint' : 'slate'}>
          {state?.reachable ? `${installed.length} installed` : 'no server'}
        </Pill>
        {running && <Pill tone="electric">in use</Pill>}
        <button type="button" className="btn-subtle ml-auto px-2 py-1" onClick={() => load(true)} disabled={busy === 'load'}>
          {busy === 'load' ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="text-[12px]">Re-scan</span>
        </button>
      </div>

      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
        Runs on Ollama. Nothing leaves the machine and there is no key to manage. Pick any model you have pulled —
        the choice is stored in Postgres and applies to the whole team.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}
      {note && !error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          <Check className="h-3.5 w-3.5" /> {note}
        </div>
      )}

      {state && !state.reachable && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
          <div className="font-medium text-slate-800">No Ollama server at {state.baseUrl}</div>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
            <li>Install Ollama and start it: <code className="rounded bg-white px-1">ollama serve</code></li>
            <li>Pull a model: <code className="rounded bg-white px-1">ollama pull qwen3:4b</code></li>
            <li>Optional, for document ranking: <code className="rounded bg-white px-1">ollama pull nomic-embed-text</code></li>
            <li>Then press Re-scan.</li>
          </ol>
          <p className="mt-1.5 text-slate-500">
            On Vercel the function cannot see your laptop. Set <code className="rounded bg-white px-1">OLLAMA_BASE_URL</code> to
            a reachable host, or run the app locally with <code className="rounded bg-white px-1">npm run dev</code>.
          </p>
        </div>
      )}

      {state?.reachable && (
        <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_1fr]">
          <div>
            <label className="label" htmlFor="local-model">Model</label>
            <select id="local-model" className="field" value={model} onChange={(e) => setModel(e.target.value)}>
              {installed.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.params ? ` · ${m.params}` : ''}
                  {mb(m.size) ? ` · ${mb(m.size)}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              {installed.find((m) => m.name === model)?.family ?? 'local'} · embeddings:{' '}
              {state.embedModel ?? 'nomic-embed-text'} {state.embedAvailable ? '(installed)' : '(not installed)'}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="local-base">Server URL</label>
            <input
              id="local-base"
              className="field font-mono text-[12px]"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
            />
            <p className="mt-1 text-[11px] text-slate-500">Change only if Ollama runs on another machine or port.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <button type="button" className="btn-primary px-3" onClick={save} disabled={busy !== null || !model}>
              {busy === 'save' ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              Use this model
            </button>
            <button type="button" className="btn-ghost px-3" onClick={reset} disabled={busy !== null}>
              Clear choice
            </button>
            <span className="text-[12px] text-slate-500">
              Currently: <span className="font-medium text-slate-800">{state.engine}</span>
            </span>
          </div>
        </div>
      )}

      {state?.reachable && installed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {installed.map((m) => (
            <span key={m.name} className="chip font-mono text-[11px]">
              <HardDrive className="h-3 w-3 text-slate-400" />
              {m.name}
              {m.size ? ` · ${mb(m.size)}` : ''}
            </span>
          ))}
        </div>
      )}

      {!state?.canEdit && (
        <p className="mt-2 text-[11px] text-slate-500">Only the owner can change the model. You can see what is running.</p>
      )}
    </div>
  );
}
