import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { updateProject } from '@/lib/repo';
import { checksOf, launchDateOf, planFor } from '@/lib/planServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The whole team can read the plan — it is the room's operating picture. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') ?? '';
  const result = await planFor(code);
  if (!result) return bad('Room not found', 404);
  return NextResponse.json({ ...result.plan, canEdit: result.g.access.canEdit, me: result.g.user.name });
}

/**
 * Two team actions:
 *  - tick or untick a manual gate criterion (anyone who can edit the room)
 *  - set or clear the launch date
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (!g.access.canEdit) return bad('You have read-only access to this room.', 403);

  const settings = (g.project.settings ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'gate') {
    const stage = String(body.stage ?? '').trim();
    const criterion = String(body.criterion ?? '').trim();
    if (!stage || !criterion) return bad('Missing stage or criterion.');
    const checks = checksOf(g.project);
    const forStage = { ...(checks[stage] ?? {}) };
    if (body.value === false) delete forStage[criterion];
    else forStage[criterion] = true;
    const next = { ...checks, [stage]: forStage };
    await updateProject(g.project.id, { settings: { ...settings, gates: next } });
  } else if (action === 'launch_date') {
    const raw = String(body.launchDate ?? '').trim();
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return bad('Use a date like 2026-11-14.');
    await updateProject(g.project.id, { settings: { ...settings, launchDate: raw || null } });
  } else {
    return bad('Unknown action.');
  }

  // Return the recomputed plan so the UI never has to guess.
  const code = String(body.code ?? '');
  const after = await planFor(code);
  if (!after) return bad('Room not found', 404);
  return NextResponse.json({ ...after.plan, canEdit: after.g.access.canEdit, me: after.g.user.name });
}
