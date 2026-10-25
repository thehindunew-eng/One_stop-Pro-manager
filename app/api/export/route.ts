import { guard, isGuard } from '@/lib/api';
import { listArtifacts, listMembers, listSignals, listStages, listTasks } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;

  const [artifacts, signals, tasks, stages, members] = await Promise.all([
    listArtifacts(g.project.id),
    listSignals(g.project.id),
    listTasks(g.project.id),
    listStages(false),
    listMembers(g.project.id),
  ]);
  const p = g.project.problem;

  const lines: string[] = [];
  lines.push(`# ${g.project.name} — product pack`);
  if (g.project.tagline) lines.push(`> ${g.project.tagline}`);
  lines.push(`\nGenerated ${new Date().toUTCString()} · room /room/${g.project.code} · team: ${members.map((m) => `${m.name} (${m.role})`).join(', ')}\n`);

  if (p) {
    lines.push('## The problem statement\n');
    lines.push(`**${p.title}** (${p.confidence}% confidence, ${p.status})\n`);
    lines.push(`> ${p.statement}\n`);
    lines.push(`${p.summary}\n`);
    const block = (label: string, items: string[]) =>
      items?.length ? `**${label}**\n${items.map((i) => `- ${i}`).join('\n')}\n` : '';
    lines.push(block('Users', p.users));
    lines.push(block('Pains', p.pains));
    lines.push(block('Evidence', p.evidence));
    lines.push(block('Assumptions', p.assumptions));
    lines.push(block('Unknowns', p.unknowns));
    lines.push(block('Success metrics', p.successMetrics));
    lines.push(block('Solution angles', p.solutionAngles));
    lines.push(`_Extracted by ${p.engine} on ${new Date(p.updatedAt).toLocaleString()}_\n`);
  } else {
    lines.push('## The problem statement\n\n_Not extracted yet._\n');
  }

  lines.push('## Signals from the room\n');
  for (const s of signals.slice(0, 40)) {
    lines.push(`- **${s.type}** (${s.score}) — ${s.label}${s.status !== 'open' ? ` _[${s.status}]_` : ''}`);
  }

  lines.push('\n## Lifecycle\n');
  for (const stage of stages) {
    const stageArtifacts = artifacts.filter((a) => a.stage_key === stage.key && a.content.trim());
    const stageTasks = tasks.filter((t) => t.stage_key === stage.key);
    lines.push(`### ${stage.name} — ${stageTasks.filter((t) => t.status === 'done').length}/${stageTasks.length} tasks done`);
    lines.push(`${stage.tagline}\n`);
    if (stage.checklist?.length) lines.push(stage.checklist.map((c) => `- [ ] ${c}`).join('\n') + '\n');
    if (stageTasks.length) {
      lines.push('**Board**\n');
      lines.push(stageTasks.map((t) => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title} · ${t.priority}${t.owner ? ` · ${t.owner}` : ''} (${t.status})`).join('\n') + '\n');
    }
    for (const a of stageArtifacts) {
      lines.push('\n---\n');
      lines.push(a.content.trim());
      lines.push('');
    }
  }

  lines.push('\n---\n_Produced with One Stop Pro Manager — the meeting IDE for product teams._');

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${g.project.code}-product-pack.md"`,
      'cache-control': 'no-store',
    },
  });
}
