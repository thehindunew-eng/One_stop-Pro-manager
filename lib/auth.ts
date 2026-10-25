import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { sql } from './db';
import type { Access, Role, User } from './types';

const COOKIE = 'ospm_session';

/**
 * Session signing key.
 *
 * Set AUTH_SECRET and this is exactly that value. If it is missing on a real
 * deployment we derive the key from DATABASE_URL instead of falling back to a
 * constant that is published in this repository — that constant would let
 * anyone mint a session for any user id they can see in a room.
 */
const DEV_SECRET = 'one-stop-pro-manager-dev-secret-change-in-production';
const secretSource = (): 'explicit' | 'database' | 'development' => {
  if (process.env.AUTH_SECRET?.trim()) return 'explicit';
  if (process.env.DATABASE_URL?.trim()) return 'database';
  return 'development';
};
const SECRET = (() => {
  const source = secretSource();
  if (source === 'explicit') return process.env.AUTH_SECRET!.trim();
  if (source === 'database') {
    return crypto.createHash('sha256').update(`ospm-session:${process.env.DATABASE_URL}`).digest('hex');
  }
  return DEV_SECRET;
})();

export const sessionSecretStatus = () => ({
  source: secretSource(),
  strong: secretSource() !== 'development',
});

export interface SessionPayload {
  uid: string;
  name: string;
  role: Role;
  admin: boolean;
  iat: number;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

export function signSession(payload: Omit<SessionPayload, 'iat'>): string {
  const body: SessionPayload = { ...payload, iat: Date.now() };
  const data = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function readSession(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(data)) as SessionPayload;
    if (!payload.uid) return null;
    // 45 day session
    if (Date.now() - payload.iat > 45 * 86400000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Sessions travel two ways so the room works even when the browser blocks
 * cookies (embedded previews, third-party-iframe policies, privacy modes):
 *  1. the httpOnly cookie (preferred)
 *  2. a signed token in the `x-ospm-token` header, or `?k=` on the URL
 * Both are the same HMAC-signed payload — nothing new to trust.
 */
export async function currentSession(): Promise<SessionPayload | null> {
  const fromCookie = readSession(cookies().get(COOKIE)?.value);
  if (fromCookie) return fromCookie;
  try {
    const fromHeader = readSession(headers().get('x-ospm-token') ?? undefined);
    if (fromHeader) return fromHeader;
  } catch {
    /* not in a request scope */
  }
  return null;
}

export async function userFromToken(token: string | null | undefined): Promise<User | null> {
  const session = readSession(token ?? undefined);
  if (!session) return null;
  const rows = await sql<User>('SELECT * FROM users WHERE id = $1', [session.uid]);
  return rows[0] ?? null;
}

export async function currentUser(): Promise<User | null> {
  const session = await currentSession();
  if (!session) return null;
  const rows = await sql<User>('SELECT * FROM users WHERE id = $1', [session.uid]);
  return rows[0] ?? null;
}

export function setSessionCookie(payload: Omit<SessionPayload, 'iat'>): void {
  cookies().set(COOKIE, signSession(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 45 * 86400,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

const adminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** True when the owner passcode is still the documented default. */
export const usingDefaultPasscode = (): boolean => !process.env.ADMIN_PASSCODE?.trim();

export const isOwnerPasscode = (passcode: string | undefined | null): boolean => {
  const expected = process.env.ADMIN_PASSCODE?.trim() || 'amar-admin';
  if (!passcode || passcode.trim().length !== expected.length) return false;
  // constant-time compare so the passcode cannot be timed out
  return crypto.timingSafeEqual(Buffer.from(passcode.trim()), Buffer.from(expected));
};

export function resolveAdmin(user: Pick<User, 'email' | 'is_admin'>): boolean {
  if (user.is_admin) return true;
  if (user.email && adminEmails().includes(user.email.toLowerCase())) return true;
  return false;
}

export function accessFor(user: User, projectOwnerId: string): Access {
  const admin = resolveAdmin(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: admin,
    canEdit: admin || user.id === projectOwnerId,
    canAdmin: admin || user.id === projectOwnerId,
  };
}

export const DEMO_OWNER_EMAIL = 'amar@onestop.pro';
