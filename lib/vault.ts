import crypto from 'node:crypto';
import type { CredentialProvider } from './types';

/*
 * Per-member credentials.
 *
 * The rule that shapes this file: a secret goes in once, is encrypted with
 * AES-256-GCM, and is never sent back to a browser — not to the member who
 * typed it, not to the owner, not in an export. The UI only ever sees a masked
 * tail, a status and a timestamp.
 */

export { PROVIDERS, providerInfo, type ProviderInfo } from './providers';
import { providerInfo } from './providers';

/* ------------------------------------------------------------------ */
/* crypto                                                             */
/* ------------------------------------------------------------------ */

const KEY = (() => {
  const material =
    process.env.CREDENTIAL_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    'ospm-development-vault-do-not-use-in-production';
  return crypto.createHash('sha256').update(`ospm-vault:${material}`).digest();
})();

/** True when the key comes from a real secret rather than a development default. */
export const vaultKeyStatus = (): { strong: boolean; source: string } => {
  if (process.env.CREDENTIAL_SECRET?.trim()) return { strong: true, source: 'CREDENTIAL_SECRET' };
  if (process.env.AUTH_SECRET?.trim()) return { strong: true, source: 'AUTH_SECRET' };
  if (process.env.DATABASE_URL?.trim()) return { strong: true, source: 'DATABASE_URL (derived)' };
  return { strong: false, source: 'development default' };
};

/** v1:<iv>:<tag>:<ciphertext>, all base64. */
export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function openSecret(sealed: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = sealed.split(':');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** `•••• 1234` — enough for a human to tell two tokens apart, useless to an attacker. */
export function maskSecret(plain: string): string {
  const clean = plain.trim();
  if (clean.length <= 4) return '••••';
  return `•••• ${clean.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* live checks                                                        */
/* ------------------------------------------------------------------ */

export interface CheckResult {
  status: 'connected' | 'unverified' | 'error';
  detail: string;
  meta?: Record<string, unknown>;
}

const TIMEOUT = 8000;

async function getJson(url: string, token: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      'user-agent': 'one-stop-pro-manager',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/**
 * Prove a credential where the provider allows it. Everything else is stored
 * and marked unverified — the platform never claims a check it did not make.
 */
export async function checkCredential(provider: CredentialProvider, secret: string): Promise<CheckResult> {
  const info = providerInfo(provider);
  if (info.check === 'none') {
    return { status: 'unverified', detail: 'Saved encrypted. This provider has no check the platform can run.' };
  }
  try {
    if (info.check === 'github') {
      const base = process.env.GITHUB_API_BASE?.trim() || 'https://api.github.com';
      const { ok, status, body } = await getJson(`${base}/user`, secret);
      if (ok) {
        return {
          status: 'connected',
          detail: `GitHub token works — signed in as ${body.login ?? 'your account'}.`,
          meta: { login: body.login ?? null },
        };
      }
      return {
        status: 'error',
        detail: status === 401 ? 'GitHub rejected this token (401). Check it has not expired.' : `GitHub answered ${status}.`,
      };
    }
    const base = process.env.VERCEL_API_BASE?.trim() || 'https://api.vercel.com';
    const { ok, status, body } = await getJson(`${base}/v2/user`, secret);
    if (ok) {
      return {
        status: 'connected',
        detail: `Vercel token works — ${body.user?.username ?? body.user?.email ?? 'account verified'}.`,
        meta: { user: body.user?.username ?? null },
      };
    }
    return {
      status: 'error',
      detail: status === 403 ? 'Vercel rejected this token (403).' : `Vercel answered ${status}.`,
    };
  } catch (err) {
    const message = (err as Error).message || 'network error';
    return {
      status: 'unverified',
      detail: `Saved encrypted. Could not reach ${info.name} from this server (${message.slice(0, 80)}).`,
    };
  }
}
