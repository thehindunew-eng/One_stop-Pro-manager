import type { AnalysisResult, Message, ProblemStatement, Project } from './types';
import { buildProblem, localChatAnswer } from './intel';
import { AI_SETTING_KEY, getSetting, type AISetting } from './settings';

/**
 * Provider-agnostic LLM layer. Any ONE of the keys in .env.example turns the
 * local reasoner into a live agent. Every call degrades gracefully: if the key
 * is missing, the model errors, or the network is unavailable, the platform keeps
 * working on its built-in engine.
 *
 * Local models are first-class: point OLLAMA_BASE_URL at an Ollama server (or
 * just start Ollama on the default port) and any installed model can be selected
 * from the owner console — no redeploy, no key, no request leaving the machine.
 */

type Provider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'local';

export interface AIConfig {
  provider: Provider;
  model: string | null;
  key: string | null;
  live: boolean;
  baseUrl?: string;
  embedModel?: string;
}

export const DEFAULT_OLLAMA_BASE = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen3:4b';
export const DEFAULT_OLLAMA_EMBED = 'nomic-embed-text';

export function ollamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE;
  return raw.replace(/\/+$/, '');
}

/** Ollama is used when it is named explicitly, or when its env vars are present. */
function ollamaRequested(): boolean {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit) return explicit === 'ollama';
  return Boolean(process.env.OLLAMA_MODEL?.trim() || process.env.OLLAMA_BASE_URL?.trim());
}

function ollamaConfig(overrides: { model?: string; baseUrl?: string; embedModel?: string } = {}): AIConfig {
  return {
    provider: 'ollama',
    model: overrides.model?.trim() || process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
    key: null,
    live: true,
    baseUrl: overrides.baseUrl?.trim() || ollamaBaseUrl(),
    embedModel: overrides.embedModel?.trim() || process.env.OLLAMA_EMBED_MODEL?.trim() || DEFAULT_OLLAMA_EMBED,
  };
}

