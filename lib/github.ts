import { openSecret } from './vault';
import type { CredentialRow } from './repo';

/*
 * GitHub, using the token the member attached — never a platform-wide token.
 *
 * Each call names the person whose credential it is, so the room can only ever
 * act with that person's permissions. If the token is missing or expired the
 * caller gets a plain error, not a silent no-op.
 */

/*
 * `GITHUB_API_BASE` exists so the build flow can be exercised against a local
 * stand-in (scripts/fake-github.cjs) — the same trick used for Ollama. It is
 * unset in production and nothing else reads it.
 */
const API = process.env.GITHUB_API_BASE?.trim() || 'https://api.github.com';
const TIMEOUT = 12_000;

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

async function call<T = any>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'one-stop-pro-manager',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (err) {
    throw new GitHubError(`GitHub is unreachable from this server (${(err as Error).message.slice(0, 60)}).`, 502);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as any)?.message || `GitHub answered ${res.status}`;
    throw new GitHubError(message, res.status);
  }
  return body as T;
}

export function tokenFrom(row: CredentialRow | null): string {
  if (!row) throw new GitHubError('No GitHub token attached. Connect GitHub under Build → Connections.', 400);
  const token = openSecret(row.secret);
  if (!token) throw new GitHubError('The stored GitHub token cannot be decrypted. Re-attach it.', 400);
  return token;
}

export interface GitHubAccount {
  login: string;
  name: string | null;
  avatar: string | null;
}

export async function account(token: string): Promise<GitHubAccount> {
  const user = await call(token, '/user');
  return { login: user.login, name: user.name ?? null, avatar: user.avatar_url ?? null };
}

export interface Repository {
  full_name: string;
  private: boolean;
  default_branch: string;
  pushed_at: string | null;
  html_url: string;
  language: string | null;
}

export async function repos(token: string, limit = 30): Promise<Repository[]> {
  const rows = await call<any[]>(token, '/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member');
  return rows
    .slice(0, limit)
    .map((r) => ({
      full_name: r.full_name,
      private: !!r.private,
      default_branch: r.default_branch ?? 'main',
      pushed_at: r.pushed_at ?? null,
      html_url: r.html_url,
      language: r.language ?? null,
    }));
}

export async function branches(token: string, repo: string, limit = 40): Promise<string[]> {
  const rows = await call<any[]>(token, `/repos/${repo}/branches?per_page=100`);
  return rows.slice(0, limit).map((b) => b.name as string);
}

/** Create `branch` from `base` (default branch when omitted). Safe if it exists. */
export async function createBranch(
  token: string,
  repo: string,
  branch: string,
  base?: string,
): Promise<{ branch: string; created: boolean; base: string; url: string }> {
  const info = await call<any>(token, `/repos/${repo}`);
  const baseBranch = base || info.default_branch || 'main';
  const ref = await call<any>(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  const sha = ref.object?.sha;
  if (!sha) throw new GitHubError(`Could not read the head of ${baseBranch}.`);
  const clean = branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'work';
  try {
    await call(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${clean}`, sha },
    });
    return { branch: clean, created: true, base: baseBranch, url: `https://github.com/${repo}/tree/${clean}` };
  } catch (err) {
    const message = (err as Error).message;
    if (/already exists/i.test(message)) {
      return { branch: clean, created: false, base: baseBranch, url: `https://github.com/${repo}/tree/${clean}` };
    }
    throw err;
  }
}

export interface Commit {
  sha: string;
  short: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

/** The last few commits on a repo — the only honest activity feed there is. */
export async function commits(token: string, repo: string, limit = 12): Promise<Commit[]> {
  const rows = await call<any[]>(token, `/repos/${repo}/commits?per_page=${Math.min(limit, 30)}`);
  return rows.map((c) => ({
    sha: c.sha,
    short: String(c.sha ?? '').slice(0, 7),
    message: String(c.commit?.message ?? '').split('\n')[0].slice(0, 140),
    author: c.commit?.author?.name ?? c.author?.login ?? null,
    date: c.commit?.author?.date ?? null,
    url: c.html_url ?? '',
  }));
}

/** The pull-request page GitHub itself uses, so no extra write scope is needed. */
export function compareUrl(repo: string, base: string, branch: string): string {
  return `https://github.com/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}?expand=1`;
}
