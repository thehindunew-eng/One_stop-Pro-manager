import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { createProject, ensureBase, joinProject } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await ensureBase();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Join with your name first.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Give the room a name.' }, { status: 400 });
  const project = await createProject({
    name,
    tagline: body.tagline ? String(body.tagline).slice(0, 160) : undefined,
    ownerId: user.id,
  });
  return NextResponse.json({ project });
}
