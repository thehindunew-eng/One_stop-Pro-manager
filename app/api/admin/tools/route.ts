import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { deleteTool, listTools, saveTool } from '@/lib/repo';
import type { StageKey } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ tools: await listTools(false) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code, true);
  if (!isGuard(g)) return g;
  const name = String(body.name ?? '').trim();
  const category = String(body.category ?? '').trim();
  if (!name || !category) return bad('A tool needs a name and a category.');
  const stages: StageKey[] = Array.isArray(body.stages) ? body.stages : [];
  const tool = await saveTool({
    id: body.id,
    name,
    category,
    stages,
    url: body.url ? String(body.url).slice(0, 300) : '',
    color: body.color ? String(body.color).replace('#', '').slice(0, 8) : '6366f1',
    description: body.description ? String(body.description).slice(0, 300) : '',
    free_tier: body.free_tier ? String(body.free_tier).slice(0, 120) : '',
    enabled: body.enabled !== false,
    slug: body.slug,
  } as any);
  return NextResponse.json({ tool, tools: await listTools(false) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code'), true);
  if (!isGuard(g)) return g;
  const id = url.searchParams.get('id');
  if (!id) return bad('Missing tool id');
  await deleteTool(id);
  return NextResponse.json({ tools: await listTools(false) });
}
