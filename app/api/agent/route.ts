import { NextResponse } from 'next/server';
import { guard, isGuard, bad, rateLimited } from '@/lib/api';
import {
  addMessage,
  listArtifacts,
  listMessages,
  listSignals,
  listStacks,
  listStages,
  listTasks,
  listTools,
} from '@/lib/repo';
import { askAgent, rankByRelevance, type AgentContext } from '@/lib/ai';

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

  const [messages, artifacts, stages, tasks, signals, stacks, tools] = await Promise.all([
    listMessages(g.project.id, 200),
    listArtifacts(g.project.id),
    listStages(false),
    listTasks(g.project.id),
    listSignals(g.project.id),
    listStacks(g.project.id),
    listTools(true),
  ]);

  // With a local embedding model installed, give the agent the documents that
  // actually relate to the question instead of the first eight in stage order.
  const withContent = artifacts.filter((a) => (a.content ?? '').trim().length > 80);
  const ranked = withContent.length > 6 ? await rankByRelevance(question, withContent, 6) : null;
  const contextDocs = ranked ?? artifacts.slice(0, 8);

  const toolById = new Map(tools.map((t) => [t.id, t]));
  const stageName = (key: string) => stages.find((s) => s.key === key)?.name ?? key;

  const ctx: AgentContext = {
    project: g.project,
    problem: g.project.problem,
    messageCount: messages.length,
    stage: stageName(g.project.stage_key),
    stageKey: g.project.stage_key,
    stages: stages.map((s) => {
      const mine = tasks.filter((t) => t.stage_key === s.key);
      return {
        key: s.key,
        name: s.name,
        done: mine.filter((t) => t.status === 'done').length,
        total: mine.length,
      };
    }),
    artifacts: contextDocs.map((a) => ({
      kind: a.kind,
      title: a.title,
      status: a.status,
      stage: stageName(a.stage_key),
      excerpt: (a.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 320),
    })),
    tasks: tasks.map((t) => ({
      title: t.title,
      status: t.status,
      owner: t.owner ?? null,
      stage: stageName(t.stage_key),
      priority: t.priority,
    })),
    signals: signals.map((s) => ({ type: s.type, label: s.label })),
    tools: stacks.map((st) => ({
      name: toolById.get(st.tool_id)?.name ?? st.tool_id,
      status: st.status,
      note: st.note ?? '',
    })),
    recent: messages
      .filter((m) => m.kind !== 'chat' || m.author !== 'Prime')
      .slice(-14)
      .map((m) => ({ author: m.author, content: m.content })),
    history: messages
      .filter((m) => m.author === 'Prime' || (m.meta as Record<string, unknown>)?.to === 'prime')
      .slice(-8)
      .map((m) => ({ role: m.author === 'Prime' ? ('prime' as const) : ('you' as const), content: m.content })),
  };

  const answer = await askAgent(question, ctx);

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

  return NextResponse.json({
    question: questionMsg,
    reply,
    engine: answer.engine,
    actions: answer.actions,
  });
}
