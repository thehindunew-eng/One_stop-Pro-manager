import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { setSignalStatus, addMessage } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (!body.id) return bad('Missing signal id');
  const status = ['open', 'accepted', 'dismissed'].includes(body.status) ? body.status : 'open';
  await setSignalStatus(g.project.id, String(body.id), status);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  const label = String(body.label ?? '').trim();
  if (!label) return bad('What is the signal?');
  const { replaceSignals } = await import('@/lib/repo');
  await replaceSignals(g.project.id, [
    {
      type: ['pain', 'user', 'evidence', 'idea', 'decision', 'blocker', 'metric', 'question'].includes(body.type) ? body.type : 'pain',
      label: label.slice(0, 200),
      detail: String(body.detail ?? 'Added manually').slice(0, 400),
      score: Math.min(99, Number(body.score) || 70),
      status: 'open',
      evidence: [{ author: g.user.name, content: label.slice(0, 200), at: new Date().toISOString() }],
    },
  ]);
  return NextResponse.json({ ok: true });
}
