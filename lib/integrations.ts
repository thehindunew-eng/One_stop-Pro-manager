import { effectiveAIConfig, listLocalModels, ollamaBaseUrl, DEFAULT_OLLAMA_MODEL } from './ai';
import { sessionSecretStatus, usingDefaultPasscode } from './auth';
import { vaultKeyStatus } from './vault';

export type IntegrationNeed = 'required' | 'recommended' | 'optional';
export type IntegrationState = 'on' | 'off' | 'fallback';

export interface Integration {
  id: string;
  name: string;
  category: 'Data' | 'Security' | 'Deployment' | 'AI' | 'Room setup' | 'Team tools';
  need: IntegrationNeed;
  state: IntegrationState;
  variable?: string;
  without: string;
  withIt: string;
  how: string[];
  docs?: string;
  /** Link text when the link is documentation rather than a sign-up page. */
  docsLabel?: string;
}

/**
 * Everything the platform can talk to outside itself, whether it is switched on
 * right now, and what happens if you leave it off. Read on the server only.
 */
export async function integrations(): Promise<Integration[]> {
  const cfg = await effectiveAIConfig();
  const local = await listLocalModels(cfg.provider === 'ollama' ? cfg.baseUrl : ollamaBaseUrl(), 1_200);
  const localNames: string[] = local.models.map((m) => m.name);
  const embedInstalled = localNames.some((name) => /embed/i.test(name));
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const onVercel = Boolean(process.env.VERCEL);
  const secret = sessionSecretStatus();
  const defaultPasscode = usingDefaultPasscode();

  const list: Integration[] = [
    {
      id: 'db',
      name: 'Neon Postgres',
      category: 'Data',
      need: 'required',
      state: has('DATABASE_URL') ? 'on' : 'fallback',
      variable: 'DATABASE_URL',
      without:
        'Runs on an embedded Postgres file inside the deployment. Fine for a single preview, but on Vercel the file system is temporary and every instance gets its own copy — data resets and the team sees different rooms.',
      withIt: 'Every meeting, document, task and tool you add is stored permanently and shared by the whole team in real time.',
      docs: 'https://neon.tech',
      how: [
        'Create a free Neon project (free tier: 0.5 GB storage).',
        'Copy the **pooled** connection string (the host contains -pooler) and keep ?sslmode=require on the end.',
        'Add it to Vercel → Project → Settings → Environment Variables as DATABASE_URL for Production, Preview and Development.',
        'Redeploy once. The schema, both starter rooms and the 30-document blueprint are created on the first request.',
        'The app keeps its own pool small (3 connections) and retries once if Neon has put the database to sleep.',
      ],
    },
    {
      id: 'auth',
      name: 'Session secret',
      category: 'Security',
      need: 'required',
      state: secret.source === 'explicit' ? 'on' : secret.strong ? 'fallback' : 'off',
      variable: 'AUTH_SECRET',
      without:
        'Without AUTH_SECRET the signing key is derived from DATABASE_URL: sessions still work and cannot be forged from the public repo, but rotating the database password signs everyone out. With neither value set, the key is a public development constant — never leave it that way on a real URL.',
      withIt: 'Sessions signed with a key only you control. Changing the value signs everybody out, which is also how you revoke access.',
      docs: 'https://nextjs.org/docs/app/building-your-application/authentication',
      how: [
        'Generate a long random string (32+ characters).',
        'Set AUTH_SECRET in the Vercel environment variables.',
        'Share it with nobody — it signs every session cookie.',
      ],
    },
    {
      id: 'vercel',
      name: 'Vercel hosting',
      category: 'Deployment',
      need: 'recommended',
      state: onVercel ? 'on' : 'off',
      variable: 'VERCEL (set automatically)',
      without: 'You are running locally — nothing else needs a change, but the team cannot reach the room from a URL.',
      withIt: 'A public URL for the room, automatic deploys on push, and the invite link works for the whole team.',
      docs: 'https://vercel.com',
      how: [
        'Import the GitHub repo in Vercel (framework: Next.js).',
        'Add the environment variables from this page, including DATABASE_URL.',
        'Deploy, then open /live — that is the real product room.',
      ],
    },
    {
      id: 'ai',
      name: 'AI provider (one is enough)',
      category: 'AI',
      need: 'optional',
      state: cfg.live ? 'on' : 'fallback',
      variable: cfg.live ? `${cfg.provider} · ${cfg.model}` : 'OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY',
      without:
        'The built-in reasoner answers from the problem statement, board and documents using rules. Nothing breaks — answers are just less nuanced.',
      withIt: 'Ask Prime reads the whole room and writes specific, product-aware answers and drafts; documents read like a senior PM wrote them.',
      docs: 'https://aistudio.google.com/app/apikey',
      how: [
        'Run a model on your own machine: install Ollama, then `ollama pull qwen3:4b` — no key, no cost, nothing leaves the computer.',
        'Pick the model in Owner console → Workspace → Local AI, or set OLLAMA_MODEL in the environment.',
        'Prefer a hosted model? Google AI Studio (Gemini free tier) or Groq are the free paths: set GEMINI_API_KEY or GROQ_API_KEY.',
        'OpenAI, Anthropic and OpenRouter keys work too. One provider is enough; no provider is also valid.',
      ],
    },
    {
      id: 'ollama',
      name: 'Local AI models (Ollama)',
      category: 'AI',
      need: 'optional',
      state: local.reachable ? (localNames.length ? 'on' : 'fallback') : cfg.provider === 'ollama' ? 'fallback' : 'off',
      variable: 'OLLAMA_BASE_URL / OLLAMA_MODEL / OLLAMA_EMBED_MODEL',
      without: local.reachable
        ? 'The server is running but no model is pulled yet. Run `ollama pull qwen3:4b` (2.5 GB) to give the room a live model.'
        : 'Everything still works on the built-in reasoner. Start Ollama (`ollama serve`) and the platform finds it on 127.0.0.1:11434 — nothing else to configure.',
      withIt: local.reachable
        ? `${localNames.length} model(s) installed: ${localNames.slice(0, 5).join(', ')}${localNames.length > 5 ? '…' : ''}. Switch models from the owner console; no redeploy.`
        : 'Analysis, documents and Ask Prime run on your own GPU/CPU: no API key, no rate limits, no data leaving the machine.',
      how: [
        'Install Ollama, then pull a model: `ollama pull qwen3:4b` (fast), `llama3.1:8b` (balanced) or `qwen3:14b` / `qwen2.5-coder:14b` (better, slower).',
        'Optional embeddings: `ollama pull nomic-embed-text` — Ask Prime then ranks documents by meaning, not order.',
        'Open Owner console → Workspace → Local AI and pick a model. It is stored in Postgres, so the whole team uses it.',
        'Serving the app on Vercel? The function cannot reach your laptop — set OLLAMA_BASE_URL to a reachable host (LAN IP, Tailscale or a tunnel) or use a hosted provider.',
      ],
    },
    {
      id: 'embeddings',
      name: 'Local embeddings (nomic-embed-text)',
      category: 'AI',
      need: 'optional',
      state: embedInstalled ? 'on' : 'off',
      variable: `OLLAMA_EMBED_MODEL (currently ${cfg.embedModel ?? 'nomic-embed-text'})`,
      without: 'Ask Prime falls back to stage order when choosing which documents to read. Still correct, just less relevant on large rooms.',
      withIt: 'Each question is matched against every document by meaning, so the agent reads the six most relevant docs instead of the first eight.',
      how: [
        '`ollama pull nomic-embed-text` (274 MB).',
        'Keep Ollama running; the app batches embeddings and caches them per document.',
        'Embeddings never leave the machine and cost nothing.',
      ],
    },
    {
      id: 'admin',
      name: 'Owner passcode',
      category: 'Security',
      need: 'recommended',
      state: defaultPasscode ? 'fallback' : 'on',
      variable: 'ADMIN_PASSCODE',
      without: defaultPasscode
        ? 'Right now the passcode is the documented default, so anyone who has read this repo could unlock the owner console. Attempts are throttled to 8 per 10 minutes, but change it before you share the link.'
        : 'Falls back to a documented default, which is not safe on a public URL.',
      withIt: 'Only you can open the owner console to add tools, rename stages, edit checklists or manage members.',
      how: [
        'Pick a private passcode and set ADMIN_PASSCODE in Vercel.',
        'The owner enters it once under “Owner access” on the join card — the session then keeps admin rights.',
        'Optionally list permanent admin emails in ADMIN_EMAILS so you never need the passcode.',
        'Forgot it? Changing the variable in Vercel is enough; no database edit needed.',
      ],
    },
    {
      id: 'rooms',
      name: 'Room codes and names',
      category: 'Room setup',
      need: 'optional',
      state: 'on',
      variable: 'PROD_PROJECT_CODE / DEMO_PROJECT_CODE / PRODUCT_NAME / OWNER_NAME / OWNER_EMAIL',
      without: 'Defaults are used: /room/onestop (live) and /room/studio (demo), owner “Amar Tripathi”.',
      withIt: 'Rename the URLs and the owner identity without touching code.',
      how: [
        'Set PROD_PROJECT_CODE to change the live room URL (for example /room/acme).',
        'Set OWNER_NAME and OWNER_EMAIL to make your own account the owner on first boot.',
        'Changing these later only affects newly created rooms.',
      ],
    },
    {
      id: 'vault',
      name: 'Member credentials vault',
      category: 'Security',
      need: 'recommended',
      state: vaultKeyStatus().strong ? 'on' : 'off',
      variable: 'CREDENTIAL_SECRET (or AUTH_SECRET)',
      without:
        'Team credentials are still encrypted, but the key is derived from the development default. Anyone with the database and this repository could decrypt them — do not let the team attach real tokens yet.',
      withIt:
        'Every member token (GitHub, Vercel, database, model keys) is sealed with AES-256-GCM under a key only you control, and is never sent back to a browser.',
      docs: 'https://nextjs.org/docs/app/building-your-application/configuring/environment-variables',
      how: [
        'Generate a long random string and set it as CREDENTIAL_SECRET in the deployment.',
        'Rotating it invalidates stored credentials — everyone re-attaches their tokens once.',
        'Secrets are write-only from the browser: the API returns a masked tail, never the value.',
      ],
    },
    {
      id: 'aipm',
      name: 'AI PM guard',
      category: 'AI',
      need: 'optional',
      state: 'on',
      variable: 'no keys needed (uses the AI provider if one is set)',
      without: '—',
      withIt:
        'Four deterministic guards (overlap, spec drift, velocity, gate order) run on room data alone. With a provider configured, the same slice is also read by the model for prose-level drift.',
      docs: 'https://github.com/thehindunew-eng/One_stop-Pro-manager/blob/main/docs/AI-PM.md',
      docsLabel: 'How the guard works — docs/AI-PM.md',
      how: [
        'Open Build → AI PM guard.',
        'Press Run (room only) for the arithmetic findings, or Run guards to include the configured model.',
        'Act on a finding to turn it into a board task — a person confirms, the guard never writes by itself.',
        'Owner settings live in the admin console under Live: on/off, strict mode, noise budget, digest cadence.',
      ],
    },
    {
      id: 'tools',
      name: 'Tool accounts (Figma, Notion, Linear…)',
      category: 'Team tools',
      need: 'optional',
      state: 'on',
      variable: 'no keys needed',
      without: '—',
      withIt:
        'Every tool on the wall opens in its own tab. If a member attaches a token under Build → Connections, the platform can act with it (create a branch, list repos) — otherwise you just link the workspace URL.',
      how: [
        'Open the Tools tab in any stage.',
        'Pick a tool, set your status (planned / trial / in use / parked).',
        'Paste your workspace URL and a note — the whole team sees it.',
      ],
    },
  ];

  return list;
}

export async function integrationSummary() {
  const all = await integrations();
  const required = all.filter((i) => i.need === 'required');
  return {
    total: all.length,
    on: all.filter((i) => i.state === 'on').length,
    requiredMissing: required.filter((i) => i.state !== 'on').length,
    usingFallback: all.filter((i) => i.state === 'fallback').map((i) => i.name),
  };
}
