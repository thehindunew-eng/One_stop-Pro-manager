import { NextResponse } from 'next/server';
import { guard, isGuard, bad } from '@/lib/api';
import {
  addMessage, getArtifact, listArtifacts, listMembers, listTools, listStages,
  setArtifactStatus, upsertArtifactContent,
} from '@/lib/repo';
import { generateDoc, type DocContext } from '@/lib/generate';
import { draftDocument, engineLabel } from '@/lib/ai';
import { ARTIFACT_BLUEPRINTS } from '@/lib/defaults';
import type { ProblemStatement, StageKey, Project } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STAGE_NAMES: Record<string, string> = {
  discover: 'Discover', define: 'Define', ideate: 'Ideate', design: 'Design', architect: 'Architect',
  build: 'Build', test: 'Test', launch: 'Launch', grow: 'Grow',
};

async function buildContext(project: Project, stageKey: StageKey): Promise<DocContext> {
  const members = await listMembers(project.id);
  const tools = await listTools(true);
  const stages = await listStages(true);
  const stage = stages.find((s) => s.key === stageKey);
  return {
    project,
    problem: project.problem as ProblemStatement | null,
    members: members.map((m) => ({ name: m.name, role: m.role })),
    tools,
    stageName: stage?.name ?? STAGE_NAMES[stageKey] ?? 'Workspace',
    stageKey,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;

  const kinds = ARTIFACT_BLUEPRINTS;
  const allDocs = Object.entries(kinds).flatMap(([stage, docs]) =>
    docs.map((d) => ({ ...d, stageKey: stage as StageKey })),
  );

  const target = body.kind
    ? allDocs.find((d) => d.kind === body.kind)
    : body.artifact
      ? allDocs.find((d) => d.kind === (body.artifact as string))
      : undefined;

  // regenerate a whole stage (or everything) when asked
  const stageFilter: StageKey | undefined = body.stage as StageKey | undefined;
  const list = target ? [target] : body.all ? allDocs : stageFilter ? allDocs.filter((d) => d.stageKey === stageFilter) : [];
  if (!list.length) return bad('Unknown document kind.');

  const label = await engineLabel();
  const generated: { kind: string; title: string; engine: string }[] = [];
  const skipped: string[] = [];
  // A stage can hold six documents and a live model can take 20s each. Stop
  // before the serverless timeout and tell the client what is left, instead of
  // returning a 504 with half the work silently lost.
  const deadline = Date.now() + 42_000;

  for (const doc of list) {
    if (generated.length && Date.now() > deadline) {
      skipped.push(doc.kind);
      continue;
    }
    const ctx = await buildContext(g.project, doc.stageKey);
    let content: string | null = null;
    let engine = 'workspace template engine';
    if (label.live) {
      const draft = await draftDocument(doc.kind, doc.title, {
        project: g.project,
        problem: ctx.problem,
        stageName: ctx.stageName,
        stageTagline: '',
        members: ctx.members,
        freeTools: ctx.tools.filter((t) => t.stages.includes(doc.stageKey)).map((t) => t.name).slice(0, 14),
      });
      if (draft) {
        content = draft.content;
        engine = draft.engine;
      }
    }
    if (!content) content = generateDoc(doc.kind, doc.title, ctx);
    await upsertArtifactContent(g.project.id, doc.kind, content, 'ready', g.user.name);
    generated.push({ kind: doc.kind, title: doc.title, engine });
  }

  const artifacts = await listArtifacts(g.project.id);
  if (generated.length === 1) {
    await addMessage({
      projectId: g.project.id,
      userId: null,
      author: 'Prime',
      role: 'assistant',
      kind: 'system',
      content: `Generated “${generated[0].title}” for ${STAGE_NAMES[list[0].stageKey]}. Engine: ${generated[0].engine}. Open the Docs tab to edit it.`,
      meta: { kind: generated[0].kind },
    });
  }

  return NextResponse.json({ artifacts, generated, skipped, live: label.live });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body.code);
  if (!isGuard(g)) return g;
  if (!body.id) return bad('Missing document id');
  const artifact = await getArtifact(g.project.id, String(body.id));
  if (!artifact) return bad('Document not found', 404);

  if (typeof body.content === 'string') {
    await upsertArtifactContent(g.project.id, artifact.kind, body.content, body.status ?? artifact.status, g.user.name);
  }
  if (body.status && ['draft', 'ready', 'approved'].includes(body.status)) {
    await setArtifactStatus(g.project.id, artifact.id, body.status);
  }
  const artifacts = await listArtifacts(g.project.id);
  return NextResponse.json({ artifacts });
}
