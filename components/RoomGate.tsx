'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Sparkles, Users } from 'lucide-react';
import { ROLES } from '@/lib/defaults';
import { api, getAuthToken, post, setAuthToken } from '@/lib/client';
import { Logo, Pill, Spinner } from './ui';

const ROLE_ICONS: Record<string, string> = {
  pm: '🎯', design: '🎨', eng: '⚙️', qa: '🧪', growth: '📈', member: '🧩',
};

/** In-room gate: the room stays visible behind it, entry is one click, no cookie required. */
export default function RoomGate({
  code,
  roomName,
  tagline,
  members,
  demoCode,
}: {
  code: string;
  roomName: string;
  tagline: string | null;
  members: number;
  demoCode: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('pm');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState<'enter' | 'guest' | 'demo' | 'resume' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If cookies are blocked but this browser still holds a signed token
  // (e.g. after a reload), walk straight back into the room.
  useEffect(() => {
    const stored = getAuthToken();
    if (!stored) return;
    let alive = true;
    setBusy('resume');
    api<{ project: { code: string } }>(`/api/workspace?code=${code}`)
      .then(() => {
        if (alive) router.replace(`/room/${code}?k=${encodeURIComponent(stored)}`);
      })
      .catch(() => {
        if (alive) setBusy(null);
      });
    return () => {
      alive = false;
    };
  }, [code, router]);

  async function enter(opts: { guest?: boolean; demo?: boolean } = {}) {
    setBusy(opts.demo ? 'demo' : opts.guest ? 'guest' : 'enter');
    setError(null);
    try {
      const res = await post<{ code: string; token: string }>('/api/auth/join', {
        name: opts.guest ? '' : name,
        guest: opts.guest,
        role: opts.demo ? 'member' : role,
        passcode: opts.demo ? null : passcode || null,
        mode: 'join',
        projectCode: opts.demo ? demoCode : code,
      });
      setAuthToken(res.token);
      router.push(`/room/${res.code}?k=${encodeURIComponent(res.token)}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="app-bg relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-lines" />
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-electric/20 blur-[110px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-[12.5px] font-semibold text-slate-900">One Stop Pro Manager</span>
          </Link>
          <Pill tone="mint">room ready</Pill>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200/90 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              live meeting room · /{code}
            </div>
            <h1 className="mt-1.5 text-[19px] font-semibold leading-tight tracking-tight text-slate-900">{roomName}</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{tagline || 'One room, one thread, one launch.'}</p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Users className="h-3 w-3" /> {members} {members === 1 ? 'member' : 'members'} already in this room
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="gate-name">Your name</label>
                <input
                  id="gate-name"
                  className="field"
                  placeholder="Amar Tripathi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') enter();
                  }}
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div>
                <label className="label" htmlFor="gate-role">Your seat</label>
                <select id="gate-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key} className="bg-ink-800">
                      {ROLE_ICONS[r.key]} {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-slate-500">
                <Lock className="h-3 w-3 text-amber" /> Owner passcode <span className="text-slate-500">(only if this is your workspace)</span>
              </summary>
              <input
                className="field mt-2"
                type="password"
                placeholder="ADMIN_PASSCODE"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') enter();
                }}
              />
            </details>

            {error && <div className="mb-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[11.5px] text-rose">{error}</div>}

            <button type="button" className="btn-primary w-full py-2.5" onClick={() => enter()} disabled={busy !== null}>
              {busy === 'enter' || busy === 'resume' ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {busy === 'resume' ? 'Re-opening your session…' : 'Enter the room'}
            </button>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost flex-1 py-2 text-[11.5px]"
                onClick={() => enter({ guest: true })}
                disabled={busy !== null}
              >
                {busy === 'guest' ? <Spinner className="h-3.5 w-3.5" /> : null} Enter as guest
              </button>
              <button
                type="button"
                className="btn-ghost flex-1 py-2 text-[11.5px]"
                onClick={() => enter({ guest: true, demo: true })}
                disabled={busy !== null}
              >
                {busy === 'demo' ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} Demo room
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-500">
              Guest entry needs no details. Only the owner passcode unlocks editing.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-[10.5px] text-slate-500">
          <Link href="/" className="hover:text-slate-500">Overview</Link>
          <span>·</span>
          <Link href="/join" className="hover:text-slate-500">Join form</Link>
          <span>·</span>
          <Link href="/join?create=1" className="hover:text-slate-500">New room</Link>
        </div>
      </div>
    </main>
  );
}
