import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { addMessage, listStages, updateProject } from '@/lib/repo';
import { planFor } from '@/lib/planServer';
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

  /*
   * A stage is a gate, not a tab. Moving forward with the current stage's gate
   * unmet is allowed — plans slip — but it has to be a stated decision, not a
   * silent click. The response carries exactly what is missing so the UI can
   * ask, and `force: true` records the override.
   */
  if (stageKey && stageKey !== g.project.stage_key && !body.force) {
    const current = stages.find((s) => s.key === g.project.stage_key);
    const target = stages.find((s) => s.key === stageKey);
    const movingForward = !!current && !!target && target.position > current.position;
    if (movingForward) {
      const built = await planFor(g.project.code);
      const stagePlan = built?.plan.stages.find((s) => s.key === g.project.stage_key);
      if (stagePlan && stagePlan.met < stagePlan.total) {
        return NextResponse.json(
          {
            error: `${current!.name} is not finished: ${stagePlan.total - stagePlan.met} exit criteria are open.`,
            gate: {
              stage: stagePlan.key,
              met: stagePlan.met,
              total: stagePlan.total,
              missing: stagePlan.criteria
                .filter((c) => !c.met)
                .map((c) => ({ id: c.id, label: c.label, evidence: c.evidence, manual: c.manual })),
            },
          },
          { status: 409 },
        );
      }
    }
  }

  const updated = await updateProject(g.project.id, {
    name: body.name !== undefined ? String(body.name).slice(0, 90) : undefined,
    tagline: body.tagline !== undefined ? String(body.tagline).slice(0, 180) : undefined,
    stage_key: stageKey,
    status: stageKey ? `in_${stageKey}` : undefined,
    settings: body.settings,
  });

  if (stageKey && body.force && stageKey !== g.project.stage_key) {
    const from = stages.find((s) => s.key === g.project.stage_key)?.name ?? g.project.stage_key;
    const to = stages.find((s) => s.key === stageKey)?.name ?? stageKey;
    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: 'Prime',
      role: 'assistant',
      kind: 'system',
      content: `${g.user.name} moved the lifecycle from ${from} to ${to} with its exit criteria still open. The gate stays open in the Run plan until it is met.`,
      meta: { stage: stageKey, gateOverride: true, from: g.project.stage_key },
    });
  }

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
