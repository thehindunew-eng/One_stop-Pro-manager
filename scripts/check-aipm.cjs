#!/usr/bin/env node
/*
 * Checks the AI PM's privacy rules without a database or a model.
 *
 *   node scripts/check-aipm.cjs
 *
 * This is the one part of the guard that must never regress: if a credential
 * shape or an @aipm-ignore block leaks into the context slice, every other
 * property of the feature is worthless. The file is compiled with tsc first,
 * then the scrubber is exercised directly.
 */

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'node_modules', '.cache', 'aipm-check');

fs.mkdirSync(out, { recursive: true });
execFileSync(
  path.join(root, 'node_modules', '.bin', 'tsc'),
  [
    path.join(root, 'lib', 'aipm', 'scrub.ts'),
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' },
);

/* tsc decides where to put the file based on the inferred rootDir, so find it rather than assume. */
const compiled = (function find(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = find(full);
      if (hit) return hit;
    } else if (entry.name === 'scrub.js') {
      return full;
    }
  }
  return null;
})(out);
if (!compiled) {
  console.error('tsc did not emit scrub.js — run `npm install` first.');
  process.exit(1);
}
const { scrub, containsSecret } = require(compiled);

let failures = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

console.log('[aipm] privacy checks');

const samples = [
  'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  'github_pat_11ABCDEFG0123456789_abcdefghijklmnop',
  'sk-abcdefghijklmnopqrstuvwxyz0123456789',
  'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
  'AIzaSyA1234567890abcdefghijklmnopqrstuv',
  'gsk_abcdefghijklmnopqrstuvwxyz0123456789',
  'figd_abcdefghijklmnopqrstuvwxyz',
  'postgresql://user:pass@ep-cool-1234.eu-central-1.aws.neon.tech/db?sslmode=require',
  'DATABASE_URL=postgres://u:p@h/db',
  'GITHUB_TOKEN=abc123',
  'authorization: bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghij',
];

for (const sample of samples) {
  const { text } = scrub(`prefix ${sample} suffix`);
  check(
    `scrubs ${sample.slice(0, 22)}…`,
    !containsSecret(text) && !text.includes(sample),
    `left: ${text.slice(0, 80)}`,
  );
}

const block = 'before\n// @aipm-ignore\nconst key = "live-value";\n// @aipm-ignore-end\nafter';
const blockOut = scrub(block);
check('removes an @aipm-ignore block', !blockOut.text.includes('live-value') && blockOut.text.includes('after'));
check('reports what it removed', blockOut.removed.some((r) => r.includes('@aipm-ignore')));

const lineOut = scrub('keep this\n# @aipm-ignore internal note\nkeep that');
check('removes an @aipm-ignore line only', !lineOut.text.includes('internal note') && lineOut.text.includes('keep that'));

const clean = 'Refactor the refresh handler in src/auth/refresh.ts and add a test.';
const cleanOut = scrub(clean);
check('leaves ordinary prose alone', cleanOut.text === clean && cleanOut.removed.length === 0);

console.log(failures ? `\n${failures} check(s) failed` : '\nall privacy checks passed');
process.exit(failures ? 1 : 0);
