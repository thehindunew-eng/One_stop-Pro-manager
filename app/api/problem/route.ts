import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import { addMessage, recordProblem } from '@/lib/repo';
import type { ProblemStatement } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  const current = g.project.problem as ProblemStatement | null;
  if (!current) return bad('No problem statement yet — run the analysis first.');
  if (body.action === 'approve' && !g.access.canEdit) {
    return bad('Only the workspace owner can approve the problem statement.', 403);
  }

  const strArr = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.map((x) => String(x).slice(0, 400)).filter(Boolean).slice(0, 12) : fallback;

  const action = body.action as string | undefined;
  const next: ProblemStatement = {
    ...current,
    title: body.title !== undefined ? String(body.title).slice(0, 140) : current.title,
    statement: body.statement !== undefined ? String(body.statement).slice(0, 900) : current.statement,
    summary: body.summary !== undefined ? String(body.summary).slice(0, 2000) : current.summary,
    users: strArr(body.users, current.users),
    pains: strArr(body.pains, current.pains),
    evidence: strArr(body.evidence, current.evidence),
    assumptions: strArr(body.assumptions, current.assumptions),
    unknowns: strArr(body.unknowns, current.unknowns),
    successMetrics: strArr(body.successMetrics, current.successMetrics),
    solutionAngles: strArr(body.solutionAngles, current.solutionAngles),
    tags: strArr(body.tags, current.tags),
    confidence: body.confidence !== undefined ? Math.max(0, Math.min(100, Number(body.confidence) || 0)) : current.confidence,
    status: action === 'approve' ? 'approved' : action === 'reopen' ? 'draft' : current.status,
    engine: action === 'approve' ? 'human-approved' : current.engine,
    updatedAt: new Date().toISOString(),
  };

  if (!next.statement.trim()) return bad('The problem question cannot be empty.');
  const stored = await recordProblem(g.project.id, next);

  if (action === 'approve') {
    await addMessage({
      projectId: g.project.id,
      userId: g.user.id,
      author: 'Prime',
      role: 'assistant',
      kind: 'system',
      content: `${g.user.name} approved the problem statement. Everything downstream now builds against: “${stored.statement}”`,
      meta: { event: 'problem_approved' },
    });
  }

  return NextResponse.json({ problem: stored });
}
