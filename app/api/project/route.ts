import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { addMessage, listStages, updateProject } from '@/lib/repo';
import type { StageKey } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;

  const stages = await listStages(false);
  const stageKeys = stages.map((s) => s.key);
  const stageKey = body.stage_key as StageKey | undefined;
  if (stageKey && !stageKeys.includes(stageKey)) return bad('Unknown stage');
  // Moving the lifecycle is a team action; renaming the room is not.
  if (!g.access.canEdit && (body.name || body.settings || body.tagline)) {
    return bad('Only the owner can edit the workspace.', 403);
  }

  const updated = await updateProject(g.project.id, {
    name: body.name !== undefined ? String(body.name).slice(0, 90) : undefined,
    tagline: body.tagline !== undefined ? String(body.tagline).slice(0, 180) : undefined,
    stage_key: stageKey,
    status: stageKey ? `in_${stageKey}` : undefined,
    settings: body.settings,
  });

  if (stageKey) {
    const stage = stages.find((s) => s.key === stageKey);
    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: 'Prime',
      role: 'assistant',
      kind: 'system',
      content: `Lifecycle moved to ${stage?.name ?? stageKey}. The Docs, Tools and Board below are scoped to this stage.`,
      meta: { stage: stageKey },
    });
  }

  return NextResponse.json({ project: updated });
}
