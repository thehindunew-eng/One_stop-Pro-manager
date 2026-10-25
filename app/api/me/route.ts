import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { resolveAdmin } from '@/lib/auth';
import { listProjectsForUser, ensureBase } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureBase();
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, projects: [] });
  const projects = await listProjectsForUser(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isAdmin: resolveAdmin(user) },
    projects: projects.map((p) => ({ code: p.code, name: p.name, stage: p.stage_key })),
  });
}
