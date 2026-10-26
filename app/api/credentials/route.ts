import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { deleteCredential, getCredential, listCredentialRows, listMembers, saveCredential } from '@/lib/repo';
import { PROVIDERS, providerInfo } from '@/lib/providers';
import { checkCredential, maskSecret, openSecret, sealSecret, vaultKeyStatus } from '@/lib/vault';
import type { CredentialView } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * A member's credentials.
 *
 * GET  → my credentials with a masked tail; the owner additionally sees which
 *        teammates are connected, never their secrets.
 * POST → attach or rotate one of MY credentials (verified where possible).
 * DELETE → remove one of MY credentials; the owner may revoke anyone's.
 *
 * No endpoint in this app ever returns a decrypted secret to a browser.
 */

function view(row: any, viewerId: string, nameOf: (userId: string) => string): CredentialView {
  const mine = row.user_id === viewerId;
  const secret = mine ? openSecret(row.secret) : null;
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: nameOf(row.user_id),
    provider: row.provider,
    label: row.label || providerInfo(row.provider).name,
    hint: secret ? maskSecret(secret) : '',
    status: row.status,
    detail: row.detail,
    last_checked: row.last_checked,
    updated_at: row.updated_at,
    mine,
  };
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') ?? '';
  const g = await guard(code);
  if (!isGuard(g)) return g;

  const [rows, members] = await Promise.all([listCredentialRows(g.project.id), listMembers(g.project.id)]);
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? 'A teammate';

  const mine = rows.filter((r) => r.user_id === g.user.id).map((r) => view(r, g.user.id, nameOf));
  const everyone = g.access.canAdmin
    ? rows.map((r) => view(r, g.user.id, nameOf)).map((v) => ({ ...v, hint: '' }))
    : [];

  /* Per-member coverage, so the owner can see who is blocked on access. */
  const coverage = members.map((m) => {
    const own = rows.filter((r) => r.user_id === m.user_id);
    return {
      user_id: m.user_id,
      name: m.name,
      role: m.role,
      connected: own.filter((r) => r.status === 'connected').length,
      saved: own.length,
      providers: own.map((r) => r.provider),
      blocked: own.some((r) => r.status === 'error'),
    };
  });

  return NextResponse.json({
    providers: PROVIDERS,
    mine,
    everyone,
    coverage,
    canAdmin: g.access.canAdmin,
    vault: vaultKeyStatus(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;

  const provider = String(body.provider ?? '');
  if (!PROVIDERS.some((p) => p.key === provider)) return bad('Unknown provider.');
  const secret = String(body.secret ?? '').trim();
  if (secret.length < 8) return bad('That does not look like a credential — paste the full token or URL.');
  if (secret.length > 4000) return bad('That is too long to be a token.');

  const label = String(body.label ?? '').slice(0, 80);
  const check = await checkCredential(provider as any, secret);

  await saveCredential({
    projectId: g.project.id,
    userId: g.user.id,
    provider,
    label,
    sealed: sealSecret(secret),
    meta: { tail: secret.slice(-4), ...(check.meta ?? {}) },
    status: check.status,
    detail: check.detail,
  });

  const rows = await listCredentialRows(g.project.id);
  const mine = rows.filter((r) => r.user_id === g.user.id);
  const members = await listMembers(g.project.id);
  const nameOf = (userId: string) => members.find((m) => m.user_id === userId)?.name ?? 'You';

  return NextResponse.json({
    ok: true,
    status: check.status,
    detail: check.detail,
    mine: mine.map((r) => view(r, g.user.id, nameOf)),
  });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code') ?? '');
  if (!isGuard(g)) return g;

  const provider = url.searchParams.get('provider') ?? '';
  const userId = url.searchParams.get('user_id') || g.user.id;
  if (!provider) return bad('Which credential?');

  if (userId !== g.user.id && !g.access.canAdmin) {
    return bad('You can only remove your own credentials.', 403);
  }
  if (userId !== g.user.id) {
    const row = await getCredential(g.project.id, userId, provider);
    if (!row) return bad('That credential does not exist.', 404);
  }

  await deleteCredential(g.project.id, userId, provider);
  return NextResponse.json({ ok: true });
}
