import type { GuardContext, SliceNote } from './context';

/*
 * The four guards, run locally before any model is asked anything.
 *
 * Why deterministic first: a guard that needs a network call to notice a task
 * is twelve days late is a guard that stops working the moment the key runs
 * out. These produce cited findings from room data alone. The model is then
 * asked only to catch what arithmetic cannot (see ./index.ts).
 */

export type FindingKind = 'CONFLICT' | 'DEVIATION' | 'SUGGESTION' | 'GATE' | 'VELOCITY';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Citation {
  source: 'doc' | 'task' | 'commit' | 'note' | 'gate';
  ref: string;
  detail: string;
}

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  target: string;
  task_id: string | null;
  message: string;
  suggested_action: string;
  confidence: number;
  citations: Citation[];
  /** Stable id for de-duplication across runs. */
  fingerprint: string;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function fingerprintOf(kind: string, taskId: string | null, refs: string[]): string {
  return hash(`${kind}|${taskId ?? '-'}|${refs.slice().sort().join(',')}`);
}

function make(input: Omit<Finding, 'fingerprint'>): Finding {
  return {
    ...input,
    confidence: Math.max(0, Math.min(1, Math.round(input.confidence * 100) / 100)),
    fingerprint: fingerprintOf(input.kind, input.task_id, input.citations.map((c) => c.ref)),
  };
}

