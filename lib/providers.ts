import type { CredentialProvider } from './types';

/*
 * The catalogue of services a member can connect. Client-safe by design: no
 * secrets, no node imports — the Build screen renders this directly.
 */

export interface ProviderInfo {
  key: CredentialProvider;
  name: string;
  /** What the member pastes. */
  secretLabel: string;
  placeholder: string;
  hint: string;
  docs: string;
  /** Can the platform prove the credential works right now? */
  check: 'github' | 'vercel' | 'none';
  free: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    key: 'github',
    name: 'GitHub',
    secretLabel: 'Personal access token',
    placeholder: 'ghp_… or github_pat_…',
    hint: 'Fine-grained token with Contents: read/write and Pull requests: read/write on the build repo.',
    docs: 'https://github.com/settings/tokens',
    check: 'github',
    free: 'Free on every plan',
  },
  {
    key: 'vercel',
    name: 'Vercel',
    secretLabel: 'Access token',
    placeholder: 'vercel token',
    hint: 'Account settings → Tokens. Lets the room show deployments and link the live URL to a task.',
    docs: 'https://vercel.com/account/tokens',
    check: 'vercel',
    free: 'Hobby tier is free',
  },
  {
    key: 'neon',
    name: 'Neon Postgres',
    secretLabel: 'Connection string',
    placeholder: 'postgresql://user:pass@host/db?sslmode=require',
    hint: 'The product database your team is building — not this room’s own DATABASE_URL.',
    docs: 'https://neon.tech/docs/connect/connect-from-any-app',
    check: 'none',
    free: 'Free tier: 0.5 GB',
  },
  {
    key: 'figma',
    name: 'Figma',
    secretLabel: 'Personal access token',
    placeholder: 'figd_…',
    hint: 'Optional. Used to open the design file straight from a design task.',
    docs: 'https://www.figma.com/developers/api#access-tokens',
    check: 'none',
    free: 'Free Starter workspace',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    secretLabel: 'API key',
    placeholder: 'sk-…',
    hint: 'Optional. If a member brings a key, the room can use it for their own drafts.',
    docs: 'https://platform.openai.com/api-keys',
    check: 'none',
    free: 'Pay as you go',
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    secretLabel: 'API key',
    placeholder: 'sk-ant-…',
    hint: 'Optional model provider for the agent.',
    docs: 'https://console.anthropic.com/settings/keys',
    check: 'none',
    free: 'Pay as you go',
  },
  {
    key: 'gemini',
    name: 'Google AI Studio',
    secretLabel: 'API key',
    placeholder: 'AIza…',
    hint: 'Free tier is generous — the cheapest way to give the room a live model.',
    docs: 'https://aistudio.google.com/app/apikey',
    check: 'none',
    free: 'Free tier',
  },
  {
    key: 'groq',
    name: 'Groq',
    secretLabel: 'API key',
    placeholder: 'gsk_…',
    hint: 'Free tier, very fast. Good default for drafts.',
    docs: 'https://console.groq.com/keys',
    check: 'none',
    free: 'Free tier',
  },
  {
    key: 'supabase',
    name: 'Supabase',
    secretLabel: 'Service role key',
    placeholder: 'eyJ…',
    hint: 'Only if your product uses Supabase. Stored encrypted, never shown again.',
    docs: 'https://supabase.com/dashboard/project/_/settings/api',
    check: 'none',
    free: 'Free tier: 500 MB',
  },
  {
    key: 'custom',
    name: 'Something else',
    secretLabel: 'Secret',
    placeholder: 'token, key or connection string',
    hint: 'Any other service. Give it a name your teammates will recognise.',
    docs: '',
    check: 'none',
    free: '',
  },
];

export const providerInfo = (key: string): ProviderInfo =>
  PROVIDERS.find((p) => p.key === key) ?? PROVIDERS[PROVIDERS.length - 1];

