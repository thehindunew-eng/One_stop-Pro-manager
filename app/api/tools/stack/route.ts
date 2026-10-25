import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { clearStack, listStacks, setStack } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ stacks: await listStacks(g.project.id) });
}

/** Any member can record how the team uses a tool — not just the owner. */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (!body.tool_id) return bad('Missing tool id');
  const stack = await setStack({
    projectId: g.project.id,
    toolId: String(body.tool_id),
    status: String(body.status ?? 'planned'),
    ourUrl: String(body.our_url ?? ''),
    note: String(body.note ?? ''),
    updatedBy: g.user.name,
  });
  return NextResponse.json({ stack, stacks: await listStacks(g.project.id) });
}

/** Take a tool back out of our stack — useful when a trial ends. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code'));
  if (!isGuard(g)) return g;
  const toolId = url.searchParams.get('tool_id');
  if (!toolId) return bad('Missing tool id');
  await clearStack(g.project.id, toolId);
  return NextResponse.json({ stacks: await listStacks(g.project.id) });
}
