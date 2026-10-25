import type { AnalysisResult, Message, ProblemStatement, Project } from './types';
import { buildProblem, localChatAnswer } from './intel';

/**
 * Provider-agnostic LLM layer. Any ONE of the keys in .env.example turns the
 * local reasoner into a live agent. Every call degrades gracefully: if the key
 * is missing, the model errors, or the network is unavailable, the platform keeps
 * working on its built-in engine.
 */

type Provider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'local';

interface AIConfig {
  provider: Provider;
  model: string | null;
  key: string | null;
  live: boolean;
}

export function aiConfig(): AIConfig {
  const pick = (p: Provider, keyVar: string, modelVar: string, fallback: string): AIConfig | null => {
    const key = process.env[keyVar]?.trim();
    if (!key) return null;
    return { provider: p, key, model: process.env[modelVar]?.trim() || fallback, live: true };
  };
  return (
    pick('openai', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'gpt-4o-mini') ||
    pick('anthropic', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest') ||
    pick('gemini', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'gemini-2.0-flash') ||
    pick('groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'llama-3.3-70b-versatile') ||
    pick('openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'meta-llama/llama-3.1-70b-instruct') || {
      provider: 'local',
      model: 'built-in reasoner',
      key: null,
      live: false,
    }
  );
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
  const cfg = aiConfig();
  if (!cfg.live || !cfg.key) return null;
  const maxTokens = opts.maxTokens ?? 1400;
  const temperature = opts.temperature ?? 0.35;

  if (cfg.provider === 'anthropic') {
    const data = await fetchJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.key,
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
  const cfg = aiConfig();
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
    engine: `${cfg.provider}:${cfg.model}`,
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

  return { problem, signals, engine: `${cfg.provider}:${cfg.model}` };
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
  const cfg = aiConfig();
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
  return { content: content.trim(), engine: `${cfg.provider}:${cfg.model}` };
}

const CHAT_SYSTEM = `You are "Prime", the operating partner inside One Stop Pro Manager, a meeting IDE for product teams.
You have the team's problem statement, signals and artifacts. You are direct, practical and biased to shipping.
Use short markdown sections and bullets. If something is unknown, say so and give the cheapest way to find out.
Always end with one concrete next action and which stage it belongs to. Keep answers under 260 words.`;

export async function askAgent(question: string, ctx: {
  project: Project;
  problem: ProblemStatement | null;
  messageCount: number;
  artifacts: { title: string; status: string }[];
  stage: string;
}): Promise<{ content: string; engine: string }> {
  const cfg = aiConfig();
  if (!cfg.live) {
    return { content: localChatAnswer(question, { problem: ctx.problem, messageCount: ctx.messageCount }), engine: 'built-in reasoner' };
  }
  const p = ctx.problem;
  const prompt = `PROJECT: ${ctx.project.name}
CURRENT STAGE: ${ctx.stage}
PROBLEM STATEMENT: ${p?.statement ?? 'not defined yet'}
USERS: ${p?.users.join('; ') ?? '—'}
PAINS: ${p?.pains.join('; ') ?? '—'}
EVIDENCE: ${p?.evidence.join('; ') ?? '—'}
METRICS: ${p?.successMetrics.join('; ') ?? '—'}
UNKNOWNS: ${p?.unknowns.join('; ') ?? '—'}
ARTIFACTS: ${ctx.artifacts.map((a) => `${a.title} (${a.status})`).join(', ') || 'none'}
MESSAGES IN MEETING: ${ctx.messageCount}

TEAM ASKS: ${question}`;

  const content = await callLLM(CHAT_SYSTEM, prompt, { maxTokens: 700, temperature: 0.55 });
  if (!content) {
    return { content: localChatAnswer(question, { problem: ctx.problem, messageCount: ctx.messageCount }), engine: 'built-in reasoner (LLM unavailable)' };
  }
  return { content, engine: `${cfg.provider}:${cfg.model}` };
}

export function engineLabel(): { engine: string; provider: string | null; model: string | null; live: boolean } {
  const cfg = aiConfig();
  return {
    engine: cfg.live ? `${cfg.provider} · ${cfg.model}` : 'built-in reasoner',
    provider: cfg.live ? cfg.provider : null,
    model: cfg.model,
    live: cfg.live,
  };
}
