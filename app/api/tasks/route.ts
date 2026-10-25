import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { createTask, deleteTask, listTasks, updateTask } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ tasks: await listTasks(g.project.id) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  const title = String(body.title ?? '').trim();
  if (!title) return bad('A task needs a title.');
  await createTask(g.project.id, {
    title,
    detail: body.detail ? String(body.detail).slice(0, 2000) : '',
    stage_key: body.stage_key,
    status: body.status,
    owner: body.owner ?? g.user.name,
    priority: ['P0', 'P1', 'P2'].includes(body.priority) ? body.priority : 'P1',
    points: Number(body.points) || 3,
  });
  return NextResponse.json({ tasks: await listTasks(g.project.id) });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (!body.id) return bad('Missing task id');
  await updateTask(g.project.id, String(body.id), {
    title: body.title,
    detail: body.detail,
    status: body.status,
    owner: body.owner,
    priority: body.priority,
    points: body.points,
    position: body.position,
    stage_key: body.stage_key,
  });
  return NextResponse.json({ tasks: await listTasks(g.project.id) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const g = await guard(url.searchParams.get('code'));
  if (!isGuard(g)) return g;
  const id = url.searchParams.get('id');
  if (!id) return bad('Missing task id');
  await deleteTask(g.project.id, id);
  return NextResponse.json({ tasks: await listTasks(g.project.id) });
}
