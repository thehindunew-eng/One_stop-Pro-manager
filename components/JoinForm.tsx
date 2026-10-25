'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, Lock, Sparkles, Users, ShieldCheck, Wand2 } from 'lucide-react';
import { Pill, Wordmark } from './ui';
import { ROLES } from '@/lib/defaults';
import { setAuthToken } from '@/lib/client';

const ROLE_ICONS: Record<string, string> = {
  pm: '🎯', design: '🎨', eng: '⚙️', qa: '🧪', growth: '📈', member: '🧩',
};

export default function JoinForm({
  defaultCode,
  defaultCreate,
  liveCode = 'onestop',
  demoCode = 'studio',
}: {
  defaultCode: string;
  defaultCreate: boolean;
  liveCode?: string;
  demoCode?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'join' | 'create'>(defaultCreate ? 'create' : 'join');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('pm');
  const [passcode, setPasscode] = useState('');
  const [showOwner, setShowOwner] = useState(false);
  const [code, setCode] = useState(defaultCode);
  const [projectName, setProjectName] = useState('');
  const [tagline, setTagline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || null,
          role,
          passcode: passcode || null,
          mode,
          projectCode: code,
          projectName,
          tagline,
          code: mode === 'create' ? projectName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the room.');
      if (data.token) setAuthToken(data.token);
      const target = passcode ? `/room/${data.code}/admin` : `/room/${data.code}`;
      router.push(data.token ? `${target}?k=${encodeURIComponent(data.token)}` : target);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/"><Wordmark /></Link>
          <Link href="/" className="btn-subtle text-[13px]">← Back to overview</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_460px] lg:py-16">
        <div className="hidden lg:block">
          <Pill tone="electric"><Sparkles className="h-3 w-3" /> The room is where the work happens</Pill>
          <h1 className="mt-4 text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
            Join the team,<br />
            <span className="text-electric">then build the thing.</span>
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-slate-500">
            Everyone gets the same problem statement, the same lifecycle and the same board. No sign-up wall, no
            invitation emails — just a name, a role and the link your PM shared.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: Users, title: 'Your voice is the input', body: 'Type, paste a transcript or drop notes. The copilot reads the room and extracts what matters.' },
              { icon: Wand2, title: 'One approved problem', body: 'The team agrees on a single question before any solution work starts.' },
              { icon: ShieldCheck, title: 'Owner keeps control', body: 'Amar can edit stages, tools and access from inside the platform.' },
            ].map((f) => (
              <div key={f.title} className="panel-flat flex items-start gap-3 p-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-slate-900">{f.title}</div>
                  <p className="text-[13px] leading-relaxed text-slate-500">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            <Link href={`/room/${liveCode}`} className="btn-ghost flex-1 justify-center py-2 text-[12px]">
              Open the live room
            </Link>
            <Link href={`/room/${demoCode}`} className="btn-ghost flex-1 justify-center py-2 text-[12px]">
              Open the demo room
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-[13px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-500">Owner?</span> Enter the passcode you set in
            <code className="mx-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[12px] text-cyan-800">ADMIN_PASSCODE</code>
            to unlock the admin console. Default demo passcode: <span className="text-slate-500">amar-admin</span>.
          </div>
        </div>

        <div className="panel p-5 lg:p-6">
          <div className="mb-5 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition ${mode === 'join' ? 'bg-white text-slate-900 shadow-card ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Join a room
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition ${mode === 'create' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Create a room
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input id="name" className="field" placeholder="Amar Tripathi" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="email">Email <span className="normal-case tracking-normal text-slate-500">(optional)</span></label>
                <input id="email" className="field" type="email" placeholder="you@team.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="role">Your seat</label>
                <select id="role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key} className="bg-white">
                      {ROLE_ICONS[r.key]} {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'join' ? (
              <div>
                <label className="label" htmlFor="code">Room link code</label>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-[12px] text-slate-500">/room/</span>
                  <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="studio" required />
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  Your live workspace is{' '}
                  <button type="button" className="link" onClick={() => setCode(liveCode)}>{liveCode}</button>.{' '}
                  Want to look before you type? The demo room{' '}
                  <button type="button" className="link" onClick={() => setCode(demoCode)}>{demoCode}</button>{' '}
                  is pre-loaded with a full kickoff.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="projectName">Product room name</label>
                  <input id="projectName" className="field" placeholder="Clinic no-show killer" value={projectName} onChange={(e) => setProjectName(e.target.value)} required maxLength={80} />
                </div>
                <div>
                  <label className="label" htmlFor="tagline">One-line goal <span className="normal-case tracking-normal text-slate-500">(optional)</span></label>
                  <input id="tagline" className="field" placeholder="Turn a messy kickoff into a shipped v0.1 in two weeks" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={160} />
                </div>
                <p className="text-[13px] leading-relaxed text-slate-500">
                  You become the owner of this room: you can edit stages, tools and the problem statement, and invite the
                  team with the link.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => setShowOwner((v) => !v)}
                className="flex w-full items-center justify-between text-left text-[12px] font-medium text-slate-500"
              >
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-amber" /> Owner passcode (optional)</span>
                <span className="text-[12px] text-slate-500">{showOwner ? 'hide' : 'unlock admin'}</span>
              </button>
              {showOwner && (
                <input
                  className="field mt-2.5"
                  type="password"
                  placeholder="ADMIN_PASSCODE"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose">{error}</div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {mode === 'join' ? 'Enter the room' : 'Create the room'}
            </button>

            <p className="text-center text-[13px] leading-relaxed text-slate-500">
              Demo mode. Anyone with the link can join; only the owner and platform admins can edit the platform.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
