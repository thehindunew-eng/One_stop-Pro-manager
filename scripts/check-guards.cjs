#!/usr/bin/env node
/*
 * Guard behaviour checks — no database, no model, no network.
 *
 *   node scripts/check-guards.cjs
 *
 * Builds a synthetic room where four things are true at once (a shared file
 * between two owners, a hard-coded value the spec says must be configurable, a
 * stalled task, and later-stage work behind an open gate) and asserts each
 * guard finds its own thing and nothing else. This is the contract: if a guard
 * silently stops firing, this script fails.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'node_modules', '.cache', 'aipm-guards');
fs.mkdirSync(out, { recursive: true });

execFileSync(
  path.join(root, 'node_modules', '.bin', 'tsc'),
  [
    path.join(root, 'lib', 'aipm', 'guards.ts'),
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' },
);

const { overlapGuard, specGuard, velocityGuard, gateGuard, narrative } = require(path.join(out, 'aipm', 'guards.js'));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const day = 86_400_000;
const at = Date.parse('2026-10-26T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

const ctx = {
  project: { code: 'studio', name: 'Checkout', stage: 'discover', stageName: 'Discover' },
  problem: null,
  gates: [{ key: 'discover', name: 'Discover', met: 1, total: 5, open: ['Three user interviews happened', 'Sign-off'] }],
  tasks: [
    {
      id: 't1', title: 'Refresh handler', owner: 'Priya', status: 'doing', priority: 'P1',
      due: '2026-10-10', stage: 'Discover', repo: 'acme/web', branch: null, pr: null,
    },
    {
      id: 't2', title: 'Session endpoint', owner: 'Rohan', status: 'doing', priority: 'P1',
      due: null, stage: 'Discover', repo: 'acme/web', branch: null, pr: null,
    },
    {
      id: 't3', title: 'Ship the pricing page', owner: 'Kabir', status: 'doing', priority: 'P2',
      due: null, stage: 'Launch', repo: null, branch: null, pr: null,
    },
  ],
  notes: [
    {
      task_id: 't1', task: 'Refresh handler', author: 'Priya', kind: 'note',
      content: 'Wired the flows into src/auth/refresh.ts. Waiting on the endpoint from Rohan.',
      at: iso(at - 2 * day),
    },
    {
      task_id: 't2', task: 'Session endpoint', author: 'Rohan', kind: 'note',
      content: 'Refactored src/auth/refresh.ts; hardcoded the 15 minute timeout for now.',
      at: iso(at - 60 * day),
    },
  ],
  docs: [
    {
      kind: 'mvp_scope', title: 'MVP Scope', stage: 'Define', status: 'ready',
      requirements: ['The session timeout must be configurable per workspace for enterprise accounts.'],
    },
  ],
  commits: [],
  members: [
    { name: 'Priya', role: 'design', last_seen: iso(at), online: true },
    { name: 'Rohan', role: 'eng', last_seen: iso(at), online: true },
    { name: 'Kabir', role: 'growth', last_seen: iso(at), online: true },
  ],
  decisions: [],
  generatedAt: iso(at),
  gaps: ['No repository telemetry in this check.'],
};

console.log('[aipm] guard checks');

const velocity = velocityGuard(ctx, at);
check('velocity finds the late task', velocity.some((f) => f.kind === 'VELOCITY' && f.task_id === 't1' && /past its date/.test(f.message)));
check('velocity finds the stalled task', velocity.some((f) => f.task_id === 't2' && /no work-log entry/.test(f.message)));
check(
  'velocity names the person being waited on',
  velocity.some((f) => /waiting/i.test(f.message) && f.target === 'Rohan'),
  velocity.map((f) => f.target).join(','),
);

const overlap = overlapGuard(ctx);
check('overlap finds the shared file', overlap.length >= 2 && overlap.every((f) => f.kind === 'CONFLICT'));
check(
  'overlap cites the file, not a line number',
  overlap.some((f) => f.citations.some((c) => c.ref === 'src/auth/refresh.ts')),
);

const spec = specGuard(ctx);
check(
  'spec catches the hard-coded timeout against the document',
  spec.some((f) => f.kind === 'DEVIATION' && f.citations.some((c) => c.source === 'doc' && c.ref.startsWith('mvp_scope'))),
  spec.map((f) => f.message).join(' | '),
);

const gate = gateGuard(ctx);
check('gate finds work running ahead', gate.some((f) => f.kind === 'GATE' && /Launch/.test(f.citations.map((c) => c.detail).join(' '))));

check('every finding has a citation', [...velocity, ...overlap, ...spec, ...gate].every((f) => f.citations.length > 0));
check('every confidence is in range', [...velocity, ...overlap, ...spec, ...gate].every((f) => f.confidence >= 0 && f.confidence <= 1));

const text = narrative(ctx, [...velocity, ...overlap, ...spec, ...gate]);
check('the narrative names the gaps', text.includes('could not see'));

/* A clean room must produce nothing — guards that always fire are noise. */
const calm = {
  ...ctx,
  tasks: [{ id: 't9', title: 'Write the brief', owner: 'Priya', status: 'doing', priority: 'P1', due: '2026-11-10', stage: 'Discover', repo: null, branch: null, pr: null }],
  notes: [{ task_id: 't9', task: 'Write the brief', author: 'Priya', kind: 'note', content: 'Drafted the outline.', at: iso(at - 3_600_000) }],
  gates: [{ key: 'discover', name: 'Discover', met: 5, total: 5, open: [] }],
};
const calmCount =
  velocityGuard(calm, at).length + overlapGuard(calm).length + specGuard(calm).length + gateGuard(calm).length;
check('a clean room produces no findings', calmCount === 0, `${calmCount} produced`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall guard checks passed');
process.exit(failures ? 1 : 0);
