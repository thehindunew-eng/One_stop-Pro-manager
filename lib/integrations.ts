import { aiConfig } from './ai';
import { sessionSecretStatus, usingDefaultPasscode } from './auth';

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
    requiredMissing: required.filter((i) => i.state !== 'on').length,
    usingFallback: all.filter((i) => i.state === 'fallback').map((i) => i.name),
  };
}
