import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { ensureBase, getWorkspace } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await ensureBase();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code') || '';
  const state = await getWorkspace(code, user);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json(state);
}
