import { guard, isGuard } from '@/lib/api';
import { listArtifacts, listMembers, listSignals, listStacks, listStages, listTasks } from '@/lib/repo';
import { buildPlan, type TeamPlan } from '@/lib/plan';
import type { Project } from '@/lib/types';

/*
 * Server-only glue: loads a room and evaluates its run plan.
 *
 * Kept out of lib/plan.ts on purpose — plan.ts must stay importable by client
 * components (the owner console uses its rule helpers), and pulling the
 * database into the browser bundle would be a real bug, not a warning.
 */

type GateChecks = Record<string, Record<string, boolean>>;

export function checksOf(project: Project): GateChecks {
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const raw = settings.gates;
  return raw && typeof raw === 'object' ? (raw as GateChecks) : {};
}

export function launchDateOf(project: Project): string | null {
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  return typeof settings.launchDate === 'string' ? settings.launchDate : null;
}

export async function planFor(code: string): Promise<{ g: any; plan: TeamPlan } | null> {
  const g = await guard(code);
  if (!isGuard(g)) return null;
  const [stages, tasks, artifacts, signals, members, stacks] = await Promise.all([
    listStages(false),
    listTasks(g.project.id),
    listArtifacts(g.project.id),
    listSignals(g.project.id),
    listMembers(g.project.id),
    listStacks(g.project.id),
  ]);
  const plan = buildPlan({
    project: g.project,
    stages,
    tasks,
    artifacts,
    problem: g.project.problem,
    signals,
    members,
    stacks,
    checks: checksOf(g.project),
    launchDate: launchDateOf(g.project),
  });
  return { g, plan };
}