const daysBetween = (iso: string, at: number) => Math.round((at - Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`)) / DAY);

/** Phrases that mean someone is waiting on someone else. */
const DEPENDENCY = /\b(waiting (?:on|for)|blocked by|blocked on|needs? .{0,24}from|depends on|waiting for the)\b/i;

/** A hard-coded thing, and what it is: "hardcoded the 15 minute timeout for now" → [minute, timeout]. */
const HARDCODE_OBJECT = /hard-?cod\w*\s+(?:the\s+|a\s+|an\s+)?([^.;]{3,60})/i;

/** A requirement that says the same thing must be adjustable rather than fixed. */
const MUST_BE_DYNAMIC = /(configur\w*|dynamic\w*|environment variable|setting|per[- ]workspace|parameter|admin\w* (?:can|should)|must be able to change)/i;

const STOP = new Set(['the', 'for', 'now', 'with', 'that', 'this', 'and', 'from', 'into', 'because', 'before', 'after']);

function tokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w)),
    ),
  ];
}

/** Crude stemming — enough to match "refactor/refactored/refactoring". */
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');

/** Language that usually means the work contradicts a written requirement. */
const DEVIATION_WORDS = /\b(hard-?cod\w*|skip(ping)? (?:the )?validation|no validation|bypass\w*|stub\w*|for now|temporar\w*|fake data|mock(?:ed)? (?:the )?(?:api|endpoint))\b/i;

const FILE = /\b[\w./-]+\.(?:tsx?|jsx?|sql|prisma|py|go|rb|java|json|ya?ml)\b/g;

function filesIn(text: string): string[] {
  return [...new Set((text.match(FILE) ?? []).map((f) => f.toLowerCase()))];
}

function notesFor(ctx: GuardContext, taskId: string): SliceNote[] {
  return ctx.notes.filter((n) => n.task_id === taskId);
}

/** The newest activity we can see for a task — its newest note, if any. */
function quietHours(ctx: GuardContext, taskId: string, at: number): number | null {
  const own = notesFor(ctx, taskId);
  if (!own.length) return null;
  const newest = own.reduce((max, n) => Math.max(max, Date.parse(n.at)), 0);
  return Math.round((at - newest) / HOUR);
}

/* ------------------------------------------------------------------ */
/* A. velocity                                                        */
/* ------------------------------------------------------------------ */

export function velocityGuard(ctx: GuardContext, at = Date.now()): Finding[] {
  const out: Finding[] = [];

  for (const task of ctx.tasks) {
    if (task.status === 'todo' || task.status === 'done') continue;

    /* Positive means the promise has passed. A future date must never be "late". */
    const late = task.due ? daysBetween(task.due, at) : null;
    const quiet = quietHours(ctx, task.id, at);
    const taskCitation: Citation = { source: 'task', ref: task.id, detail: `“${task.title}” · ${task.status}` };

    if (late !== null && late > 0) {
      out.push(
        make({
          kind: 'VELOCITY',
          severity: late >= 3 ? 'HIGH' : 'MEDIUM',
          target: task.owner ?? 'unassigned',
          task_id: task.id,
          message: `“${task.title}” is ${late} day${late === 1 ? '' : 's'} past its date and still ${task.status}. Nothing on the board suggests it moved.`,
          suggested_action: `Either re-promise this with a real date or cut it — a task that is late and quiet is not in progress.`,
          confidence: 0.92,
          citations: [taskCitation, { source: 'task', ref: `${task.id}:due`, detail: `due ${task.due}` }],
        }),
      );
    } else if (task.status === 'doing' && quiet !== null && quiet >= 48) {
      out.push(
        make({
          kind: 'VELOCITY',
          severity: quiet >= 96 ? 'HIGH' : 'MEDIUM',
          target: task.owner ?? 'unassigned',
          task_id: task.id,
          message: `“${task.title}” has been in progress with no work-log entry for ${Math.round(quiet / 24)} days.`,
          suggested_action: 'Ask for one line in the work log: what is done, what is next, what is in the way.',
          confidence: 0.78,
          citations: [taskCitation, { source: 'note', ref: `${task.id}:quiet`, detail: `${Math.round(quiet / 24)}d without an entry` }],
        }),
      );
    } else if (task.status === 'doing' && quiet === null) {
      out.push(
        make({
          kind: 'VELOCITY',
          severity: 'LOW',
          target: task.owner ?? 'unassigned',
          task_id: task.id,
          message: `“${task.title}” is marked in progress but has never been written up — there is no evidence it started.`,
          suggested_action: 'Log the first entry, or put it back to To do so the board tells the truth.',
          confidence: 0.6,
          citations: [taskCitation],
        }),
      );
    }

    /* Dependency language names the person being waited on. */
    for (const note of notesFor(ctx, task.id)) {
      const phrase = note.content.match(DEPENDENCY)?.[0];
      if (!phrase) continue;
      const others = ctx.members.filter((m) => m.name !== note.author).map((m) => m.name);
      const named = others.find((n) => note.content.toLowerCase().includes(n.toLowerCase()));
      out.push(
        make({
          kind: 'VELOCITY',
          severity: 'MEDIUM',
          target: named ?? task.owner ?? note.author,
          task_id: task.id,
          message: `${note.author} is waiting: “${note.content.slice(0, 120)}”. ${
            named ? `${named} is the name in that note.` : 'Nobody is named, so nobody is unblocking it.'
          }`,
          suggested_action: named
            ? `Ask ${named} for the smallest thing that unblocks this, in writing, today.`
            : 'Name the person and the exact thing being waited on in the note.',
          confidence: named ? 0.82 : 0.66,
          citations: [
            { source: 'note', ref: `${task.id}:${note.at}`, detail: `“${phrase}” — ${note.author}` },
            taskCitation,
          ],
        }),
      );
      break;
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* B. overlap                                                         */
/* ------------------------------------------------------------------ */

export function overlapGuard(ctx: GuardContext): Finding[] {
  const out: Finding[] = [];
  const open = ctx.tasks.filter((t) => t.status !== 'done');

  /* What each open task appears to touch: files named in its notes, its branch. */
  const touched = new Map<string, Set<string>>();
  for (const task of open) {
    const set = new Set<string>();
    for (const note of notesFor(ctx, task.id)) for (const f of filesIn(note.content)) set.add(f);
    if (task.branch) {
      const parts = task.branch.split('/').filter(Boolean);
      if (parts.length >= 2) set.add(`branch:${parts[0]}/${parts[1].split('-')[0]}`);
    }
    touched.set(task.id, set);
  }

  /* Commit files, when the repository is readable, count for the branch they are on. */
  for (const commit of ctx.commits) {
    for (const file of commit.files ?? []) {
      for (const task of open) {
        if (task.branch && task.branch === commit.short) continue;
        touched.get(task.id)?.add(file.toLowerCase());
      }
    }
  }

  const pairs: [string, string][] = [];
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const a = open[i];
      const b = open[j];
      if (!a.owner || !b.owner || a.owner === b.owner) continue;
      const shared = [...(touched.get(a.id) ?? [])].filter((x) => touched.get(b.id)?.has(x));
      if (shared.length) pairs.push([a.id, b.id]);
    }
  }

  for (const [aId, bId] of pairs) {
    const a = open.find((t) => t.id === aId)!;
    const b = open.find((t) => t.id === bId)!;
    const shared = [...(touched.get(a.id) ?? [])].filter((x) => touched.get(b.id)?.has(x));
    const shown = shared.filter((s) => !s.startsWith('branch:')).slice(0, 3);
    const branchOnly = shown.length === 0;
    for (const [one, two] of [
      [a, b],
      [b, a],
    ] as const) {
      out.push(
        make({
          kind: 'CONFLICT',
          severity: branchOnly ? 'LOW' : 'HIGH',
          target: one.owner ?? one.owner!,
          task_id: one.id,
          message: `Your task and ${two.owner}'s “${two.title}” both touch ${
            branchOnly ? `the same feature area (${shared.join(', ')})` : shown.map((s) => `\`${s}\``).join(', ')
          }. Two people editing the same surface without agreeing the shape is how a merge becomes a rewrite.`,
          suggested_action: branchOnly
            ? `Check with ${two.owner} before either branch grows: whose version of this area wins?`
            : `Agree the interface for \`${shown[0]}\` with ${two.owner} before either of you writes more code.`,
          confidence: branchOnly ? 0.55 : 0.72,
          citations: [
            { source: 'task', ref: one.id, detail: `“${one.title}”` },
            { source: 'task', ref: two.id, detail: `“${two.title}” — ${two.owner}` },
            ...(branchOnly
              ? [{ source: 'task' as const, ref: `${two.id}:branch`, detail: two.branch ?? 'branch prefix' }]
              : shown.map((s) => ({ source: 'note' as const, ref: s, detail: 'named in both task logs' }))),
          ],
        }),
      );
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* C. spec                                                            */
/* ------------------------------------------------------------------ */

