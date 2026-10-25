import { NextResponse } from 'next/server';
import { guard, isGuard, bad, rateLimited } from '@/lib/api';
import { addMessage, listArtifacts, listMessages, listStages } from '@/lib/repo';
import { askAgent } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  const question = String(body.question ?? '').trim().slice(0, 1200);
  if (!question) return bad('Ask me something about the product.');
  if (rateLimited(`agent:${g.project.id}`, 1200)) return bad('One question at a time — try again in a second.', 429);

  const messages = await listMessages(g.project.id, 200);
  const [artifacts, stages] = await Promise.all([listArtifacts(g.project.id), listStages(false)]);
  const stage = stages.find((s) => s.key === g.project.stage_key)?.name ?? 'Discover';

  const answer = await askAgent(question, {
    project: g.project,
    problem: g.project.problem,
    messageCount: messages.length,
    artifacts: artifacts.map((a) => ({ title: a.title, status: a.status })),
    stage,
  });

  const questionMsg = await addMessage({
    projectId: g.project.id,
    userId: g.user.id,
    author: g.user.name,
    role: g.user.role,
    kind: 'chat',
    content: question,
    meta: { to: 'prime' },
  });

  const reply = await addMessage({
    projectId: g.project.id,
    userId: null,
    author: 'Prime',
    role: 'assistant',
    kind: 'chat',
    content: answer.content,
    meta: { engine: answer.engine, askedBy: g.user.name },
  });

  return NextResponse.json({ question: questionMsg, reply, engine: answer.engine });
}
