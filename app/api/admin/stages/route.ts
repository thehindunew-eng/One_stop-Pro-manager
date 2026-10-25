import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { addStage, listStages, saveStage } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ stages: await listStages(false) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code, true);
  if (!isGuard(g)) return g;

  if (body.action === 'create') {
    const key = String(body.key ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    const name = String(body.name ?? '').trim().slice(0, 40);
    if (!key || !name) return bad('A new stage needs a key and a name.');
    const existing = (await listStages(false)).find((s) => s.key === key);
    if (existing) return bad('That stage key already exists.');
    const stage = await addStage({ key: key as any, name, tagline: body.tagline, icon: body.icon, color: body.color });
    return NextResponse.json({ stage, stages: await listStages(false) });
  }

  const key = String(body.key ?? '');
  if (!key) return bad('Missing stage key');
  const stage = await saveStage({
    key: key as any,
    name: String(body.name ?? '').slice(0, 40) || key,
    tagline: body.tagline !== undefined ? String(body.tagline).slice(0, 200) : undefined,
    icon: body.icon,
    color: body.color,
    position: Number(body.position) || 0,
    enabled: body.enabled !== false,
    checklist: Array.isArray(body.checklist) ? body.checklist.map((c: unknown) => String(c).slice(0, 200)) : undefined,
  });
  return NextResponse.json({ stage, stages: await listStages(false) });
}
