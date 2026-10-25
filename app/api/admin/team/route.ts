import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { listMembers, joinProject } from '@/lib/repo';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code, true);
  if (!isGuard(g)) return g;

  if (body.action === 'remove' && body.user_id) {
    if (body.user_id === g.project.owner_id) return bad('The owner cannot be removed.');
    await sql('DELETE FROM members WHERE project_id = $1 AND user_id = $2', [g.project.id, body.user_id]);
    return NextResponse.json({ members: await listMembers(g.project.id) });
  }

  if (body.action === 'add') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return bad('Add an email to invite a teammate.');
    const existing = await sql<any>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    const { createUser } = await import('@/lib/repo');
    const user = existing[0] ?? (await createUser({ name: email.split('@')[0], email, role: body.role ?? 'member' }));
    await joinProject(g.project.id, user.id, body.role ?? 'member');
    return NextResponse.json({ members: await listMembers(g.project.id) });
  }

  if (body.user_id) {
    const role = ['pm', 'design', 'eng', 'qa', 'growth', 'member'].includes(body.role) ? body.role : 'member';
    await sql('UPDATE members SET role = $3 WHERE project_id = $1 AND user_id = $2', [g.project.id, body.user_id, role]);
    await sql('UPDATE users SET role = $2 WHERE id = $1', [body.user_id, role]);
    return NextResponse.json({ members: await listMembers(g.project.id) });
  }

  return bad('Nothing to update.');
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;
  return NextResponse.json({ members: await listMembers(g.project.id) });
}
