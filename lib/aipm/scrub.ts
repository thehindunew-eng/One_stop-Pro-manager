/*
 * The privacy gate.
 *
 * Everything the guards feed a model passes through here first. Two jobs:
 *  1. remove anything that looks like a credential, even if a human pasted it
 *     into a work-log note by mistake;
 *  2. honour the `@aipm-ignore` directive, so a developer can keep a block of
 *     context out of the model's view from inside the code or a note.
 */

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'github_pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{12,}\b/g },
  { name: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'google_key', re: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { name: 'groq_key', re: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { name: 'figma_token', re: /\bfigd_[A-Za-z0-9_-]{15,}\b/g },
  { name: 'postgres_url', re: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g },
  { name: 'bearer', re: /\bbearer\s+[A-Za-z0-9._-]{16,}/gi },
  {
    name: 'env_assignment',
    re: /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSCODE|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S+/g,
  },
];

export interface Scrubbed {
  text: string;
  removed: string[];
}

/** Strip credentials and ignored blocks. `removed` names what was taken out, never the values. */
export function scrub(input: string): Scrubbed {
  const removed: string[] = [];
  let text = String(input ?? '');

  /* @aipm-ignore blocks, in any comment syntax: // # -- /* <!-- -- as long as the marker appears. */
  const ignoreBlock = /@aipm-ignore\b[\s\S]*?@aipm-ignore-end/g;
  const blocks = text.match(ignoreBlock);
  if (blocks?.length) {
    text = text.replace(ignoreBlock, '[redacted by @aipm-ignore]');
    removed.push(`${blocks.length} @aipm-ignore block${blocks.length === 1 ? '' : 's'}`);
  }
  /* A bare marker with no end tag hides its own line, never the rest of the text. */
  if (text.includes('@aipm-ignore')) {
    const before = text;
    text = text
      .split('\n')
      .map((line) => (line.includes('@aipm-ignore') ? '[redacted by @aipm-ignore]' : line))
      .join('\n');
    if (before !== text) removed.push('@aipm-ignore line');
  }

  for (const { name, re } of SECRET_PATTERNS) {
    const before = text;
    text = text.replace(re, `[redacted ${name}]`);
    if (before !== text) removed.push(name);
  }

  return { text, removed };
}

/** Convenience for structured slices: scrub every string, keep the shape. */
export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrub(value).text as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubDeep(v);
    return out as T;
  }
  return value;
}

/** True when a string would have leaked something — used by tests and the run log. */
export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
