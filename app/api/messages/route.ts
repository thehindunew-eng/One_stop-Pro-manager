import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { addMessage, listMessages } from '@/lib/repo';
import { extractSignals } from '@/lib/intel';
import { replaceSignals, listSignals } from '@/lib/repo';
import type { MessageKind } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const KINDS: MessageKind[] = ['chat', 'note', 'idea', 'decision', 'question', 'transcript'];

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ messages: await listMessages(g.project.id) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  const content = String(body.content ?? '').trim();
  if (!content) return bad('Say something first.');
  if (content.length > 4000) return bad('That message is too long — split it up.');
  const kind: MessageKind = KINDS.includes(body.kind) ? body.kind : 'chat';

  const message = await addMessage({
    projectId: g.project.id,
    userId: g.user.id,
    author: g.user.name,
    role: g.user.role,
    kind,
    content,
    meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
  });

  // live signal extraction on the fly (cheap, local) for idea/decision/notes
  let newSignals: any[] = [];
  if (kind === 'idea' || kind === 'decision' || kind === 'question') {
    const recent = await listMessages(g.project.id, 40);
    const extracted = extractSignals([message]).slice(0, 3);
    await replaceSignals(g.project.id, extracted);
    newSignals = extracted;
  }

  return NextResponse.json({ message, signals: newSignals });
}
