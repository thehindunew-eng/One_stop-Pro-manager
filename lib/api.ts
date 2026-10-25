import { NextResponse } from 'next/server';
import { currentUser } from './auth';
import { findProject, joinProject } from './repo';
import { accessFor } from './auth';
import { sql } from './db';
import type { Access, Project, User } from './types';

export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const ok = <T>(data: T) => NextResponse.json(data);

export interface Guard {
  user: User;
  project: Project;
  access: Access;
}

export async function guard(code: string | null | undefined, needEdit = false): Promise<Guard | NextResponse> {
  if (!code) return bad('Missing project code', 400);
  const user = await currentUser();
  if (!user) return bad('Not signed in. Join the room with your name first.', 401);
  const project = await findProject(code);
  if (!project) return bad('Project not found', 404);
  const access = accessFor(user, project.owner_id);

  // Holding the room link is the invitation: make sure the person is a real
  // member so their edits show up in the team list, exactly like the UI does.
  const rows = await sql<{ user_id: string }>(
    'SELECT user_id FROM members WHERE project_id = $1 AND user_id = $2',
    [project.id, user.id],
  );
  if (!rows[0]) await joinProject(project.id, user.id, user.role);

  if (needEdit && !access.canEdit) return bad('Only the workspace owner can change this.', 403);
  return { user, project, access };
}

export const isGuard = (v: Guard | NextResponse): v is Guard => !(v instanceof NextResponse);

// tiny in-memory rate limiter (per project + action)
const hits = new Map<string, number>();
export function rateLimited(key: string, ms: number): boolean {
  const now = Date.now();
  const last = hits.get(key) ?? 0;
  if (now - last < ms) return true;
  hits.set(key, now);
  return false;
}
