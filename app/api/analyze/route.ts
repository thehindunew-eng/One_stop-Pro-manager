import { NextResponse } from 'next/server';
import { guard, isGuard, bad, rateLimited } from '@/lib/api';
import {
  addMessage, listArtifacts, listMembers, listMessages, listSignals, recordProblem, replaceSignals,
} from '@/lib/repo';
import { analyzeConversation, engineLabel } from '@/lib/ai';
import { extractSignals } from '@/lib/intel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (rateLimited(`analyze:${g.project.id}`, 2500)) {
    return bad('Give me a few seconds — an analysis is already running.', 429);
  }

  const all = await listMessages(g.project.id, 200);
  const conversation = all.filter((m) => m.kind !== 'system');
  if (conversation.length < 2) {
    return bad('I need at least a couple of messages before I can call the problem. Talk it through first.', 422);
  }

  const result = await analyzeConversation(conversation, g.project);
  const rules = extractSignals(conversation);
  const signals = result.signals.length ? result.signals : rules;
  await replaceSignals(g.project.id, signals.map((s) => ({ ...s, evidence: s.evidence ?? [] })));
  const problem = await recordProblem(g.project.id, { ...result.problem, status: 'draft' });
  const members = await listMembers(g.project.id);
  const label = await engineLabel();

  await addMessage({
    projectId: g.project.id,
    userId: null,
    author: 'Prime',
    role: 'assistant',
    kind: 'system',
    content:
      `Problem draft updated (${problem.confidence}% confidence). Question: “${problem.statement}”\n` +
      `Signals: ${signals.filter((s) => s.type === 'pain').length} pains · ` +
      `${signals.filter((s) => s.type === 'evidence').length} evidence · ` +
      `${signals.filter((s) => s.type === 'decision').length} decisions. ` +
      `${problem.unknowns[0] ? `Biggest unknown: ${problem.unknowns[0]}` : ''}`,
    meta: { engine: result.engine, confidence: problem.confidence, participants: members.length, live: label.live },
  });

  const [freshSignals, artifacts] = await Promise.all([listSignals(g.project.id), listArtifacts(g.project.id)]);
  return NextResponse.json({
    problem,
    signals: freshSignals,
    artifacts,
    engine: result.engine,
    live: label.live,
  });
}