export function aiConfig(): AIConfig {
  const pick = (p: Provider, keyVar: string, modelVar: string, fallback: string): AIConfig | null => {
    const key = process.env[keyVar]?.trim();
    if (!key) return null;
    return { provider: p, key, model: process.env[modelVar]?.trim() || fallback, live: true };
  };

  if (ollamaRequested()) return ollamaConfig();

  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  const hosted = () =>
    pick('openai', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'gpt-4o-mini') ||
    pick('anthropic', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest') ||
    pick('gemini', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'gemini-2.0-flash') ||
    pick('groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'llama-3.3-70b-versatile') ||
    pick('openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'meta-llama/llama-3.1-70b-instruct');

  if (explicit) {
    const named = hosted();
    if (named && named.provider === explicit) return named;
  }

  return (
    hosted() || {
      provider: 'local',
      model: 'built-in reasoner',
      key: null,
      live: false,
    }
  );
}

/**
 * If nothing is configured but Ollama is running on this machine, use it. That is
 * the whole setup for a local-first team: install Ollama, pull a model, done.
 * Set DISABLE_LOCAL_AI=1 to stay on the built-in reasoner regardless.
 */
let probeMemo: { at: number; reachable: boolean; model: string | null } | null = null;

async function autoDetectOllama(): Promise<AIConfig | null> {
  if (process.env.DISABLE_LOCAL_AI === '1') return null;
  if (!probeMemo || Date.now() - probeMemo.at > 30_000) {
    const probe = await listLocalModels(ollamaBaseUrl(), 800);
    const usable = probe.models.filter((m) => !/embed/i.test(m.name));
    probeMemo = { at: Date.now(), reachable: probe.reachable, model: usable[0]?.name ?? null };
  }
  if (!probeMemo.reachable) return null;
  return ollamaConfig({ model: process.env.OLLAMA_MODEL?.trim() || probeMemo.model || DEFAULT_OLLAMA_MODEL });
}

/**
 * The effective config is the env config plus whatever the owner last chose in
 * the UI. Cached for a few seconds because every LLM call reads it.
 */
let effectiveCache: { at: number; value: AIConfig } | null = null;

export async function effectiveAIConfig(): Promise<AIConfig> {
  if (effectiveCache && Date.now() - effectiveCache.at < 5_000) return effectiveCache.value;

  let cfg = aiConfig();
  const stored = await getSetting<AISetting>(AI_SETTING_KEY);
  if (stored?.provider === 'ollama') {
    const envOllama = cfg.provider === 'ollama' ? cfg : ollamaConfig();
    cfg = {
      ...envOllama,
      model: stored.model?.trim() || envOllama.model,
      baseUrl: stored.baseUrl?.trim() || envOllama.baseUrl,
      embedModel: stored.embedModel?.trim() || envOllama.embedModel,
    };
  } else if (cfg.provider === 'local') {
    const auto = await autoDetectOllama();
    if (auto) cfg = auto;
  }

  effectiveCache = { at: Date.now(), value: cfg };
  return cfg;
}

export function invalidateAIConfig(): void {
  effectiveCache = null;
}

async function fetchJson(url: string, init: RequestInit, ms = 45000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[ai] ${url} ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[ai] request failed:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callLLM(
  system: string,
  prompt: string,
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const cfg = await effectiveAIConfig();
  if (!cfg.live) return null;
  if (!cfg.key && cfg.provider !== 'ollama') return null;
  const maxTokens = opts.maxTokens ?? 1400;
  const temperature = opts.temperature ?? 0.35;

  if (cfg.provider === 'ollama') {
    return callOllama(cfg, system, prompt, { maxTokens, temperature, json: opts.json });
  }

  if (cfg.provider === 'anthropic') {
    const data = await fetchJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.key ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    return data?.content?.[0]?.text ?? null;
  }

  if (cfg.provider === 'gemini') {
    const data = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    );
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? null;
  }

  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  };
  const data = await fetchJson(endpoints[cfg.provider], {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.key}`,
      ...(cfg.provider === 'openrouter' ? { 'HTTP-Referer': 'https://one-stop-pro-manager.vercel.app', 'X-Title': 'One Stop Pro Manager' } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature,
      max_tokens: maxTokens,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  return data?.choices?.[0]?.message?.content ?? null;
}

/* ------------------------------------------------------------------------- */
/* Local models (Ollama)                                                     */
/* ------------------------------------------------------------------------- */

const OLLAMA_TIMEOUT = Number(process.env.OLLAMA_TIMEOUT_MS) || 120_000;

/** Qwen 3 reasons before answering unless told not to; that doubles latency. */
function withThinkingHint(system: string, model: string | null): string {
  const thinking = (process.env.OLLAMA_THINKING || '').trim().toLowerCase();
  if (thinking === 'on' || thinking === '1' || thinking === 'true') return system;
  if (model && /qwen3/i.test(model)) return `${system}\n\n/no_think`;
  return system;
}

async function callOllama(
  cfg: AIConfig,
  system: string,
  prompt: string,
  opts: { maxTokens: number; temperature: number; json?: boolean },
): Promise<string | null> {
  const base = (cfg.baseUrl || DEFAULT_OLLAMA_BASE).replace(/\/+$/, '');
  const messages = [
    { role: 'system', content: withThinkingHint(system, cfg.model) },
    { role: 'user', content: prompt },
  ];

  // Ollama exposes an OpenAI-compatible route; prefer it, then fall back to the
  // native /api/chat shape for older builds.
  const compat = await fetchJson(
    `${base}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
    },
    OLLAMA_TIMEOUT,
  );
  const fromCompat = compat?.choices?.[0]?.message?.content;
  if (typeof fromCompat === 'string' && fromCompat.trim()) return fromCompat;

  const native = await fetchJson(
    `${base}/api/chat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: false,
        ...(opts.json ? { format: 'json' } : {}),
        options: { temperature: opts.temperature, num_predict: opts.maxTokens },
      }),
    },
    OLLAMA_TIMEOUT,
  );
  const fromNative = native?.message?.content;
  return typeof fromNative === 'string' && fromNative.trim() ? fromNative : null;
}

export interface LocalModel {
  name: string;
  size: number | null;
  params: string | null;
  family: string | null;
  modified: string | null;
}

export interface LocalModelProbe {
  reachable: boolean;
  base: string;
  models: LocalModel[];
  error?: string;
}

/** Ask the local server which models are pulled. Never throws. */
export async function listLocalModels(base?: string, ms = 1_500): Promise<LocalModelProbe> {
  const url = (base || ollamaBaseUrl()).replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${url}/api/tags`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { reachable: false, base: url, models: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: any[] };
    const models: LocalModel[] = (data.models ?? []).map((m) => ({
      name: String(m.name ?? m.model ?? ''),
      size: typeof m.size === 'number' ? m.size : null,
      params: m.details?.parameter_size ?? null,
      family: m.details?.family ?? null,
      modified: m.modified_at ?? null,
    })).filter((m) => m.name);
    return { reachable: true, base: url, models };
  } catch (err) {
    return { reachable: false, base: url, models: [], error: (err as Error).name === 'AbortError' ? 'timed out' : 'not running' };
  } finally {
    clearTimeout(timer);
  }
}

export async function embedTexts(texts: string[], cfg?: AIConfig): Promise<number[][] | null> {
  if (!texts.length) return null;
  const conf = cfg ?? (await effectiveAIConfig());
  if (conf.provider !== 'ollama') return null;
  const base = (conf.baseUrl || DEFAULT_OLLAMA_BASE).replace(/\/+$/, '');
  const model = conf.embedModel || DEFAULT_OLLAMA_EMBED;

  const batch = await fetchJson(
    `${base}/api/embed`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: texts }),
    },
    60_000,
  );
  const embeddings = batch?.embeddings;
  if (Array.isArray(embeddings) && embeddings.length === texts.length && Array.isArray(embeddings[0])) {
    return embeddings as number[][];
  }

  // Older Ollama: one prompt per call.
  const out: number[][] = [];
  for (const text of texts) {
    const one = await fetchJson(
      `${base}/api/embeddings`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      },
      60_000,
    );
    if (!Array.isArray(one?.embedding)) return null;
    out.push(one.embedding as number[]);
  }
  return out.length === texts.length ? out : null;
}