export function specGuard(ctx: GuardContext): Finding[] {
  const out: Finding[] = [];

  /* Statements that usually contradict a written requirement. */
  const statements: { text: string; taskId: string | null; author: string; ref: string; source: 'note' | 'commit' }[] = [];
  for (const note of ctx.notes) {
    if (DEVIATION_WORDS.test(note.content)) {
      statements.push({ text: note.content, taskId: note.task_id, author: note.author, ref: `${note.task_id}:${note.at}`, source: 'note' });
    }
  }
  for (const commit of ctx.commits) {
    if (DEVIATION_WORDS.test(commit.message)) {
      statements.push({ text: commit.message, taskId: null, author: commit.author ?? 'unknown', ref: commit.short, source: 'commit' });
    }
  }

  for (const statement of statements.slice(0, 6)) {
    const words = new Set(
      statement.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
    /* A requirement line that shares real vocabulary with the statement. */
    let best: { doc: GuardContext['docs'][number]; line: string; score: number } | null = null;
    for (const doc of ctx.docs) {
      for (const line of doc.requirements) {
        const lineWords = line.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4);
        const hits = lineWords.filter((w) => words.has(w) || words.has(stem(w))).length;
        if (hits >= 2 && (!best || hits > best.score)) best = { doc, line, score: hits };
      }
    }
    /*
     * The sharp case: "hardcoded the 15 minute timeout" against a document that
     * says the timeout must be configurable. One shared noun plus a must-be-
     * dynamic requirement is a real contradiction, not a vocabulary coincidence.
     */
    const hardcoded = statement.text.match(HARDCODE_OBJECT);
    if (hardcoded) {
      const object = tokens(hardcoded[1]);
      for (const doc of ctx.docs) {
        for (const line of doc.requirements) {
          if (!MUST_BE_DYNAMIC.test(line)) continue;
          const lineWords = tokens(line).map(stem);
          const hits = object.filter((w) => lineWords.includes(stem(w)));
          if (!hits.length) continue;
          if (!best || best.doc.status !== 'ready' || best.score < 3) {
            best = { doc, line, score: 3 + hits.length };
          }
          break;
        }
      }
    }

    if (!best) continue;
    if (best.doc.status !== 'ready' && best.score < 3) continue;

    const task = statement.taskId ? ctx.tasks.find((t) => t.id === statement.taskId) : null;
    out.push(
      make({
        kind: 'DEVIATION',
        severity: best.doc.status === 'ready' ? 'HIGH' : 'MEDIUM',
        target: task?.owner ?? statement.author,
        task_id: statement.taskId,
        message: `“${statement.text.slice(0, 130)}” reads against ${best.doc.title}: “${best.line.slice(0, 120)}”. The document is ${
          best.doc.status === 'ready' ? 'marked ready' : 'still a draft'
        }, so this is the room disagreeing with itself.`,
        suggested_action: `Decide which is true, then change the code or the document — and record the decision in ${best.doc.title}.`,
        confidence: best.doc.status === 'ready' ? 0.74 : 0.52,
        citations: [
          { source: 'doc', ref: `${best.doc.kind}#requirements`, detail: best.line.slice(0, 160) },
          { source: statement.source, ref: statement.ref, detail: statement.text.slice(0, 160) },
        ],
      }),
    );
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* D. gate                                                            */
/* ------------------------------------------------------------------ */

export function gateGuard(ctx: GuardContext): Finding[] {
  const out: Finding[] = [];
  const current = ctx.gates.find((g) => g.key === ctx.project.stage);
  if (!current || !current.open.length) return out;

  const ahead = ctx.tasks.filter((t) => t.stage !== ctx.project.stage && (t.status === 'doing' || t.status === 'review'));
  if (!ahead.length) return out;

  out.push(
    make({
      kind: 'GATE',
      severity: 'MEDIUM',
      target: 'the room',
      task_id: null,
      message: `${ctx.project.stageName} still has ${current.open.length} open exit ${
        current.open.length === 1 ? 'criterion' : 'criteria'
      } (“${current.open[0]}”), while ${ahead.length} task${ahead.length === 1 ? '' : 's'} ${ahead.length === 1 ? 'is' : 'are'} already moving in later stages.`,
      suggested_action: `Close “${current.open[0]}” first — it is the cheapest way to make everything after it honest.`,
      confidence: 0.85,
      citations: [
        { source: 'gate', ref: `${current.key}`, detail: `${current.met}/${current.total} met; open: ${current.open.join('; ')}` },
        ...ahead.slice(0, 3).map((t) => ({ source: 'task' as const, ref: t.id, detail: `“${t.title}” · ${t.stage} · ${t.status}` })),
      ],
    }),
  );

  return out;
}

/* ------------------------------------------------------------------ */
/* the PM narrative                                                   */
/* ------------------------------------------------------------------ */

export function narrative(ctx: GuardContext, findings: Finding[]): string {
  const counts = {
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
  };
  const gate = ctx.gates.find((g) => g.key === ctx.project.stage);
  const late = findings.filter((f) => f.kind === 'VELOCITY' && /past its date/.test(f.message));
  const blocked = findings.filter((f) => f.kind === 'VELOCITY' && /waiting|blocked/i.test(f.message));
  const conflicts = findings.filter((f) => f.kind === 'CONFLICT');
  const deviations = findings.filter((f) => f.kind === 'DEVIATION');

  const trajectory = [
    `${ctx.project.name} is in ${ctx.project.stageName}${gate ? ` with ${gate.met}/${gate.total} exit criteria met` : ''}.`,
    `${ctx.tasks.filter((t) => t.status !== 'done').length} tasks are open in the slice the guards can see, ${late.length} of them late.`,
    `${conflicts.length ? `${conflicts.length} overlap${conflicts.length === 1 ? '' : 's'}` : 'No overlaps'} and ${
      deviations.length ? `${deviations.length} spec deviation${deviations.length === 1 ? '' : 's'}` : 'no spec deviations'
    } stand between the room and its next gate.`,
  ].join(' ');

  const lines: string[] = [];
  lines.push(`## Governance digest`);
  lines.push('');
  lines.push(`_${trajectory}_`);
  lines.push('');
  lines.push(`**Findings:** ${counts.high} high · ${counts.medium} medium · ${counts.low} low.`);
  lines.push('');

  if (blocked.length) {
    lines.push('### Cross-team blockers');
    for (const b of blocked.slice(0, 5)) {
      lines.push(`- **${b.target}** — ${b.message} _(${Math.round(b.confidence * 100)}% confidence)_`);
    }
    lines.push('');
  }

  if (conflicts.length) {
    lines.push('### Where two people are touching one thing');
    for (const c of conflicts.slice(0, 4)) {
      lines.push(`- ${c.message}`);
    }
    lines.push('');
  }

  if (deviations.length) {
    lines.push('### Spec gaps');
    for (const d of deviations.slice(0, 4)) {
      lines.push(`- ${d.message}`);
    }
    lines.push('');
  }

  lines.push('### The one thing this week');
  const top = findings.slice().sort((a, b) => b.confidence - a.confidence)[0];
  lines.push(top ? `**${top.suggested_action}**` : '_Nothing is on fire. Pick the next gate criterion and clear it._');
  lines.push('');
  if (ctx.gaps.length) {
    lines.push(`_What these guards could not see: ${ctx.gaps.join(' ')}_`);
  }
  return lines.join('\n');
}
