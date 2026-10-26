import { guard, isGuard } from '@/lib/api';
import { listArtifacts, listMembers, listSignals, listStages, listStacks, listTasks, listTools } from '@/lib/repo';
import { buildPlan, type PlanAction } from '@/lib/plan';
import { ROLE_LABELS } from '@/lib/defaults';
import { isOverdue, shortDate } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The export is the handover artifact: the thing a whole team can open on day one
 * and work from without asking the PM what to do next.
 *
 * It is ordered the way the work happens — where we are, who does what today,
 * what blocks launch, then each stage with its gate, its board and its documents.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const g = await guard(code);
  if (!isGuard(g)) return g;

  const [artifacts, signals, tasks, stages, members, stacks, tools] = await Promise.all([
    listArtifacts(g.project.id),
    listSignals(g.project.id),
    listTasks(g.project.id),
    listStages(false),
    listMembers(g.project.id),
    listStacks(g.project.id),
    listTools(true),
  ]);

  const project = g.project;
  const problem = project.problem;
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const plan = buildPlan({
    project,
    stages,
    tasks,
    artifacts,
    problem,
    signals,
    members,
    stacks,
    checks: (settings.gates ?? {}) as Record<string, Record<string, boolean>>,
    launchDate: typeof settings.launchDate === 'string' ? settings.launchDate : null,
  });

  const toolById = new Map(tools.map((t) => [t.id, t]));
  const stageName = (key: string) => stages.find((s) => s.key === key)?.name ?? key;
  const docsFor = (stageKey: string) => artifacts.filter((a) => a.stage_key === stageKey && (a.content ?? '').trim());

  const L: string[] = [];
  const push = (...lines: string[]) => L.push(...lines);

  /* ---------------------------------------------------------------- cover */
  push(`# ${project.name} — team launch pack`);
  if (project.tagline) push(`> ${project.tagline}`);
  push('');
  push(
    `Room \`/room/${project.code}\` · ${members.length} ${members.length === 1 ? 'member' : 'members'} · stage **${stageName(
      project.stage_key,
    )}** · ${plan.readiness.score}% of launch gates cleared${
      plan.readiness.launchDate ? ` · launch date **${plan.readiness.launchDate}**` : ''
    }`,
  );
  push('');
  push(`Generated ${new Date().toUTCString()} from One Stop Pro Manager.`);
  push('');

  /* ------------------------------------------------------------ how to use */
  push('## How to use this pack');
  push('');
  push('Read it in this order. Nothing here needs another tool or another meeting to start.');
  push('');
  push('| Step | What you do | Where it is |');
  push('| --- | --- | --- |');
  push('| 1 | Read where the product is right now | *Where we are* below |');
  push('| 2 | Find your name, take your three actions | *Who does what next* |');
  push('| 3 | Check what is blocking launch | *Launch readiness* |');
  push('| 4 | Work the current stage against its gate, not its checklist | *Stage by stage* |');
  push('| 5 | Open the board and put dates on the next five tasks | Your room → Lifecycle → Board |');
  push('| 6 | Re-run the problem engine after the next team meeting | Your room → Meeting |');
  push('');
  push('Two rules that make the rest work: **a stage is finished when its gate is met**, and **every document has a named owner**.');
  push('');

  /* --------------------------------------------------------- where we are */
  push('## Where we are');
  push('');
  const currentStage = plan.stages.find((s) => s.key === project.stage_key) ?? plan.stages[0];
  push(
    `**Stage:** ${currentStage?.name ?? '—'} (${currentStage?.met ?? 0}/${currentStage?.total ?? 0} gate criteria met). ` +
      `**Board:** ${plan.board.open} open of ${plan.board.total}, ${plan.board.unowned} unowned, ${plan.board.overdue} overdue, ${plan.board.inReview} in review.`,
  );
  push('');
  if (problem) {
    push(`**Problem:** ${problem.title} *(${problem.confidence}% confidence, ${problem.status})*`);
    push('');
    push(`> ${problem.statement}`);
    push('');
  }
  const doneStages = plan.stages.filter((s) => s.state === 'met').map((s) => s.name);
  const openStages = plan.stages.filter((s) => s.state !== 'met').map((s) => s.name);
  push(`- **Gate met:** ${doneStages.length ? doneStages.join(', ') : 'none yet'}`);
  push(`- **Still open:** ${openStages.length ? openStages.join(', ') : 'none — you are launchable'}`);
  if (plan.readiness.daysToLaunch != null) {
    push(
      `- **Launch date:** ${plan.readiness.launchDate} (${plan.readiness.daysToLaunch >= 0 ? `${plan.readiness.daysToLaunch} days away` : `${Math.abs(plan.readiness.daysToLaunch)} days ago`})`,
    );
  }
  push('');

  /* ------------------------------------------------------ who does what */
  push('## Who does what next');
  push('');
  push('Every seat has three actions pulled from the room. Change a task or clear a gate and this list changes with it.');
  push('');
  for (const lane of plan.lanes) {
    push(`### ${lane.label}${lane.members.length ? ` — ${lane.members.join(', ')}` : ' — unstaffed'}`);
    push('');
    push(`_${lane.headline}_`);
    push('');
    if (lane.unstaffed) {
      push('_Nobody holds this seat yet. Assign one of these to a person before the next stage gate._');
      push('');
    }
    if (!lane.actions.length) {
      push('- Nothing outstanding. Pick up the next unowned board task.');
    } else {
      for (const a of lane.actions.slice(0, 3)) push(`- **${a.title}** — ${a.why}`);
    }
    push('');
  }

  /* ---------------------------------------------- launch readiness + block */
  push('## Launch readiness');
  push('');
  push(`**${plan.readiness.score}%** of the criteria a launch depends on are met.`);
  push('');
  if (plan.readiness.launchable) {
    push('Every gate up to and including Launch is cleared. Ship, then work the Grow loop.');
  } else {
    push('| # | Stage | Still missing | Expected seat |');
    push('| --- | --- | --- | --- |');
    plan.readiness.blocking.forEach((b, i) => {
      push(`| ${i + 1} | ${b.stageName} | ${b.label} | ${ROLE_LABELS[b.owner] ?? b.owner} |`);
    });
  }
  push('');
  if (plan.board.unowned || plan.board.overdue) {
    push('### Board hygiene — fix before the next meeting');
    push('');
    if (plan.board.unowned) {
      push(`- **${plan.board.unowned} ${plan.board.unowned === 1 ? 'task has' : 'tasks have'} no owner.** Unowned work does not happen.`);
    }
    const late = plan.stages
      .flatMap((st) => tasks.filter((t) => t.stage_key === st.key && t.status !== 'done' && isOverdue(t.due_date) && t.due_date)
        .map((t) => ({ title: t.title, stage: st.name, due: t.due_date as string, owner: t.owner ?? 'unowned' })))
      .sort((a, b) => a.due.localeCompare(b.due));
    if (late.length) {
      push(`- **${late.length} ${late.length === 1 ? 'task is' : 'tasks are'} past ${late.length === 1 ? 'its' : 'their'} date.** Re-promise or cut ${late.length === 1 ? 'it' : 'them'}:`);
      push('');
      push('| Task | Stage | Due | Owner |');
      push('| --- | --- | --- | --- |');
      for (const t of late.slice(0, 12)) push(`| ${t.title} | ${t.stage} | ${shortDate(t.due)} | ${t.owner} |`);
      if (late.length > 12) push(`| _and ${late.length - 12} more_ | | | |`);
    }
    push('');
  }

  /* ------------------------------------------------------- where the work lives */
  const built = tasks.filter((t) => t.branch || t.pr_url || t.repo);
  if (built.length) {
    push('## Where the work lives');
    push('');
    push('Straight from the Build room: the repo, the branch and the pull request attached to each task.');
    push('');
    push('| Task | Repo | Branch | PR |');
    push('| --- | --- | --- | --- |');
    for (const t of built.slice(0, 40)) {
      push(`| ${t.title} | ${t.repo ? `\`${t.repo}\`` : '—'} | ${t.branch ? `\`${t.branch}\`` : '—'} | ${t.pr_url ? `[open](${t.pr_url})` : '—'} |`);
    }
    if (built.length > 40) push(`| _and ${built.length - 40} more_ | | | |`);
    push('');
  }

  /* ---------------------------------------------------------- stage by stage */
  push('## Stage by stage');
  push('');
  push('A stage is a gate, a board and a document set. Work the gate criteria in order; the board is how you get there.');
  push('');

  for (const stage of plan.stages) {
    const isCurrent = stage.key === project.stage_key;
    push(`### ${stage.position}. ${stage.name}${isCurrent ? ' · current' : ''} — ${stage.met}/${stage.total} gate criteria`);
    push('');
    push(stage.tagline);
    push('');
    push('| Criterion | State | Evidence | Seat |');
    push('| --- | --- | --- | --- |');
    for (const c of stage.criteria) {
      push(`| ${c.label} | ${c.met ? 'met' : c.manual ? 'confirm' : 'open'} | ${c.evidence} | ${ROLE_LABELS[c.owner] ?? c.owner} |`);
    }
    push('');

    const stageTasks = tasks.filter((t) => t.stage_key === stage.key);
    if (stageTasks.length) {
      push('**Board**');
      push('');
      push('| Done | Task | Owner | Priority | Due | Status | Where the work is |');
      push('| --- | --- | --- | --- | --- | --- | --- |');
      for (const t of stageTasks) {
        /* Branch and PR come from the Build room — the pack should point at the code. */
        const work = [
          t.repo ? `\`${t.repo}\`` : '',
          t.branch ? `\`${t.branch}\`` : '',
          t.pr_url ? `[PR](${t.pr_url})` : '',
        ]
          .filter(Boolean)
          .join(' ');
        push(
          `| ${t.status === 'done' ? 'x' : ''} | ${t.title} | ${t.owner ?? '_unowned_'} | ${t.priority} | ${t.due_date ? shortDate(t.due_date) : '—'} | ${t.status} | ${work || '—'} |`,
        );
      }
      push('');
    }

    const docs = docsFor(stage.key);
    if (docs.length) {
      push('**Documents in this stage**');
      push('');
      for (const d of docs) {
        push(`- **${d.title}** — ${d.status}${d.updated_by ? ` · last edited by ${d.updated_by}` : ''}`);
      }
      push('');
    }

    for (const a of docs) {
      push('');
      push('---');
      push('');
      push(a.content.trim());
      push('');
    }
  }

  /* ------------------------------------------------------------- tool stack */
  const using = stacks.filter((s) => s.status !== 'parked');
  push('');
  push('---');
  push('');
  push('## Our tool stack');
  push('');
  if (!using.length) {
    push('No tool has been marked yet. Open the room → Tools, set what the team actually uses, paste the workspace link.');
    push('Every tool on the wall has a free tier.');
  } else {
    push('| Tool | Status | Our workspace | Note | Updated by |');
    push('| --- | --- | --- | --- | --- |');
    for (const s of using) {
      const t = toolById.get(s.tool_id);
      push(
        `| ${t?.name ?? s.tool_id} | ${s.status} | ${s.our_url || '—'} | ${(s.note || '—').replace(/\|/g, '/')} | ${s.updated_by ?? '—'} |`,
      );
    }
  }
  push('');

  /* ------------------------------------------------------------- appendix */
  push('## Appendix A — decisions and signals from the room');
  push('');
  const decisions = signals.filter((s) => s.type === 'decision' && s.status === 'accepted');
  const others = signals.filter((s) => s.type !== 'decision' && s.status === 'accepted');
  if (decisions.length) {
    push('**Decisions taken**');
    push('');
    for (const s of decisions) push(`- ${s.label}`);
    push('');
  }
  if (others.length) {
    push('**Accepted signals** (pains, users, evidence, risks)');
    push('');
    for (const s of others.slice(0, 24)) push(`- *${s.type}* (${s.score}) — ${s.label}`);
    push('');
  }

  const openQuestions = signals.filter((s) => s.type === 'question' && s.status === 'open');
  if (openQuestions.length || problem?.unknowns?.length) {
    push('## Appendix B — open questions');
    push('');
    for (const q of problem?.unknowns ?? []) push(`- ${q}`);
    for (const q of openQuestions) push(`- ${q.label}`);
    push('');
  }

  push('## Appendix C — the operating rhythm');
  push('');
  push('| When | What | Who |');
  push('| --- | --- | --- |');
  for (const r of plan.rhythm) push(`| ${r.when} | ${r.what} | ${r.who} |`);
  push('');
  push('---');
  push('');
  push('_Exported from One Stop Pro Manager. Gates, owners and due dates are live in the room — export again after the next working session._');
  push('');

  return new Response(L.join('\n'), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${project.code}-launch-pack.md"`,
      'cache-control': 'no-store',
    },
  });
}
