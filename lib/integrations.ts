import { aiConfig } from './ai';

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
}

/**
 * Everything the platform can talk to outside itself, whether it is switched on
 * right now, and what happens if you leave it off. Read on the server only.
 */
export function integrations(): Integration[] {
  const cfg = aiConfig();
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const onVercel = Boolean(process.env.VERCEL);

  const list: Integration[] = [
    {
      id: 'db',
      name: 'Neon Postgres',
      category: 'Data',
      need: 'required',
      state: has('DATABASE_URL') ? 'on' : 'fallback',
      variable: 'DATABASE_URL',
      without:
        'Runs on an embedded Postgres file inside the deployment. Fine for a single preview, but on Vercel the file system is temporary — data resets on redeploy.',
      withIt: 'Every meeting, document, task and tool you add is stored permanently and shared by the whole team in real time.',
      docs: 'https://neon.tech',
      how: [
        'Create a free Neon project (free tier: 0.5 GB storage).',
        'Copy the pooled connection string (it ends with ?sslmode=require).',
        'Add it to Vercel → Project → Settings → Environment Variables as DATABASE_URL.',
        'Redeploy once. The schema and both rooms are created automatically on first request.',
      ],
    },
    {
      id: 'auth',
      name: 'Session secret',
      category: 'Security',
      need: 'required',
      state: has('AUTH_SECRET') ? 'on' : 'fallback',
      variable: 'AUTH_SECRET',
      without:
        'Sessions still work using a development default, but every deploy invalidates them and any instance could forge a session.',
      withIt: 'Signed sessions that survive deploys, so people stay in their room with their own name and role.',
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
        'Cheapest/free path: Google AI Studio → create a key (Gemini has a free tier) and set GEMINI_API_KEY.',
        'Alternative free-ish path: Groq → create a key and set GROQ_API_KEY.',
        'OpenAI or Anthropic keys work too — the platform picks the first key it finds.',
        'One key is enough. No key is also a valid setup.',
      ],
    },
    {
      id: 'admin',
      name: 'Owner passcode',
      category: 'Security',
      need: 'recommended',
      state: has('ADMIN_PASSCODE') ? 'on' : 'fallback',
      variable: 'ADMIN_PASSCODE',
      without:
        'Falls back to the default passcode, so anyone who has read the repo could unlock the owner console.',
      withIt: 'Only Amar (the owner) can open the owner console to add tools, rename stages or manage members.',
      how: [
        'Pick a private passcode and set ADMIN_PASSCODE.',
        'The owner enters it once under “Owner access” on the join card.',
        'Optionally list permanent admin emails in ADMIN_EMAILS.',
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
      id: 'tools',
      name: 'Tool accounts (Figma, Notion, Linear…)',
      category: 'Team tools',
      need: 'optional',
      state: 'on',
      variable: 'no keys needed',
      without: '—',
      withIt:
        'Every tool on the wall opens in its own tab with your team. The platform stores the link you paste, never your credentials, so there is no OAuth app to register.',
      how: [
        'Open the Tools tab in any stage.',
        'Pick a tool, set your status (planned / trial / in use / parked).',
        'Paste your workspace URL and a note — the whole team sees it.',
      ],
    },
  ];

  return list;
}

export function integrationSummary() {
  const all = integrations();
  const required = all.filter((i) => i.need === 'required');
  return {
    total: all.length,
    on: all.filter((i) => i.state === 'on').length,
    requiredMissing: required.filter((i) => i.state === 'fallback').length,
    usingFallback: all.filter((i) => i.state === 'fallback').map((i) => i.name),
  };
}
