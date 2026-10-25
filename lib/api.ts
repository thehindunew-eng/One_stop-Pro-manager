import { NextResponse } from 'next/server';
import { currentUser } from './auth';
import { findProject } from './repo';
import { accessFor } from './auth';
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