export function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Small hash so unchanged documents are not re-embedded on every question. */
function digest(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${h}:${text.length}`;
}

const embeddingCache = new Map<string, number[]>();

/**
 * Rank documents against a question using the local embedding model.
 * Returns null when embeddings are unavailable so callers keep their old order.
 */
export async function rankByRelevance<T extends { title: string; content: string }>(
  question: string,
  docs: T[],
  limit: number,
): Promise<T[] | null> {
  if (docs.length <= limit) return null;
  const cfg = await effectiveAIConfig();
  if (cfg.provider !== 'ollama') return null;

  const candidates = docs.slice(0, 40).map((doc) => {
    const text = `${doc.title}\n${doc.content.slice(0, 800)}`;
    return { doc, key: digest(text), text };
  });

  const missing = candidates.filter((c) => !embeddingCache.has(c.key));
  if (missing.length) {
    const vecs = await embedTexts([question, ...missing.map((m) => m.text)], cfg);
    if (!vecs) return null;
    missing.forEach((m, i) => {
      const vec = vecs[i + 1];
      if (vec) {
        if (embeddingCache.size > 400) embeddingCache.clear();
        embeddingCache.set(m.key, vec);
      }
    });
    embeddingCache.set(`q:${digest(question)}`, vecs[0]);
  } else {
    const vecs = await embedTexts([question], cfg);
    if (!vecs) return null;
    embeddingCache.set(`q:${digest(question)}`, vecs[0]);
  }

  const questionVec = embeddingCache.get(`q:${digest(question)}`);
  if (!questionVec) return null;

  const scored = candidates
    .map((c) => ({ doc: c.doc, score: cosine(questionVec, embeddingCache.get(c.key) ?? []) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.doc);
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const ANALYST_SYSTEM = `You are the analyst inside "One Stop Pro Manager", a meeting IDE for product teams.
You listen to a raw team conversation and infer the real underlying problem — not the first thing someone said.
You are precise, commercially aware and allergic to vague statements. You always answer with strict JSON only.`;

const transcript = (messages: Message[], limit = 120) =>
  messages
    .filter((m) => m.kind !== 'system')
    .slice(-limit)
    .map((m) => `[${m.author}${m.role ? `/${m.role}` : ''}${m.kind !== 'chat' ? `/${m.kind}` : ''}] ${m.content}`)
    .join('\n');

const PROBLEM_SHAPE = `{
  "title": "short memorable title (max 90 chars)",
  "statement": "one 'How might we ...' problem question naming the user, the pain and the outcome",
  "summary": "3-5 sentences: what the team is really trying to solve, what evidence exists, what is still unknown",
  "confidence": 0-100,
  "users": ["who feels the pain"],
  "pains": ["specific pain, ideally with the cost"],
  "evidence": ["numbers, quotes or observations found in the conversation"],
  "assumptions": ["things taken for granted that could be wrong"],
  "unknowns": ["the questions that must be answered next, phrased as questions"],
  "successMetrics": ["measurable outcome that proves the problem is solved"],
  "solutionAngles": ["distinct ways to attack the problem, not features"],
  "productType": "the kind of product this implies",
  "tags": ["5-10 lowercase keywords"],
  "signals": [{"type":"pain|user|evidence|idea|decision|blocker|metric|question","label":"short quote or insight (max 110 chars)","detail":"why it matters","score":0-100}]
}`;

export async function analyzeConversation(messages: Message[], project: Project): Promise<AnalysisResult> {
  const local = buildProblem(messages);
  const cfg = await effectiveAIConfig();
  if (!cfg.live) {
    return { problem: local, signals: [], engine: 'built-in reasoner (no API key configured)' };
  }

  const prompt = `PROJECT: ${project.name} — ${project.tagline ?? ''}
CONVERSATION (${messages.length} messages, oldest first):
${transcript(messages)}

Read the whole conversation. Identify the actual problem the team should solve, including pains that were mentioned indirectly.
Return ONLY JSON with this shape:
${PROBLEM_SHAPE}
Rules:
- "statement" must be a genuine problem question, never a solution.
- Only put things in "evidence" that are actually grounded in the conversation or clearly marked as assumptions elsewhere.
- 3-6 items per array, no filler.
- signals: 8-14 strongest items, ordered by importance.`;

  const raw = await callLLM(ANALYST_SYSTEM, prompt, { json: true, maxTokens: 2000, temperature: 0.25 });
  const parsed = parseJson<Partial<ProblemStatement> & { signals?: AnalysisResult['signals'] }>(raw);
  if (!parsed) {
    return { problem: local, signals: [], engine: 'built-in reasoner (LLM unavailable)' };
  }

  const list = (v: unknown, fallback: string[]) =>
    Array.isArray(v) && v.length ? v.map((x) => String(x)).filter(Boolean).slice(0, 8) : fallback;

  const problem: ProblemStatement = {
    title: parsed.title || local.title,
    statement: parsed.statement || local.statement,
    summary: parsed.summary || local.summary,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || local.confidence)),
    status: 'draft',
    users: list(parsed.users, local.users),
    pains: list(parsed.pains, local.pains),
    evidence: list(parsed.evidence, local.evidence),
    assumptions: list(parsed.assumptions, local.assumptions),
    unknowns: list(parsed.unknowns, local.unknowns),
    successMetrics: list(parsed.successMetrics, local.successMetrics),
    solutionAngles: list(parsed.solutionAngles, local.solutionAngles),
    productType: parsed.productType || local.productType,
    tags: list(parsed.tags, local.tags),
    engine: engineName(cfg),
    updatedAt: new Date().toISOString(),
  };

  const validTypes = ['pain', 'user', 'evidence', 'idea', 'decision', 'blocker', 'metric', 'question'];
  const signals = (Array.isArray(parsed.signals) ? parsed.signals : [])
    .filter((s) => s && typeof s.label === 'string' && validTypes.includes(String(s.type)))
    .slice(0, 16)
    .map((s) => ({
      type: s.type,
      label: String(s.label).slice(0, 160),
      detail: String(s.detail ?? '').slice(0, 400),
      score: Math.max(0, Math.min(100, Number(s.score) || 60)),
      status: 'open' as const,
      evidence: [],
    }));

  return { problem, signals, engine: engineName(cfg) };
}

const DOC_SYSTEM = `You are a senior product operator writing an internal working document for a small, fast product team.
Write in crisp markdown with real specificity: concrete steps, numbers, owners, timelines and named free-tier tools.
No fluff, no "in today's fast-paced world". Prefer tables and checklists over prose. Maximum 600 words.
Never invent company facts that are not in the brief; use the problem statement as the source of truth.`;

export async function draftDocument(kind: string, title: string, ctx: {
  project: Project;
  problem: ProblemStatement | null;
  stageName: string;
  stageTagline: string;
  members: { name: string; role: string }[];
  freeTools: string[];
}): Promise<{ content: string; engine: string } | null> {
  const cfg = await effectiveAIConfig();
  if (!cfg.live) return null;
  const p = ctx.problem;
  const prompt = `DOCUMENT TO WRITE: ${title}
LIFECYCLE STAGE: ${ctx.stageName} — ${ctx.stageTagline}
PROJECT: ${ctx.project.name}${ctx.project.tagline ? ` — ${ctx.project.tagline}` : ''}
TEAM: ${ctx.members.map((m) => `${m.name} (${m.role})`).join(', ') || 'small product team'}
PRODUCT TYPE: ${p?.productType ?? 'web app'}
PROBLEM STATEMENT: ${p?.statement ?? '(not written yet — infer from the project name and keep it general but useful)'}
USERS: ${p?.users.join('; ') ?? 'unknown'}
PAINS: ${p?.pains.join('; ') ?? 'unknown'}
EVIDENCE: ${p?.evidence.join('; ') ?? 'none captured yet'}
SUCCESS METRICS: ${p?.successMetrics.join('; ') ?? 'define one north-star metric'}
UNKNOWNS: ${p?.unknowns.join('; ') ?? 'unknown'}
FREE TOOLS AVAILABLE: ${ctx.freeTools.join(', ')}

Write the document now. Start with a single H1 line ("# ${title}"), then sections with H2s.
Include, where relevant: an owner + due-date table, a numbered week-by-week plan, a checklist using "- [ ]" and a "Free tools to use" line naming 2-4 of the tools above.
Be opinionated and specific to THIS problem.`;

  const content = await callLLM(DOC_SYSTEM, prompt, { maxTokens: 1600, temperature: 0.5 });
  if (!content || content.length < 120) return null;
  return { content: content.trim(), engine: engineName(cfg) };
}

const CHAT_SYSTEM = `You are "Prime", the operating partner inside One Stop Pro Manager, a meeting IDE for product teams.
You are given the room's approved problem statement, the signals the team produced, the board state, the documents
that already exist, the tools the team actually uses and the recent conversation.

How to answer:
- Be the senior product operator in the room: direct, specific to THIS product, biased to shipping.
- Ground every claim in the context you were given. If something is unknown, say so and give the cheapest way to find out.
- Use plain language a product manager can act on today. Short markdown sections and bullets, under 240 words.
- When you recommend work, phrase it as a task a named role could pick up.
- Always finish with one line: **Next:** the single most useful action and which lifecycle stage it belongs to.`;

export interface AgentAction {
  kind: 'doc' | 'task' | 'stage' | 'problem';
  label: string;
  hint?: string;
  payload?: Record<string, string>;
}

export interface AgentContext {
  project: Project;
  problem: ProblemStatement | null;
  messageCount: number;
  artifacts: { kind: string; title: string; status: string; stage: string; excerpt?: string }[];
  stage: string;
  stageKey: string;
  stages: { key: string; name: string; done: number; total: number }[];
  tasks: { title: string; status: string; owner: string | null; stage: string; priority: string }[];
  signals: { type: string; label: string }[];
  tools: { name: string; status: string; note: string }[];
  recent: { author: string; content: string }[];
  history: { role: 'you' | 'prime'; content: string }[];
}

function suggestedActions(ctx: AgentContext): AgentAction[] {
  const actions: AgentAction[] = [];
  const current = ctx.stages.find((s) => s.key === ctx.stageKey);
  const missing = ctx.artifacts.filter((a) => !a.excerpt && (a.stage === ctx.stage || !a.stage));
  const nextStage = ctx.stages.find((s) => s.key !== ctx.stageKey && s.done < s.total);

  if (ctx.problem && ctx.problem.status !== 'approved') {
    actions.push({ kind: 'problem', label: 'Review & approve the problem statement', hint: 'Everything downstream depends on it' });
  }
  if (missing[0]) {
    actions.push({ kind: 'doc', label: `Draft “${missing[0].title}”`, hint: `${ctx.stage} · generated from your problem`, payload: { kind: missing[0].kind } });
  }
  actions.push({
    kind: 'task',
    label: 'Turn this into a board task',
    hint: 'Adds it to the current stage so it does not get lost',
    payload: { title: 'Prime follow-up', stage: ctx.stageKey },
  });
  if (nextStage) {
    actions.push({ kind: 'stage', label: `Open ${nextStage.name}`, hint: `${nextStage.done}/${nextStage.total} done in that stage`, payload: { stage: nextStage.key } });
  }
  if (current && current.total > 0 && current.done < current.total) {
    actions.push({ kind: 'stage', label: `Finish the ${current.name} checklist`, hint: `${current.total - current.done} items left`, payload: { stage: current.key } });
  }
  return actions.slice(0, 4);
}

export async function askAgent(
  question: string,
  ctx: AgentContext,
): Promise<{ content: string; engine: string; actions: AgentAction[] }> {
  const cfg = await effectiveAIConfig();
  const actions = suggestedActions(ctx);
  const fallbackCtx = {
    problem: ctx.problem,
    messageCount: ctx.messageCount,
    stage: ctx.stage,
    stageKey: ctx.stageKey,
    openTasks: ctx.tasks.filter((t) => t.status !== 'done').slice(0, 4).map((t) => ({ title: t.title, stage: t.stage })),
    docsReady: ctx.artifacts.filter((a) => a.status !== 'draft').length,
    docsTotal: ctx.artifacts.length,
    toolsUsing: ctx.tools.filter((t) => t.status === 'using').map((t) => t.name),
    risks: ctx.problem?.unknowns ?? [],
  };
  if (!cfg.live) {
    return {
      content: localChatAnswer(question, fallbackCtx),
      engine: 'built-in reasoner',
      actions,
    };
  }

  const p = ctx.problem;
  const docLines = ctx.artifacts
    .map((a) => `- ${a.title} [${a.stage}] — ${a.excerpt ? `${a.status}, ${a.excerpt.slice(0, 320)}` : 'not written yet'}`)
    .join('\n');
  const taskLines = ctx.tasks.slice(0, 14).map((t) => `- [${t.status}] ${t.title} (${t.priority}${t.owner ? `, ${t.owner}` : ''})`).join('\n') || '- board is empty';
  const stageLines = ctx.stages.map((s) => `- ${s.name}: ${s.done}/${s.total} tasks done`).join('\n');
  const signalLines = ctx.signals.slice(0, 12).map((s) => `- ${s.type}: ${s.label}`).join('\n') || '- none captured';
  const toolLines = ctx.tools.slice(0, 14).map((t) => `- ${t.name} (${t.status})${t.note ? `: ${t.note}` : ''}`).join('\n') || '- no tools marked yet';
  const recentLines = ctx.recent.slice(-12).map((m) => `[${m.author}] ${m.content.slice(0, 420)}`).join('\n');
  const historyLines = ctx.history.slice(-6).map((t) => `${t.role === 'you' ? 'PM' : 'Prime'}: ${t.content.slice(0, 500)}`).join('\n');

  const prompt = `PROJECT: ${ctx.project.name}${ctx.project.tagline ? ` — ${ctx.project.tagline}` : ''}
CURRENT STAGE: ${ctx.stage}

PROBLEM STATEMENT (status: ${p?.status ?? 'none'}, confidence ${p?.confidence ?? 0}%):
${p?.statement ?? 'not defined yet'}
Users: ${p?.users.join('; ') ?? '—'}
Pains: ${p?.pains.join('; ') ?? '—'}
Evidence: ${p?.evidence.join('; ') ?? '—'}
Assumptions: ${p?.assumptions.join('; ') ?? '—'}
Unknowns: ${p?.unknowns.join('; ') ?? '—'}
Success metrics: ${p?.successMetrics.join('; ') ?? '—'}

LIFECYCLE PROGRESS:
${stageLines}

DOCUMENTS:
${docLines}

BOARD (open + recent):
${taskLines}

SIGNALS FROM THE ROOM:
${signalLines}

TOOLS THE TEAM USES:
${toolLines}

RECENT CONVERSATION:
${recentLines || '(nothing yet)'}

${historyLines ? `EARLIER IN THIS CHAT:\n${historyLines}\n` : ''}
THE PM ASKS: ${question}`;

  const content = await callLLM(CHAT_SYSTEM, prompt, { maxTokens: 900, temperature: 0.45 });
  if (!content) {
    return {
      content: localChatAnswer(question, fallbackCtx),
      engine: 'built-in reasoner (LLM unavailable)',
      actions,
    };
  }
  return { content, engine: engineName(cfg), actions };
}

export function engineName(cfg: AIConfig): string {
  if (!cfg.live) return 'built-in reasoner';
  return `${cfg.provider === 'ollama' ? 'local' : cfg.provider} · ${cfg.model}`;
}

export interface EngineLabel {
  engine: string;
  provider: string | null;
  model: string | null;
  live: boolean;
  local?: boolean;
  baseUrl?: string | null;
  embedModel?: string | null;
}

export async function engineLabel(): Promise<EngineLabel> {
  const cfg = await effectiveAIConfig();
  return {
    engine: engineName(cfg),
    provider: cfg.live ? cfg.provider : null,
    model: cfg.model,
    live: cfg.live,
    local: cfg.provider === 'ollama',
    baseUrl: cfg.provider === 'ollama' ? cfg.baseUrl ?? ollamaBaseUrl() : null,
    embedModel: cfg.provider === 'ollama' ? cfg.embedModel ?? DEFAULT_OLLAMA_EMBED : null,
  };
}
