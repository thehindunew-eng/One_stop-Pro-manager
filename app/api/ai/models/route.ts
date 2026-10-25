import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import {
  DEFAULT_OLLAMA_EMBED,
  effectiveAIConfig,
  engineLabel,
  invalidateAIConfig,
  listLocalModels,
  ollamaBaseUrl,
} from '@/lib/ai';
import { AI_SETTING_KEY, deleteSetting, setSetting, type AISetting } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * What the AI layer is using right now, plus every model pulled on the local
 * Ollama server. Read-only for members; switching models is owner-only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code'));
  if (!isGuard(g)) return g;

  const cfg = await effectiveAIConfig();
  const label = await engineLabel();
  const probe = await listLocalModels(cfg.provider === 'ollama' ? cfg.baseUrl : ollamaBaseUrl());

  return NextResponse.json({
    ...label,
    reachable: probe.reachable,
    baseUrl: probe.base,
    error: probe.error ?? null,
    models: probe.models,
    embedModel: cfg.provider === 'ollama' ? cfg.embedModel ?? DEFAULT_OLLAMA_EMBED : null,
    embedAvailable: probe.reachable && probe.models.some((m) => /embed/i.test(m.name)),
    canEdit: g.access.canAdmin,
  });
}

/** Owner switches the local model (and optionally the server URL) from the UI. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code, true);
  if (!isGuard(g)) return g;

  const action = String(body.action ?? 'select');

  if (action === 'reset') {
    await deleteSetting(AI_SETTING_KEY);
    invalidateAIConfig();
    return NextResponse.json({ ok: true, ...(await engineLabel()) });
  }

  if (action === 'probe') {
    const probe = await listLocalModels(body.baseUrl || undefined);
    return NextResponse.json(probe);
  }

  const model = String(body.model ?? '').trim().slice(0, 120);
  if (!model) return bad('Pick a model first.');
  const baseUrl = String(body.baseUrl ?? '').trim().slice(0, 200);
  if (baseUrl) {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return bad('That is not a valid URL.');
    }
    if (!/^https?:$/.test(parsed.protocol)) return bad('The server URL must start with http:// or https://');
    // Link-local addresses are cloud metadata endpoints, never a model server.
    if (/^169\.254\./.test(parsed.hostname) || /^metadata\./i.test(parsed.hostname) || parsed.hostname === '0.0.0.0') {
      return bad('Point this at the machine running Ollama, not at a link-local address.');
    }
  }

  const probe = await listLocalModels(baseUrl || undefined, 2_500);
  if (probe.reachable && probe.models.length && !probe.models.some((m) => m.name === model)) {
    return bad(`“${model}” is not pulled on that server. Available: ${probe.models.slice(0, 6).map((m) => m.name).join(', ')}`);
  }
  if (!probe.reachable) {
    return bad(
      `Could not reach ${probe.base}. Start Ollama (\`ollama serve\`) or set OLLAMA_BASE_URL, then try again.`,
      503,
    );
  }

  const embedModel =
    String(body.embedModel ?? '').trim() ||
    probe.models.find((m) => /embed/i.test(m.name))?.name ||
    DEFAULT_OLLAMA_EMBED;

  const setting: AISetting = {
    provider: 'ollama',
    model,
    baseUrl: baseUrl || probe.base,
    embedModel,
    updatedBy: g.user.name,
    updatedAt: new Date().toISOString(),
  };
  await setSetting(AI_SETTING_KEY, setting);
  invalidateAIConfig();

  return NextResponse.json({ ok: true, using: setting, ...(await engineLabel()) });
}
