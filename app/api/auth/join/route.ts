import { NextResponse } from 'next/server';
import { createUser, createProject, ensureBase, findProject, findUserByEmail, joinProject } from '@/lib/repo';
import { isOwnerPasscode, resolveAdmin, setSessionCookie, signSession } from '@/lib/auth';
import { DEMO_CODE } from '@/lib/repo';
import type { Role, User } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLES = ['pm', 'design', 'eng', 'qa', 'growth', 'member'];

export async function POST(req: Request) {
  try {
    await ensureBase();
    const body = await req.json().catch(() => ({}));
    const guest = body.guest === true;
    const name =
      String(body.name ?? '').trim().slice(0, 60) ||
      (guest ? `Guest ${Math.floor(1000 + Math.random() * 9000)}` : '');
    const email = body.email ? String(body.email).trim().toLowerCase().slice(0, 160) : null;
    const role = (ROLES.includes(body.role) ? body.role : 'member') as Role;
    const admin = isOwnerPasscode(body.passcode);
    const mode = body.mode === 'create' ? 'create' : 'join';

    if (!name) return NextResponse.json({ error: 'Tell us your name so the team knows who is talking.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
    }

    const existing = email ? await findUserByEmail(email) : null;
    let user: User;
    if (!existing) {
      user = await createUser({ name, email, role, isAdmin: admin });
    } else {
      let updated: User = existing;
      if (admin && !existing.is_admin) {
        const { sql } = await import('@/lib/db');
        const rows = await sql<User>('UPDATE users SET is_admin = true WHERE id = $1 RETURNING *', [existing.id]);
        updated = rows[0] ?? updated;
      }
      if (role !== updated.role) {
        const { sql } = await import('@/lib/db');
        const rows = await sql<User>('UPDATE users SET role = $2 WHERE id = $1 RETURNING *', [updated.id, role]);
        updated = rows[0] ?? updated;
      }
      user = updated;
    }

    let project;
    if (mode === 'create') {
      const projectName = String(body.projectName ?? '').trim().slice(0, 80) || `${name.split(' ')[0]}'s product room`;
      project = await createProject({
        name: projectName,
        tagline: body.tagline ? String(body.tagline).slice(0, 160) : undefined,
        ownerId: user.id,
        code: body.code ? String(body.code) : undefined,
      });
    } else {
      project = await findProject(String(body.projectCode ?? DEMO_CODE));
      if (!project) return NextResponse.json({ error: 'That room link is not valid. Ask the owner for a new one.' }, { status: 404 });
      await joinProject(project.id, user.id, role);
    }

    const payload = { uid: user.id, name: user.name, role: user.role, admin: resolveAdmin(user) as boolean };
    setSessionCookie(payload);
    // Same signed payload as the cookie — the client can use it if cookies are blocked.
    const token = signSession(payload);

    return NextResponse.json({
      ok: true,
      code: project.code,
      token,
      user: { id: user.id, name: user.name, role: user.role, isAdmin: resolveAdmin(user) },
    });
  } catch (err) {
    console.error('[join]', err);
    return NextResponse.json({ error: 'Could not open the room. Try again.' }, { status: 500 });
  }
}
