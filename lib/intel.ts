import type { Message, ProblemStatement, Signal, SignalType } from './types';

/**
 * Local reasoning engine.
 *
 * This runs with no API key and no network. It reads the conversation the way a
 * product lead would: pull out pains, users, evidence, decisions, metrics,
 * unresolved questions, then assemble the actual problem question.
 * When an LLM key is configured (lib/ai.ts) the same shape is produced with
 * richer language and this engine becomes the fallback / sanity check.
 */

const STOP = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves also just really kinda gonna wanna lot lots thing things stuff like need needs needed want wants wanted make makes making get gets got go going use used using one two three maybe kind sort basically actually right now new good great big small many much people person team way day time work working well back even still first last thing every always never often sometimes something anything nothing everything user users product products build building built`.split(
    /\s+/,
  ),
);

const PAIN_CUES = [
  'problem', 'struggle', 'struggling', 'pain', 'painful', 'waste', 'wasting', 'manual', 'manually',
  'slow', 'slowly', 'hard', 'difficult', 'harder', 'cannot', "can't", 'unable', 'no way', 'friction',
  'expensive', 'error', 'errors', 'error-prone', 'confus', 'confusing', 'missing', 'lack', 'lacks',
  'fail', 'fails', 'failing', 'breaks', 'broke', 'broken', 'tedious', 'repetitive', 'chaos', 'messy',
  'scattered', 'siloed', 'silo', 'copy', 'paste', 'out of sync', 'disconnect', 'overwhelmed',
  'losing', 'lost', 'drop', 'churn', 'unclear', 'guess', 'guessing', 'bottleneck', 'blocked',
  'frustrat', 'annoying', 'inefficient', 'reinvent', 'duplicate', 'juggling', 'switching', 'context',
  'delay', 'delays', 'late', 'overrun', 'burn', 'burnout', 'rework', 'costly', 'worry', 'afraid',
  'stuck', 'drag', 'mess', 'nightmare', 'tedious', 'clunky', 'gap', 'inconsistent', 'no visibility',
];

const USER_CUES = [
  'user', 'users', 'customer', 'customers', 'team', 'teams', 'manager', 'managers', 'founder',
  'founders', 'developer', 'developers', 'engineer', 'engineers', 'designer', 'designers', 'pm',
  'pms', 'product manager', 'product managers', 'qa', 'clinics', 'clinic', 'patients', 'doctors',
  'students', 'teachers', 'schools', 'operators', 'admins', 'admin', 'freelancers', 'marketers',
  'sales', 'support', 'agents', 'owners', 'startups', 'smes', 'smb', 'creators', 'analysts',
  'recruiters', 'vendors', 'buyers', 'sellers', 'parents', 'farmers', 'drivers', 'staff', 'hr',
];

const EVIDENCE_CUES = [
  '%', 'percent', 'out of', 'we spoke', 'we interviewed', 'survey', 'surveyed', 'data shows',
  'according to', 'study', 'report', 'measured', 'we saw', 'we found', 'metric', 'hours', 'hrs',
  'minutes', 'times', 'per week', 'per month', 'per day', '$', '₹', '€', 'revenue', 'cost',
];

const IDEA_CUES = [
  'what if', 'we could', 'idea', 'ideas', 'imagine', 'feature', 'solution', 'let us', "let's build",
  'could build', 'build a', 'build an', 'platform', 'tool', 'dashboard', 'automate', 'automation',
  'copilot', 'assistant', 'agent', 'workflow', 'integrate', 'template', 'one place',
];

const DECISION_CUES = [
  'decided', 'decision', 'agreed', 'agree', 'final', 'finalize', 'going with', 'go with', 'we will',
  "we'll", 'approved', 'sign off', 'locked', 'lock', 'commit', 'ship it', 'scope', 'we are doing',
];

const BLOCKER_CUES = [
  'blocked', 'blocker', 'risk', 'concern', 'worried', 'dependency', 'waiting on', 'budget',
  'timeline', 'deadline', 'legal', 'compliance', 'privacy', 'security', 'scal', 'maintenance',
  'no time', 'capacity', 'expensive', 'hiring',
];

const METRIC_CUES = [
  'conversion', 'retention', 'churn', 'activation', 'signup', 'signups', 'nps', 'csat', 'revenue',
  'mrr', 'arr', 'mau', 'dau', 'wau', 'time to', 'time-to', 'drop-off', 'funnel', 'engagement',
  'adoption', 'ticket', 'resolution', 'response time', 'cost per', 'cac', 'ltv', 'completion',
  'bounce', 'page views', 'waitlist', 'growth',
];

const QUESTION_CUES = ['how', 'what', 'why', 'when', 'who', 'which', 'should', 'can', 'could', 'do we', 'is it'];

const PRODUCT_TYPES: { type: string; cues: string[] }[] = [
  { type: 'AI copilot / agent platform', cues: ['ai', 'agent', 'copilot', 'llm', 'model', 'intelligent', 'automate', 'assistant', 'prompt', 'gpt'] },
  { type: 'Collaboration workspace', cues: ['meeting', 'collaborate', 'team', 'workspace', 'discussion', 'conversation', 'chat', 'standup', 'review'] },
  { type: 'Marketplace', cues: ['marketplace', 'buyers', 'sellers', 'vendors', 'match', 'supply', 'demand', 'listing', 'gig'] },
  { type: 'Developer tool', cues: ['developer', 'api', 'sdk', 'deploy', 'code', 'devops', 'git', 'infra', 'engineering'] },
  { type: 'Mobile app', cues: ['mobile', 'android', 'ios', 'app store', 'on the go', 'phone'] },
  { type: 'Internal ops tool', cues: ['internal', 'ops', 'operations', 'back office', 'admin panel', 'dashboard', 'logistics'] },
  { type: 'Health product', cues: ['patient', 'doctor', 'clinic', 'health', 'hospital', 'diagnos', 'medic', 'pharma'] },
  { type: 'Education product', cues: ['student', 'teacher', 'school', 'course', 'learning', 'exam', 'education', 'tutor'] },
  { type: 'Fintech product', cues: ['payment', 'invoice', 'loan', 'bank', 'finance', 'billing', 'accounting', 'tax', 'upi'] },
  { type: 'Commerce / D2C', cues: ['commerce', 'store', 'shop', 'order', 'cart', 'retail', 'brand', 'product page'] },
  { type: 'Community platform', cues: ['community', 'forum', 'network', 'social', 'members', 'discussion board'] },
];

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clean)
    .filter((s) => s.length > 11);
}

const used = (s: string, cues: string[]) => {
  const low = s.toLowerCase();
  return cues.some((c) => low.includes(c));
};

const countCues = (s: string, cues: string[]) => {
  const low = s.toLowerCase();
  return cues.reduce((n, c) => (low.includes(c) ? n + 1 : n), 0);
};

const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

function keywords(messages: Message[], limit = 14): string[] {
  const freq = new Map<string, number>();
  for (const m of messages) {
    for (const t of tokens(m.content)) {
      const key = t.replace(/'s$/, '');
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  const JUNK = new Set(['side', 'nobody', 'written', 'everyone', 'someone', 'anyone', 'today', 'week', 'month', 'day', 'lot', 'really', 'actually', 'maybe', 'whole', 'least', 'never', 'always', 'okay', 'yeah', 'right', 'sure', 'kind', 'sort', 'guess', 'guessing', 'thing', 'things', 'stuff', 'lot', 'lets', 'dont', 'doesnt', 'isnt', 'wont', 'cant', 'that\'s', 'it\'s']);
  return [...freq.entries()]
    .filter(([w, n]) => n >= 2 && !JUNK.has(w) && w.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function phraseFor(messages: Message[], limit = 8): string[] {
  const pairs = new Map<string, number>();
  for (const m of messages) {
    const toks = tokens(m.content);
    for (let i = 0; i < toks.length - 1; i++) {
      const p = `${toks[i]} ${toks[i + 1]}`;
      pairs.set(p, (pairs.get(p) ?? 0) + 1);
    }
  }
  return [...pairs.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([p]) => p);
}

function shorten(s: string, max = 108): string {
  const t = clean(s).replace(/^(and|but|so|because|also)\s+/i, '');
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' — '), slice.lastIndexOf('; '));
  if (cut > max * 0.55) return slice.slice(0, cut).trimEnd();
  const space = slice.lastIndexOf(' ');
  return `${slice.slice(0, space > 0 ? space : max).trimEnd()}…`;
}

/** cut a sentence at a clause boundary, without an ellipsis inside the problem question */
export function clause(s: string, max = 170): string {
  const t = clean(s).replace(/\.$/, '');
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' — '), slice.lastIndexOf('; '), slice.lastIndexOf(' and '));
  if (cut > max * 0.5) return slice.slice(0, cut).trimEnd();
  const space = slice.lastIndexOf(' ');
  return slice.slice(0, space > 0 ? space : max).trimEnd();
}

const AUDIENCE_TERMS = [
  'product teams', 'product team', 'product managers', 'product manager', 'pms', 'founders', 'founder',
  'engineering teams', 'engineers', 'engineer', 'developers', 'developer', 'designers', 'designer',
  'qa teams', 'qa', 'marketers', 'sales teams', 'support teams', 'community managers', 'operators',
  'admins', 'analysts', 'recruiters', 'freelancers', 'freelancer', 'agencies', 'startups', 'startup',
  'small businesses', 'smes', 'smb', 'clinics', 'clinic', 'doctors', 'patients', 'nurses', 'students',
  'teachers', 'schools', 'parents', 'farmers', 'drivers', 'staff', 'hr teams', 'creators', 'buyers',
  'sellers', 'vendors', 'enterprises', 'teams', 'users', 'customers',
];

function audienceTerms(text: string): string[] {
  const low = ` ${text.toLowerCase()} `;
  const found = AUDIENCE_TERMS.filter((t) => low.includes(` ${t} `) || low.includes(` ${t},`) || low.includes(` ${t}.`));
  // prefer specific terms over the generic ones
  const specific = found.filter((t) => !['teams', 'users', 'customers'].includes(t));
  const list = specific.length ? specific : found;
  const dedup: string[] = [];
  for (const t of list) {
    if (dedup.some((d) => d.includes(t) || t.includes(d))) continue;
    dedup.push(t);
  }
  return dedup.slice(0, 4);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function detectProductType(text: string): string {
  const low = text.toLowerCase();
  let best = { type: 'Web app / SaaS', score: 0 };
  for (const pt of PRODUCT_TYPES) {
    const score = pt.cues.reduce((n, c) => (low.includes(c) ? n + 1 : n), 0);
    if (score > best.score) best = { type: pt.type, score };
  }
  return best.type;
}

interface Candidate {
  type: SignalType;
  label: string;
  detail: string;
  score: number;
  evidence: { author: string; content: string; at: string }[];
}

/** Pull structured signals (pains, users, evidence, ideas, decisions…) out of raw messages. */
export function extractSignals(messages: Message[]): Omit<Signal, 'id' | 'project_id' | 'created_at'>[] {
  const candidates: Candidate[] = [];

  for (const m of messages) {
    if (m.kind === 'system') continue;
    const content = m.content.trim();
    if (!content) continue;
    const author = m.author || 'Teammate';
    const at = m.created_at;
    const evidence = [{ author, content: shorten(content, 220), at }];

    if (m.kind === 'idea') {
      candidates.push({ type: 'idea', label: shorten(content, 96), detail: m.kind, score: 62, evidence });
      continue;
    }
    if (m.kind === 'decision') {
      candidates.push({ type: 'decision', label: shorten(content, 96), detail: 'explicit decision', score: 88, evidence });
      continue;
    }
    if (m.kind === 'question') {
      candidates.push({ type: 'question', label: shorten(content, 96), detail: 'open question', score: 55, evidence });
      continue;
    }

    for (const raw of sentences(content)) {
      const s = clean(raw);
      const painHits = countCues(s, PAIN_CUES);
      const userHits = countCues(s, USER_CUES);
      const evHits = countCues(s, EVIDENCE_CUES);
      const idHits = countCues(s, IDEA_CUES);
      const decHits = countCues(s, DECISION_CUES);
      const blkHits = countCues(s, BLOCKER_CUES);
      const metHits = countCues(s, METRIC_CUES);

      const push = (type: SignalType, base: number) => {
        const score = Math.min(98, base + painHits * 7 + evHits * 6 + Math.min(12, s.length / 22));
        candidates.push({
          type,
          label: shorten(s, type === 'pain' ? 96 : 92),
          detail: s.length > 400 ? shorten(s, 400) : s,
          score: Math.round(score),
          evidence,
        });
      };

      const ideaLike = idHits > 0 || decHits > 0 || /^(idea|what if|we could|let's|imagine|decision)\b/i.test(s);
      if (painHits > 0 && (!ideaLike || painHits >= 2)) push('pain', ideaLike ? 38 : 50);
      const explicitDecision = /^(decision|decided|agreed|we decided|we agree|let's|we'll|final:|scope:|locked)/i.test(s);
      if (decHits > 0 && (explicitDecision || painHits === 0)) push('decision', explicitDecision ? 78 : 54);
      const strongMetric = METRIC_CUES.some((c) => ['conversion', 'retention', 'churn', 'activation', 'nps', 'revenue', 'mrr', 'arr', 'mau', 'dau', 'funnel', 'adoption', 'cac', 'ltv', 'completion', 'drop-off'].includes(c) && s.toLowerCase().includes(c));
      if ((metHits > 0 && strongMetric) || /\d+\s*%/.test(s)) push('metric', 58);
      if (blkHits > 0 && painHits === 0) push('blocker', 50);
      if (idHits > 0 && painHits === 0) push('idea', 44);
      if (userHits > 0 && painHits > 0) push('user', 34);
      if (evHits >= 2 || /\d+\s*(%|hours?|hrs?|minutes?|days?|weeks?)/i.test(s)) push('evidence', 66);
      if (s.endsWith('?') && countCues(s, QUESTION_CUES) > 0 && s.length > 28) push('question', 42);
    }
  }

  // merge near-duplicates keeping the highest score and combined evidence
  const merged: Candidate[] = [];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const dup = merged.find((m) => m.type === c.type && jaccard(m.label, c.label) > 0.62);
    if (dup) {
      for (const e of c.evidence) {
        if (dup.evidence.length < 4 && !dup.evidence.some((x) => x.content === e.content)) dup.evidence.push(e);
      }
      dup.score = Math.min(99, Math.max(dup.score, c.score) + 2);
    } else {
      merged.push({ ...c });
    }
  }

  const cap: Record<SignalType, number> = {
    pain: 8, user: 4, evidence: 5, idea: 6, decision: 4, blocker: 4, metric: 4, question: 4,
  };
  const counts: Record<string, number> = {};
  const out: Omit<Signal, 'id' | 'project_id' | 'created_at'>[] = [];
  for (const m of merged) {
    counts[m.type] = (counts[m.type] ?? 0) + 1;
    if (counts[m.type] > cap[m.type]) continue;
    out.push({ type: m.type, label: m.label, detail: m.detail, score: m.score, status: 'open', evidence: m.evidence });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

const uniq = (arr: string[]) => [...new Set(arr.map((s) => clean(s)).filter(Boolean))];

function toMetric(label: string): string | null {
  const low = label.toLowerCase();
  if (low.includes('retention')) return 'Week-4 retention of activated teams';
  if (low.includes('churn')) return 'Churn rate on the free tier, month over month';
  if (low.includes('time')) return 'Median time from problem statement to first deploy';
  if (low.includes('conversion')) return 'Landing page visit → waitlist conversion';
  if (low.includes('adoption')) return 'Weekly active teammates per project';
  if (low.includes('activation')) return 'Activation: problem approved → roadmap generated';
  if (low.includes('revenue') || low.includes('mrr')) return 'First 10 paying teams';
  if (low.includes('nps')) return 'NPS after the first shipped release';
  return null;
}

function audienceFrom(messages: Message[], signals: Omit<Signal, 'id' | 'project_id' | 'created_at'>[]): string {
  const text = messages.map((m) => m.content).join(' ').toLowerCase();
  const found: string[] = [];
  for (const cue of USER_CUES) {
    if (new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) found.push(cue);
  }
  const userSignals = signals.filter((s) => s.type === 'user').map((s) => s.label.toLowerCase());
  const groups = uniq([...userSignals.flatMap((s) => USER_CUES.filter((c) => s.includes(c))), ...found]).filter(
    (u) => !['users', 'user', 'customer', 'customers', 'team', 'teams'].includes(u),
  );
  if (/product|pm|founder/.test(text)) return 'product teams';
  if (groups.length === 0) return 'your core users';
  return `${[...new Set(groups)].slice(0, 3).join(', ')}`;
}

export function buildProblem(messages: Message[]): ProblemStatement {
  const real = messages.filter((m) => m.kind !== 'system' && m.content.trim().length > 0);
  const signals = extractSignals(real);
  const pains = signals.filter((s) => s.type === 'pain');
  const evidence = signals.filter((s) => s.type === 'evidence');
  const metrics = signals.filter((s) => s.type === 'metric');
  const ideas = signals.filter((s) => s.type === 'idea');
  const decisions = signals.filter((s) => s.type === 'decision');
  const blockers = signals.filter((s) => s.type === 'blocker');
  const questions = signals.filter((s) => s.type === 'question');
  const text = real.map((m) => m.content).join('\n');
  const kws = keywords(real, 16);
  const phrases = phraseFor(real, 10);
  const audience = audienceFrom(real, signals);
  const audienceList = audienceTerms(text);
  const productType = detectProductType(text);

  const topPain = pains[0]?.label ?? 'the same work is done twice across disconnected tools';
  const secondPain = pains[1]?.label;
  const thirdPain = pains[2]?.label;

  const rawPain = (pains[0]?.detail || topPain)
    .replace(/^(and|but|so|because|also)\s+/i, '')
    .replace(/^(i|we|they|the team|everyone)\s+(think|thinks|feel|feels|see|saw|are|is|have|has|keep|keeps)\s+/i, '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/\.$/, '')
    .trim();
  const painLower = /^I\b/.test(rawPain) ? rawPain : rawPain.charAt(0).toLowerCase() + rawPain.slice(1);
  const painCore = shorten(rawPain, 110);

  const outcome =
    metrics[0]?.label
      ? shorten(metrics[0].label, 90)
      : 'ship a validated product without losing the thread between meeting and launch';

  const statement =
    `How might we help ${audience} take a product from the first conversation to live deployment — ` +
    `when ${clause(painLower, 165)}?`;

  const decisionLine = decisions[0] ? ` The team has already moved on: “${shorten(decisions[0].label, 120)}”.` : '';
  const evidenceLine = evidence.length
    ? ` ${evidence.length} evidence point${evidence.length > 1 ? 's' : ''} were captured, including “${shorten(
        evidence[0].label,
        110,
      )}”.`
    : ' No hard numbers were captured yet — the next step is to attach real evidence before committing budget.';

  void outcome;
  const summary = shorten(
    `Across ${real.length} message${real.length === 1 ? '' : 's'} from ${uniq(real.map((m) => m.author)).length} teammate(s), ` +
      `the conversation keeps returning to ${kws.slice(0, 4).join(', ')}. The recurring pain is “${shorten(topPain, 120)}”.` +
      evidenceLine +
      decisionLine,
    780,
  );

  const scoreBase =
    34 +
    Math.min(22, pains.length * 5) +
    Math.min(18, evidence.length * 6) +
    Math.min(10, decisions.length * 4) +
    Math.min(8, metrics.length * 3) +
    Math.min(6, Math.floor(kws.length / 2));
  const confidence = Math.max(38, Math.min(94, scoreBase));

  const successMetrics = uniq([
    ...metrics.map((m) => toMetric(m.label)).filter(Boolean) as string[],
    'Time from first meeting to a deployed v0.1 (target: under 14 days)',
    'Number of teams completing a full ideate → launch run',
  ]).slice(0, 4);

  const solutionAngles = uniq([
    ...ideas
      .filter((i) => !/^(i|we)\s+(open|get|see|have|am|are|run|rework)\b/i.test(i.label))
      .map((i) => titleCase(shorten(i.label, 100))),
    `An AI meeting copilot that listens, extracts the problem statement and keeps it as the single source of truth`,
    `A stage-gated workspace where every lifecycle stage already has the free tool, template and checklist loaded`,
    `Auto-generated product artifacts (PRD, data model, test plan, launch kit) that stay linked to the problem`,
    `A shared command centre where the whole team sees the same problem, scope and next action`,
  ]).slice(0, 5);

  const unknowns = uniq([
    ...questions.map((q) => `${titleCase(shorten(q.label, 110))}`),
    `Who exactly feels this pain most — ${audience}? Which single segment do we serve first?`,
    'What is the measurable cost of the pain today (hours, money, lost revenue)?',
    'What does the team do today instead, and why is that not enough?',
    evidence.length < 2 ? 'Where is the hard evidence (numbers, quotes, frequency) behind this problem?' : '',
    'What is explicitly out of scope for v0.1?',
  ]).slice(0, 5);

  const assumptions = uniq([
    `The team will adopt one workspace instead of the ${Math.max(3, 4 + ideas.length)} tools they use today.`,
    'The meeting conversation contains enough signal to define a real problem (validate with 3 users).',
    'A free-tier stack (Vercel + Neon + an LLM API) is sufficient for v0.1 scale.',
    blockers[0] ? `Known risk to resolve: “${shorten(blockers[0].label, 110)}”.` : 'The team can ship weekly without extra headcount.',
  ]).slice(0, 4);

  const tags = uniq([
    ...kws.slice(0, 8),
    ...phrases.filter((p) => !/^(problem side|side problem|every monday|nobody agreed|let s)/.test(p)).slice(0, 4),
  ]).slice(0, 10);

  const themeWords = kws.filter((k) => !/^(team|teams|thing|things|people|product|products|user|users)$/.test(k));
  const audienceWords = new Set(audience.split(/[ ,]+/));
  const goodPhrase = phrases.find(
    (p) => !p.split(' ').some((w) => audienceWords.has(w)) && !/^(problem side|side problem|let s|we rework|i get|nobody agreed)/.test(p),
  );
  const theme = goodPhrase ?? themeWords.slice(0, 1).join(' ') ?? 'the lost thread';
  const title = titleCase(shorten(`${audience} lose the thread between ${theme} and launch`, 92));

  return {
    title,
    statement,
    summary,
    confidence,
    status: 'draft',
    users: uniq([audience, ...audienceList.map(titleCase)]).slice(0, 5),
    pains: uniq(
      [
        shorten(pains[0]?.detail || topPain, 220),
        secondPain ? shorten(pains[1]?.detail || secondPain, 200) : '',
        thirdPain ? shorten(pains[2]?.detail || thirdPain, 200) : '',
        ...pains.slice(3, 6).map((p) => shorten(p.detail || p.label, 180)),
      ].filter(
        (p) => p && !/^(idea|decision|what if|let's|if )\b/i.test(p),
      ),
    ).slice(0, 6),
    evidence: uniq(evidence.map((e) => titleCase(shorten(e.label, 150)))).slice(0, 6),
    assumptions,
    unknowns,
    successMetrics,
    solutionAngles,
    productType,
    tags,
    engine: 'local-reasoner',
    updatedAt: new Date().toISOString(),
  };
}

export function localChatAnswer(question: string, ctx: { problem: ProblemStatement | null; messageCount: number }): string {
  const q = question.toLowerCase();
  const p = ctx.problem;
  if (!p) {
    return `I have ${ctx.messageCount} messages so far but no approved problem statement yet. Talk it through and press **Build problem statement** — I will pull out the users, pains, evidence and the one question worth answering.`;
  }
  if (/what.*(problem|statement|question)/.test(q)) {
    return `**The problem we are solving**\n\n${p.statement}\n\nWhy it matters: ${p.summary.slice(0, 320)}…\n\nSuggested next move: ${p.unknowns[0] ?? 'attach evidence before scoping the MVP'}.`;
  }
  if (/next|what should|priority|todo/.test(q)) {
    const clean = (t?: string, fallback = '') => (t ? t.replace(/[.?!]+$/, '') : fallback);
    return `Three highest-leverage moves right now:\n1. ${clean(p.unknowns[0], 'Validate the pain with 3 users')} — answer this before scoping anything.\n2. Lock the MVP to one job: ${clean(p.solutionAngles[0], 'the narrowest useful slice')}.\n3. Ship a deployable skeleton today so the team has a URL before the next meeting.\n\nThe checklist and board tasks for this are already in the workspace.`;
  }
  if (/metric|success|measure|kpi/.test(q)) {
    return `Success for this problem:\n${p.successMetrics.map((m) => `• ${m}`).join('\n')}\n\nPick one as the launch metric and treat the rest as guardrails.`;
  }
  if (/risk|fail|concern|blocker/.test(q)) {
    return `Top risks I can see:\n${p.assumptions.map((a) => `• ${a}`).join('\n')}\n\nMitigate by timeboxing validation to 5 days and keeping v0.1 to a single happy path.`;
  }
  if (/tool|stack|tech|build|deploy|free/.test(q)) {
    return `Free stack that matches this problem (${p.productType}): Next.js on Vercel + Neon Postgres + an LLM API (Gemini/Groq have free tiers) + GitHub Actions + PostHog. Everything is pre-loaded with docs in the Build and Architect stages.`;
  }
  return `Here is what I read from the conversation:\n\n• Problem: ${p.statement}\n• Product shape: ${p.productType}\n• Confidence: ${p.confidence}%\n• Biggest unknown: ${p.unknowns[0] ?? 'evidence depth'}\n\nTell me which stage you want to go deep on — Discover, Define, Ideate, Design, Architect, Build, Test, Launch or Grow — and I will draft the artifact for it.`;
}
