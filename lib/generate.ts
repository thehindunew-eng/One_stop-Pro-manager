import type { ProblemStatement, Project, StageKey, Tool, Member } from './types';

export interface DocContext {
  project: Project;
  problem: ProblemStatement | null;
  members: Pick<Member, 'name' | 'role'>[];
  tools: Pick<Tool, 'name' | 'url' | 'free_tier' | 'stages' | 'category'>[];
  stageName: string;
  stageKey?: StageKey;
}

const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function toolsFor(stage: StageKey, ctx: DocContext, n = 6): string {
  const list = ctx.tools.filter((t) => t.stages.includes(stage)).slice(0, n);
  if (!list.length) return '- GitHub · Vercel · Neon';
  return list.map((t) => `- **${t.name}** — ${t.free_tier} · [open](${t.url})`).join('\n');
}

export function generateDoc(kind: string, title: string, ctx: DocContext): string {
  const p = ctx.problem;
  const project = ctx.project.name;
  const who = p?.users?.[0] ?? 'the primary user';
  const whoAll = p?.users?.slice(0, 3).join(', ') ?? who;
  const pain = p?.pains?.[0] ?? 'the current workflow is fragmented and manual';
  const pain2 = p?.pains?.[1] ?? 'work is duplicated across tools';
  const pain3 = p?.pains?.[2] ?? 'nobody owns the thread from idea to launch';
  const evidence = p?.evidence?.length ? p.evidence : ['No hard evidence captured yet — the first research task is to attach numbers.'];
  const metric = p?.successMetrics?.[0] ?? 'Time from problem statement to deployed v0.1';
  const metric2 = p?.successMetrics?.[1] ?? 'Weekly active teammates per project';
  const metric3 = p?.successMetrics?.[2] ?? 'Problem approved → roadmap generated in the first session';
  const statement = p?.statement ?? 'How might we turn a team conversation into a shipped product?';
  const unknown0 = p?.unknowns?.[0] ?? 'Which user segment feels this pain most?';
  const unknown1 = p?.unknowns?.[1] ?? 'What is the measurable cost of the pain today?';
  const angle = p?.solutionAngles?.[0] ?? 'A single workspace that carries the problem from meeting to launch';
  const type = p?.productType ?? 'Web app / SaaS';
  const team = ctx.members.length ? ctx.members.map((m) => `${m.name} (${m.role})`).join(', ') : 'Core team';
  const stageTools = toolsFor(ctx.stageKey ?? (kind.includes('launch') || kind.includes('gtm') ? 'launch' : 'build'), ctx);

  const H = (s: string) => `\n## ${s}\n`;

  switch (kind) {
    case 'problem_canvas':
      return `# Problem Canvas — ${project}

> ${statement}

${H('1. The problem in one breath')}
${whoAll} currently deal with **${pain}**. Left alone, this means ${pain2}, and by launch nobody can explain why a feature exists.

${H('Who feels it')}
| Segment | What they do today | Cost of the pain |
| --- | --- | --- |
| ${who} | Spreadsheets + chat threads + memory | Hours lost every week, decisions re-litigated |
| Their manager | Asks for status, waits for updates | No visibility, late surprises |
| The team building it | Re-scopes from scratch each sprint | Rework, burnout, missed launch dates |

${H('Evidence we already have')}
${evidence.map((e) => `- ${e}`).join('\n')}

${H('Why now')}
- Free-tier infrastructure (Vercel, Neon, LLM APIs) removes the cost excuse for shipping a v0.1 this month.
- ${angle}

${H('Constraints')}
- One small team, no dedicated ops, near-zero budget until launch.
- Must work in a browser, installable later.
- Privacy: only data the team deliberately adds.

${H('Definition of solved')}
- ${metric}
- ${metric2}
- ${metric3}

${H('Open questions')}
1. ${unknown0}
2. ${unknown1}
3. What are we deliberately **not** solving in v0.1?

${H('Free tools for this canvas')}
${toolsFor('discover', ctx)}
`;
    case 'interview_guide':
      return `# User Interview Guide — ${project}

Goal: prove (or kill) this problem statement in **5 conversations**.
> ${statement}

${H('Who to talk to')}
${whoAll} — 5 people, at least 3 who feel the pain weekly. Screen them with: *"When was the last time ${pain}?"*

${H('Rules')}
- 25 minutes, one person, no pitching. You are there to collect facts, not compliments.
- Ask about the last time it happened, never about the hypothetical future.
- Record with permission; take verbatim notes.

${H('Warm-up (3 min)')}
1. Walk me through your role and a normal week.
2. What does a "good" week look like for you?

${H('The last time it happened (10 min)')}
3. Tell me about the last time ${pain}. Walk me through it step by step.
4. Where did it start and where did it break?
5. What did you do instead when it broke?
6. How long did that take — and what did it cost you?
7. Who else got pulled into it?

${H('Workarounds & tools (5 min)')}
8. Show me the tools you used — what lives where?
9. What have you tried to fix this? Why did it not stick?
10. If this never got fixed, what happens in 6 months?

${H('Close (4 min)')}
11. Who else should I talk to?
12. May I come back when we have something you can click?

${H('Signals to capture')}
| Question | What a strong signal sounds like |
| --- | --- |
| Frequency | "Every Monday", "every release" |
| Cost | "Two days", "we lose a whole sprint" |
| Emotion | Frustration, apologies, workarounds |
| Budget | Already paying for 3 tools that do not talk |

${H('After each call')}
- Log answers in Google Forms/Tally within 10 minutes.
- Tag each quote as **pain / workaround / wish** in the Signals panel.
- Update confidence on the problem statement after every 2 calls.
`;
    case 'research_plan':
      return `# Research & Validation Plan — ${project}

${H('The bet')}
> ${statement}

${H('5-day plan')}
| Day | Activity | Output | Owner |
| --- | --- | --- | --- |
| Mon ${d(0)} | Desk research: Reddit, G2 reviews, forums, competitor pricing | 10 documented complaints | PM |
| Tue ${d(1)} | 2 user interviews | Pain quotes + frequency | PM + Design |
| Wed ${d(2)} | Survey to 30 warm users (${toolsFor('discover', ctx, 2).split('\n')[0]?.replace(/[-*]/g, '').slice(0, 40) ?? 'Google Forms'}) | % who feel the pain weekly | PM |
| Thu ${d(3)} | 2 more interviews + competitor teardown | Wedge decision | Design |
| Fri ${d(4)} | Synthesis + go / no-go review | Updated problem statement, signed off | Whole team |

${H('What counts as proof')}
- **Go** if ≥ 3 of 5 interviewees describe the pain unprompted **and** can name a cost.
- **Pivot** if the pain is real but the segment is different.
- **Kill** if people cannot recall the last time it happened.

${H('Evidence log')}
| Source | Quote / number | Type | Confidence |
| --- | --- | --- | --- |
| Interview 1 | | pain | |
| Interview 2 | | workaround | |
| Survey | | frequency | |

${H('Free tooling')}
${toolsFor('discover', ctx)}

${H('Output of this stage')}
An approved problem statement with confidence ≥ 70%, 3 personas started, and a written decision to invest 2 weeks.
`;
    case 'prd':
      return `# Product Requirements — ${project}
**v0.1 · Draft · Owner: ${ctx.members.find((m) => m.role === 'pm')?.name ?? 'PM'}**

${H('1. Problem')}
${statement}

Why now: ${evidence[0]}

${H('2. Users & jobs')}
| User | Job to be done | Today |
| --- | --- | --- |
${p?.users?.slice(0, 3).map((u) => `| ${u} | Get from conversation to a buildable plan | ${pain} |`).join('\n') ?? '| Product team | Ship a validated product | Scattered tools |'}

${H('3. Goals')}
- ${metric}
- ${metric2}

${H('4. Non-goals (v0.1)')}
- No native mobile app.
- No enterprise SSO / SCIM.
- No marketplace or billing until 10 teams are active.

${H('5. Requirements')}
| # | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| R1 | Capture the meeting and extract the problem statement | P0 | A statement is produced with users, pains, evidence and confidence |
| R2 | Approve / edit the problem, keep history | P0 | Any member can edit; history is retained |
| R3 | Stage-by-stage workspace with tools, docs and checklists | P0 | Every stage has ≥ 2 docs and ≥ 4 tasks |
| R4 | Auto-generated artifacts (PRD, architecture, test plan, launch kit) | P0 | Generated in < 10s and editable inline |
| R5 | Board with owners, priority and status | P1 | Drag between todo / doing / review / done |
| R6 | Share by link, role-aware access | P1 | Members join by URL, owner keeps control |

${H('6. Success metric')}
**North star:** ${metric}. Guardrails: no P0 bugs at launch, page load < 2s.

${H('7. User stories')}
- As **${who}**, I want to ${angle.toLowerCase()}, so that I stop losing the thread between meetings.
- As a **teammate**, I want to see the same problem statement, so that I build the right thing.
- As **Amar (owner)**, I want to change tools and stages without a deploy, so that the platform never goes stale.

${H('8. Risks')}
${(p?.assumptions ?? ['Adoption is the real risk, not technology.']).map((a) => `- ${a}`).join('\n')}

${H('9. Timeline')}
| Week | Milestone |
| --- | --- |
| 1 | Problem approved, research done, design started |
| 2 | Skeleton deployed, auth + database live |
| 3 | Core workflow working end to end |
| 4 | Launch checklist, 5 usability tests, public launch |
`;
    case 'personas':
      return `# Personas & Jobs To Be Done — ${project}

${H('Primary persona')}
**${who}** — ${p?.productType ?? 'Product team builder'}
- Context: runs the meeting, owns the outcome, is accountable for launch.
- Struggle: ${pain}
- Current workaround: ${pain2}
- What "great" looks like: walks out of a meeting with a problem statement, a plan and a URL to share.
- JTBD: *"When a working session ends, help me convert the discussion into a validated plan so I can start building today."*

${H('Secondary persona')}
**The builder (engineer/designer)**
- Struggle: requirements arrive as vibes; scope changes silently.
- JTBD: *"When I start a ticket, show me the problem it serves and the constraints I must respect, so I do not build the wrong thing."*

${H('Tertiary persona')}
**The stakeholder**
- Struggle: no visibility until a demo or a miss.
- JTBD: *"When the team is a week in, let me see confidence, scope and risk without asking for a status deck."*

${H('Anti-personas')}
- Teams larger than 25 who need formal portfolio governance (not v0.1).
- Individual note-takers who only want transcripts (we are not a recorder).

${H('Jobs map')}
| Stage | Job | Pain today | Our promise |
| --- | --- | --- | --- |
| Discover | Understand the real problem | Opinions, no evidence | Evidence-backed statement |
| Define | Agree on scope | Endless docs | One page everyone signs |
| Build | Ship the MVP | Setup tax, tool juggling | Free stack pre-decided |
| Launch | Tell the story | Last-minute scramble | Launch kit generated |
| Grow | Learn and re-decide | Nobody looks at metrics | Weekly learning loop |

${H('Interview snippets to validate')}
${evidence.slice(0, 3).map((e) => `> "${e}"`).join('\n\n')}
`;
    case 'mvp_scope':
      return `# MVP Scope & Non-Goals — ${project}

${H('The one sentence')}
Ship **${angle}** so that ${who} can ${metric.toLowerCase().replace('target: ', '')}.

${H('In scope (v0.1, 2 weeks)')}
- [ ] Meeting room with live chat, signals and an AI copilot
- [ ] Problem statement extraction + approve/edit + history
- [ ] Nine lifecycle stages with tools, docs and checklists
- [ ] Auto-generated artifacts you can edit and copy
- [ ] Board with owner, priority, status
- [ ] Shareable link, join by name, owner admin
- [ ] Deployed on Vercel + Neon

${H('Explicitly out of scope')}
| Cut | Why | Revisit when |
| --- | --- | --- |
| Billing | Free tier is the wedge | 10 active teams |
| Native mobile | Web is enough for v0.1 | 40% mobile sessions |
| Integrations (Slack, Jira) | Copy/paste is acceptable | 5 teams ask |
| Multi-language | English first | Non-English signups > 20% |
| Enterprise SSO | Not the buyer yet | First paid enterprise deal |

${H('Definition of Done')}
- A new team can go from empty workspace → approved problem → deployed plan in one sitting, unassisted.
- ${metric}
- No P0 bugs; Lighthouse ≥ 90 performance on the landing page.

${H('Sequencing')}
1. **Vertical slice:** meeting → problem statement (the magic moment).
2. **Workspace:** stages, docs, tools, board.
3. **Polish:** motion, empty states, sharing, admin editing.

${H('Scope guardrails')}
Say no to anything that is not required for a first team to reach launch. If a request takes more than a day, it belongs in v0.2.
`;
    case 'concepts':
      return `# Solution Concepts (scored) — ${project}

Problem: ${statement}

| # | Concept | Wedge | Impact /5 | Effort /5 | Risk /5 | Score |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **${angle}** | Whole lifecycle in one room | 5 | 4 | 2 | **17** |
| 2 | Meeting-to-PRD generator only | Fast, narrow, viral | 4 | 2 | 2 | **16** |
| 3 | Stage-gated workspace with free tool kit | Great for teams new to shipping | 4 | 3 | 2 | **15** |
| 4 | Async "product OS" with AI standups | Strong for remote teams | 3 | 4 | 3 | **11** |
| 5 | Marketplace of product templates | Content-led, cheap to test | 3 | 2 | 4 | **10** |

*(Score = 2×impact − effort + risk headroom)*

${H('Why concept 1 wins')}
- It is the only concept that removes the **hand-off tax** between problem and launch.
- Every stage can reuse the same problem object, so the AI gets better with every meeting.
- Demo-able in 60 seconds, which matters for launch on Product Hunt and LinkedIn.

${H('What we steal from the others')}
- From #2: a one-click PRD export (shareability).
- From #3: pre-loaded free-tool kit per stage (instant value).
- From #5: template gallery later, as a growth loop.

${H('Killed ideas')}
- **Full Jira clone** — crowded, no wedge, huge surface area.
- **AI-only chatbot** — no artefacts, no accountability.
- **Live video infra** — use Google Meet/Zoom links instead of rebuilding WebRTC.

${H('Next experiment')}
Put the problem statement in front of 5 PMs. If 3 say "I would use this in Monday's meeting", build concept 1 as specified.
`;
    case 'solution_brief':
      return `# Chosen Solution Brief — ${project}

${H('The bet')}
> ${angle}

We believe ${who} will abandon fragmented docs and spreadsheets for a single room where the meeting itself produces the plan.

${H('Why this, why now')}
- ${evidence[0]}
- Free infrastructure makes a 2-week build realistic.
- AI extraction is now good enough that the meeting can be the input.

${H('Experience in 5 steps')}
1. Create a room, share the link, team joins by name.
2. Talk (or type) — the copilot listens and surfaces pains, users and evidence live.
3. Press **Build problem statement** → a How-might-we with confidence and open questions.
4. Approve it; the workspace generates PRDs, scope, stack, tests and launch kit per stage.
5. Move tasks on the board, ship the MVP, come back to Grow with real metrics.

${H('What makes it defensible')}
- The problem statement is the spine: every artifact links back to it.
- Owner can edit stages, tools and copy from the app — no redeploy needed.
- Free-tier defaults mean a team can launch with $0 fixed cost.

${H('Success looks like')}
- ${metric}
- ${metric2}

${H('Risks & mitigations')}
| Risk | Mitigation |
| --- | --- |
| "Another tool" fatigue | Import by paste; value in the first 5 minutes |
| AI produces generic statements | Human approval step + evidence requirement |
| Scope creep | Non-goals written in the PRD and enforced in reviews |
| Owner can't edit | Admin console for stages, tools and feature flags |
`;
    case 'ux_flows':
      return `# User Flows & Wireframe Plan — ${project}

${H('Golden path')}
Landing → **Create room** → Invite link → Meeting chat → *Copilot extracts signals* → **Build problem statement** → Approve → Workspace (Discover) → Stage tabs → Docs generated → Board → Deploy → Launch.

${H('Screen inventory')}
| Screen | Purpose | Key elements | Empty state |
| --- | --- | --- | --- |
| Landing | Convert a PM in 15s | Hero, live demo strip, tool wall | — |
| Join | Identify a teammate | Name, role, passcode (owner) | "You are the first here" |
| Meeting room | Capture the conversation | Transcript, composer, signal rail, copilot | "Start with the problem" |
| Problem card | Decide the question | Statement, confidence, users, pains, evidence | "Not enough signal yet" |
| Stage workspace | Do the work | Tabs: Docs · Tools · Board · Checklist | "Generate starter docs" |
| Doc composer | Own the artifact | Markdown editor, regenerate, copy, status | Template hint |
| Admin console | Keep it alive | Stages, tools, team, access | Defaults loaded |

${H('Interaction rules')}
- Never block the meeting: extraction updates quietly in the rail.
- Every destructive action confirms inline, never in a modal chain.
- Confidence is always visible next to the statement — honesty builds trust.
- One primary action per screen, high contrast, keyboard-first.

${H('Wireframe prompts (Figma)')}
1. Room view, 1440 and 390 widths.
2. Problem card with low confidence (<60%) vs approved.
3. Stage workspace with 3 docs and 6 tasks.
4. Admin console list + edit drawer.

${H('Design tools')}
${toolsFor('design', ctx, 4)}
`;
    case 'design_system':
      return `# Design System Starter — ${project}

${H('Principles')}
1. **Calm by default** — dark canvas, one accent, colour means action.
2. **Show the work** — status, confidence and ownership are always visible.
3. **Icon-first** — every tool and stage has a recognisable mark.

${H('Colour')}
| Token | Hex | Use |
| --- | --- | --- |
| ink-900 | #070914 | App background |
| ink-800 | #0e1224 | Panels |
| ink-600 | #1d2440 | Borders, hover |
| electric | #6366f1 | Primary action, focus |
| mint | #34d399 | Success, done |
| amber | #fbbf24 | In progress, attention |
| rose | #fb7185 | Risk, blocked |
| cyan | #22d3ee | Discovery, info |

${H('Type scale')}
| Role | Size / line | Weight |
| --- | --- | --- |
| Display | 40/46 | 700, tracking -1.5% |
| H1 | 28/34 | 650 |
| H2 | 20/26 | 600 |
| Body | 15/24 | 400 |
| Meta | 12/16 | 500, uppercase, +6% tracking |

${H('Spacing & radius')}
4 · 8 · 12 · 16 · 24 · 32 · 48. Radius: 8 (controls) · 14 (cards) · 999 (pills). Shadow only on floating layers.

${H('Core components')}
- [ ] Button: primary / ghost / danger, 36px and 44px heights
- [ ] Card with header slot + actions
- [ ] Stage tab with icon and completion ring
- [ ] Tool tile with logo, name and free-tier label
- [ ] Signal row with type chip and score bar
- [ ] Board column with WIP count
- [ ] Toast + inline error
- [ ] Markdown doc shell with status pill

${H('Motion')}
150ms ease-out for hovers, 220ms for panels, 8px fade-up on list entry. Respect prefers-reduced-motion.

${H('Accessibility')}
AA contrast on all text, 44×44 hit targets, focus ring #818cf8 at 2px, every icon has a label, colour never the only signal.

${H('Hand-off')}
Build in Figma, mirror tokens in tailwind.config.ts, then publish components to Storybook so engineering and design stay in sync.
`;
    case 'landing_wireframe':
      return `# Landing Page Blueprint — ${project}

${H('Above the fold')}
- Eyebrow: *For product teams that ship*
- H1: **From meeting to launch, in one room.**
- Sub: ${statement.replace(/^How might we /, 'We help teams ')} 
- Primary CTA: **Open a room** · Secondary: *See a live workspace*
- Proof strip: ${toolsFor('launch', ctx, 5).split('\n').map((l) => l.replace(/[-*]|\*\*|\[open\]\(.*\)/g, '').split('—')[0].trim()).join(' · ')}

${H('Section 2 — The problem')}
Three columns: "Meetings end in notes", "Notes become docs", "Docs never ship". Then the line: *The thread is lost between the three.*

${H('Section 3 — How it works')}
1. **Talk** — the room listens and extracts the real problem.
2. **Approve** — one problem question, confidence attached.
3. **Build** — nine stages, each with tools, docs and a checklist.
4. **Launch** — deploy, announce, measure.

${H('Section 4 — The tool wall')}
Grid of free tools with logos, grouped by stage. Caption: *Every tool here has a free tier. Start with zero budget.*

${H('Section 5 — Proof')}
One real example: problem statement → generated PRD → deployed URL. Screenshot > testimonial until you have testimonials.

${H('Section 6 — Objections')}
| Objection | Answer |
| --- | --- |
| "We already use Notion" | Bring it — paste your notes, we turn them into a plan. |
| "Is our data safe?" | Owner-controlled workspace, no model training on your data. |
| "Is it free?" | Yes for small teams on free-tier infrastructure. |

${H('Final CTA + footer')}
**Open a room, invite the team, leave with a plan.** Footer: Product · Templates · Changelog · Privacy.

${H('Build it free')}
Framer or Webflow free tier, Unsplash imagery, Google Fonts. Ship this week.
`;
    case 'tech_stack':
      return `# Free-Tier Tech Stack — ${project}

Product shape: **${type}** · Constraint: ship in 2 weeks on free tiers, scale without a rewrite.

${H('Recommended stack')}
| Layer | Choice | Why | Free tier |
| --- | --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | One codebase for UI + API, deploys on Vercel | OSS |
| UI | Tailwind CSS + lucide-react | Design system speed, no CSS debt | OSS |
| Database | Neon Postgres | Serverless, branching, generous free tier | 0.5 GB |
| ORM | Drizzle (or raw SQL) | Types without magic | OSS |
| Auth | Custom cookie session *or* Clerk | No vendor lock at v0.1 | 10k MAU |
| AI | Gemini / Groq / OpenAI-compatible | Free dev tiers, swap via one env var | Free tier |
| Deploy | Vercel | Preview per PR, instant rollback | Hobby |
| CI | GitHub Actions | Tests + migrations | 2k min |
| Analytics | PostHog | Funnels, replay, flags | 1M events |
| Errors | Sentry | Catch it before users report | 5k events |
| Email | Resend / Brevo | Transactional + launch | 3k / 300 day |
| Payments | Stripe / Razorpay | Only when you charge | Test free |

${H('Architecture')}
Browser → Next.js route handlers (edge/serverless) → Postgres (Neon, pooled) → external LLM API.
No queue at v0.1. Move async work to a cron route on Vercel; adopt a queue only when p95 > 2s.

${H('Decisions & trade-offs')}
- **Serverless over containers** — zero ops now; anything long-running moves to a worker later.
- **Single Postgres** — one source of truth; JSONB for flexible docs, normalised tables for collaboration.
- **Provider-agnostic AI** — an env var switch prevents lock-in and lets cost fall to zero.
- **No microservices** — a small team cannot operate them; a modular monolith ships faster.

${H('Cost today')}
$0/month recurring. Domain ~$12/year. LLM spend capped at $5–20/month during build.

${H('Scale triggers')}
| Symptom | Next move |
| --- | --- |
| > 100k rows / heavy queries | Add indexes, then a read replica |
| LLM latency > 4s | Streaming + cache statements |
| > 50 concurrent rooms | Realtime channel (Supabase/Ably free tier) |
| Team > 15 | Role-based permissions + audit log |

${H('Tool links')}
${toolsFor('architect', ctx, 8)}
`;
    case 'data_model':
      return `# Data Model — ${project}

${H('Entities')}
| Table | Key columns | Notes |
| --- | --- | --- |
| users | id, name, email, role, is_admin | email nullable for guest joins |
| projects | id, code, name, owner_id, stage_key, problem(jsonb), settings(jsonb) | \`code\` is the shareable slug |
| members | project_id, user_id, role, last_seen | composite PK, drives presence |
| messages | id, project_id, user_id, author, kind, content, meta(jsonb) | meeting transcript + notes |
| signals | id, project_id, type, label, score, status, evidence(jsonb) | extracted intelligence |
| artifacts | id, project_id, stage_key, kind, title, content, status | unique(project_id, kind) |
| tasks | id, project_id, title, status, owner, priority, points, position | board state |
| tools | id, slug, name, category, stages(jsonb), free_tier, enabled | editable catalogue |
| stages | key, name, icon, color, position, checklist(jsonb), enabled | editable lifecycle |
| app_settings | key, value(jsonb) | owner-level flags |

${H('Relations')}
projects 1—N members (users)
projects 1—N messages, signals, artifacts, tasks
projects 1—1 problem statement (stored in projects.problem)

${H('SQL sketch')}
\`\`\`sql
create table projects (
  id text primary key,
  code text unique not null,
  name text not null,
  owner_id text not null,
  stage_key text default 'discover',
  problem jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index on messages (project_id, created_at);
create unique index on artifacts (project_id, kind);
\`\`\`

${H('Rules')}
- IDs: UUID (text) generated server-side.
- Soft deletes only for artifacts (keep history of decisions).
- Problem history stored inside the jsonb \`history\` array — cheap audit trail.
- Never trust client-supplied project ids without a membership check.

${H('Migrations')}
Ship schema as SQL, applied idempotently at boot (CREATE TABLE IF NOT EXISTS) for v0.1; adopt Drizzle migrations once more than one environment exists.
`;
    case 'api_spec':
      return `# API Contracts — ${project}

All endpoints are JSON over HTTPS, session-cookie auth, membership-scoped.

${H('Auth')}
| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | /api/auth/join | { name, role, email?, passcode?, projectCode? } | { user, project } + cookie |
| GET | /api/auth/me | — | { user, projects } |
| POST | /api/auth/logout | — | { ok } |

${H('Workspace')}
| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/workspace?code= | Full workspace payload (project, members, messages, signals, artifacts, tasks, tools, stages, me) |
| PATCH | /api/project | Edit name, tagline, stage, settings |
| POST | /api/project/advance | Move to next stage (logs a system message) |

${H('Meeting intelligence')}
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | /api/messages | { content, kind } | Returns message + newly extracted signals |
| POST | /api/analyze | {} | Runs the agent over the last N messages, stores signals + draft problem |
| PATCH | /api/signals | { id, status } | Accept / dismiss a signal |
| PATCH | /api/problem | Partial<ProblemStatement> | Approve, edit or restore from history |

${H('Artifacts & board')}
| Method | Path | Body |
| --- | --- | --- |
| POST | /api/docs | { kind, title, stage } → generate starter doc |
| PATCH | /api/docs | { id, content?, status?, regenerate? } |
| POST | /api/tasks | { title, stage, owner, priority } |
| PATCH | /api/tasks | { id, status?, owner?, position? } |
| DELETE | /api/tasks?id= | — |

${H('Admin (owner only)')}
| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/admin/tools | Create / update a tool tile |
| DELETE | /api/admin/tools?id= | Remove a tool |
| POST | /api/admin/stages | Edit stage name, icon, colour, checklist, enabled |
| PATCH | /api/admin/settings | Feature flags, AI provider hints, access mode |

${H('Conventions')}
- Errors: \`{ error: string }\` with 400/401/403/404/500.
- Every mutation returns the updated record.
- Rate limit analysis to 1 call / 3s / project; cache the last result.
- Never expose API keys to the browser.
`;
    case 'repo_plan':
      return `# Repository & Sprint Plan — ${project}

${H('Repo layout')}
\`\`\`
app/            routes (page + api)
components/     ui primitives and feature components
lib/            db, auth, ai, generators, types
public/         static assets
.env.example    every required key, documented
\`\`\`

${H('Branching')}
- \`main\` always deployable → Vercel production.
- Feature branches → preview URL per PR.
- PR needs: green build, 1 review, screenshots for UI changes.

${H('Sprint 1 (week 1) — the magic moment')}
- [ ] Repo + env + first deploy (day 1, non-negotiable)
- [ ] Schema + session auth + join by link
- [ ] Meeting room: messages, presence, kinds
- [ ] Signal extraction + problem statement card
- [ ] Approve/edit problem with history

${H('Sprint 2 (week 2) — the workspace')}
- [ ] Stage tabs + checklists
- [ ] Artifact generation + inline markdown editor
- [ ] Tool wall with free tiers, editable by owner
- [ ] Board with priority, owner, drag status
- [ ] Sharing, roles, admin console

${H('Week 3 — launch')}
- [ ] Usability tests with 5 PMs, fix top 3 friction points
- [ ] Performance + accessibility pass
- [ ] Landing page, demo video, Product Hunt assets
- [ ] Launch, instrument analytics, watch the funnel

${H('Definition of done (per ticket)')}
Works in preview · owner checked · no console errors · empty state handled · mobile width sane · copy reviewed.

${H('Ceremony lite')}
15-min daily standup in the room · Friday demo to a real user · weekly retro written into the Grow stage.

${H('Tools')}
${toolsFor('build', ctx, 6)}
`;
    case 'devops':
      return `# Deployment Runbook — ${project}

${H('1. Provision')}
1. Create the Neon project (free tier) → copy the pooled connection string.
2. Create the GitHub repo, push \`main\`.
3. Import the repo in Vercel → framework Next.js (auto-detected).
4. Add env vars in Vercel → Production **and** Preview:
   - \`DATABASE_URL\` (Neon, \`sslmode=require\`)
   - \`AUTH_SECRET\` (32+ random chars)
   - \`ADMIN_PASSCODE\` (owner access)
   - \`ADMIN_EMAILS\` (comma separated)
   - \`GEMINI_API_KEY\` (or any one provider)
5. Deploy. First boot creates tables idempotently.

${H('2. Verify')}
- [ ] \`/\` renders, CTA opens a room
- [ ] Join with name → cookie set → workspace loads
- [ ] Messages persist across reload
- [ ] Build problem statement returns a statement
- [ ] Owner passcode shows the Admin console
- [ ] Preview deployment from a PR works

${H('3. Database')}
| Task | Command |
| --- | --- |
| Inspect | Neon SQL editor: \`select * from projects;\` |
| Backup | Neon branch (instant, free) before risky changes |
| Migration | additive SQL at boot; never drop a column in the same release |
| Reset demo | delete the project row; cascade by project_id |

${H('4. Rollback')}
Vercel → Deployments → previous build → **Promote to production** (seconds).
Database changes: restore the pre-release branch, then replay.

${H('5. Monitoring')}
Sentry for errors, PostHog for funnels, Vercel analytics for speed. Alert on: 5xx rate > 1%, p95 > 2s, auth failures spike.

${H('6. Security baseline')}
- Secrets only in env vars; never in the client bundle.
- Session cookie: httpOnly, sameSite=lax, secure.
- Every API route checks membership before reading a project.
- Owner-only routes check \`is_admin\`.
- Rate limit analysis and join endpoints.

${H('7. Cost guardrails')}
Set a Neon usage alert and an LLM provider spend cap on day one. Free tiers are not unlimited: cache generated docs, never regenerate on render.
`;
    case 'engineering_standards':
      return `# Engineering Standards — ${project}

${H('Non-negotiables')}
1. \`main\` is always shippable. Broken main is a P0.
2. Every API route validates input and checks membership.
3. Types over tests for shapes, tests for behaviour.
4. No secret ever reaches the client bundle.
5. Ship behind a flag if a change is risky.

${H('Code review')}
- Under 400 changed lines per PR.
- Reviewer checks: correctness, empty states, error paths, accessibility.
- Author includes: what changed, how to test, screenshot/GIF.

${H('Testing pyramid')}
| Level | Tool | Coverage target |
| --- | --- | --- |
| Unit | Vitest | Pure logic in \`lib/\` |
| Integration | Vitest + test DB | API handlers with real Postgres |
| E2E | Playwright | Join → message → analyze → approve → generate doc |
| Manual | Checklist | Before every release |

${H('Performance budget')}
LCP < 2.0s on 4G, JS < 180KB gzipped for the workspace, no layout shift from fonts or banners.

${H('Accessibility')}
Semantic HTML, labels on every input, visible focus, AA contrast, keyboard reachable, \`aria-live\` for the signal rail.

${H('Data hygiene')}
- Timestamps in UTC, rendered in the viewer's locale.
- Money in integer minor units.
- Text limits enforced server-side (e.g. messages 4k chars).

${H('On-call (even if it is one person)')}
Sentry → triage within a day; anything user-blocking stops feature work. Keep a \`#incidents\` channel and write a 5-line postmortem.
`;
    case 'test_plan':
      return `# Test Plan — ${project}

${H('Scope')}
In: meeting room, problem extraction, artifacts, board, sharing, admin editing.
Out: native apps, billing, third-party integrations (v0.1).

${H('Flows that must never break')}
| # | Flow | Expected | Type |
| --- | --- | --- | --- |
| 1 | Join by link → workspace | Cookie set, project loads | E2E |
| 2 | Send message → persists | Reload keeps order | E2E |
| 3 | Analyze → problem statement | Users, pains, evidence, confidence present | E2E |
| 4 | Approve problem → history entry | Prior version retrievable | Integration |
| 5 | Generate doc → edit → save | Content survives reload | E2E |
| 6 | Owner edits a tool → visible to team | Change without redeploy | Integration |

${H('Edge cases')}
- Empty meeting + analyze → helpful message, no crash.
- 500-message room → analysis uses the tail, UI stays fast.
- Two people editing the same doc → last write wins with a warning.
- Refresh mid-analysis → result still lands.
- Invalid/expired cookie → graceful join screen.

${H('AI quality checks')}
- Statement must be a question, not a feature.
- Confidence < 60 when fewer than 3 evidence points.
- No invented numbers; evidence must trace to a message.
- Fallback engine produces a usable statement when the API fails.

${H('Security checks')}
- Non-member cannot read a project by code.
- Member cannot call admin routes.
- XSS: markdown rendered safely, no raw HTML injection.
- SQL injection: parameterised queries only.

${H('Tools')}
${toolsFor('test', ctx, 5)}

${H('Exit criteria')}
All P0 flows pass on the production build, zero open P0/P1 bugs, Lighthouse ≥ 90, 5 real users complete the golden path unaided.
`;
    case 'qa_checklist':
      return `# Release QA Checklist — ${project}

${H('Before you tag the release')}
- [ ] CI green, no skipped tests
- [ ] Preview URL reviewed on desktop (1440), tablet (834), mobile (390)
- [ ] Empty states for every list (no project, no messages, no docs, no tasks)
- [ ] Loading and error states for every async action
- [ ] Copilot failure path shows the built-in fallback, not a crash
- [ ] Session expiry → friendly re-join
- [ ] Owner-only UI hidden for members (and enforced server-side)
- [ ] Copy reviewed: no placeholder text, no lorem, no "TODO"

${H('Data')}
- [ ] Migrations applied to production before deploy
- [ ] No destructive migration in the same release as the feature
- [ ] Backup/branch created
- [ ] Analytics events firing (\`room_opened\`, \`problem_approved\`, \`doc_generated\`, \`stage_advanced\`)

${H('Performance & a11y')}
- [ ] Lighthouse ≥ 90 perf, 100 a11y on landing
- [ ] Keyboard-only pass through the golden path
- [ ] Contrast checked on chips and meta text
- [ ] Images have alt text, icons have labels

${H('Launch-specific')}
- [ ] OG image + meta description for the shared link
- [ ] 404 and 500 pages branded
- [ ] Status/rollback plan written
- [ ] Support channel monitored for the first 48h

${H('Sign-off')}
| Role | Name | Date |
| --- | --- | --- |
| PM | ${ctx.members.find((m) => m.role === 'pm')?.name ?? ''} | |
| Eng | ${ctx.members.find((m) => m.role === 'eng')?.name ?? ''} | |
| QA | ${ctx.members.find((m) => m.role === 'qa')?.name ?? ''} | |
`;
    case 'gtm_plan':
      return `# Go-To-Market Plan — ${project}

${H('Positioning')}
For **${whoAll}** who **${pain.toLowerCase()}**, ${project} is a meeting IDE that turns the conversation into a launch-ready product. Unlike Notion + Jira + ChatGPT stitched together, it keeps one problem statement as the spine of every artifact.

${H('Story angles')}
1. **The thread is lost in the hand-off** — meeting → notes → docs → tickets → nothing ships.
2. **Free-tier stack, real product** — from $0 to deployed in two weeks.
3. **The AI that asks "what problem are we actually solving?"**

${H('First 100 users')}
| Channel | Play | Effort |
| --- | --- | --- |
| Product Hunt | Launch with a 40s demo: meeting → approved problem → deployed plan | High, one shot |
| LinkedIn | Build-in-public series, 5 posts, tag PM communities | Medium |
| Reddit (r/ProductManagement, r/startups) | Share the framework, not the ad | Medium |
| X | Thread on "meeting to launch in one room" + GIF | Low |
| Communities | Indie Hackers, Slack/Discord PM groups, college entrepreneurship cells | Medium |
| Newsletter | Substack/Hashnode post: the 9 stages of shipping a product | Low |
| Waitlist | Landing page + Brevo/Mailchimp, 2 emails only | Low |

${H('Launch week plan')}
| Day | Action |
| --- | --- |
| T-7 | Landing live, waitlist open, 5 design partners onboarded |
| T-3 | Demo video, screenshots, PH assets ready |
| T-1 | Warm the list, brief 10 supporters |
| T-0 | Launch everywhere at 00:01 PT, founder replies to every comment |
| T+1 | Publish the "what we learned" post, ship the top request |
| T+7 | Review funnel; double down on the best channel, kill the rest |

${H('Metrics')}
- ${metric}
- Signup → first room created (activation)
- Waitlist → weekly active team
- Cost per activated team (target: under $2)

${H('Assets needed')}
Logo, OG image, 40s demo, 6 screenshots, one-pager PDF, 3 posts, email sequence.

${H('Free tools')}
${toolsFor('launch', ctx, 7)}
`;
    case 'landing_copy':
      return `# Landing Page Copy — ${project}

${H('Hero')}
**Eyebrow:** For product teams that actually ship

**H1:** Your meeting should end with a product, not a note.

**Sub:** ${(p?.summary ?? statement).slice(0, 220)}

**CTA:** Open a room — free · **Secondary:** See a real workspace

**Microcopy:** No credit card. Invite your team with one link.

${H('Problem section')}
### The average product idea dies in a hand-off.
Meetings end in notes. Notes become docs. Docs become tickets. Tickets become… a feature nobody asked for.
Somewhere in that chain, the actual problem got lost.

${H('How it works')}
**1. Talk it out.** Your team joins by link. The room listens for pains, users, evidence and decisions.
**2. Approve the problem.** One question, with a confidence score and the unknowns spelled out.
**3. Build the thing.** Nine stages, each with free tools, generated docs and a checklist.
**4. Launch it.** Deploy, announce, measure — then come back and decide the next bet.

${H('Proof')}
> "${evidence[0]}"
— ${p?.users?.[0] ?? 'a product team that ships weekly'}

${H('Feature grid')}
| Feature | Benefit |
| --- | --- |
| Meeting IDE | The conversation becomes the source of truth |
| Problem engine | You leave with the real question, not the loudest opinion |
| 9-stage lifecycle | Nothing gets skipped between ideation and deployment |
| 100+ free tools | Zero budget, zero setup |
| Generated artifacts | PRD, architecture, tests and launch kit in seconds |
| Owner console | Amar can change tools and stages without a deploy |

${H('FAQ')}
**Is it free?** Small teams run entirely on free tiers. You pay only when you outgrow them.
**Do you record audio?** Only if you ask it to; typing and transcripts work just as well.
**Can I use my own model?** Yes — OpenAI, Anthropic, Gemini, Groq or OpenRouter, one env var.
**Who controls the workspace?** The owner. Members can contribute; only the owner edits the platform.

${H('Final CTA')}
### Stop taking notes. Start shipping.
**Open a room →**
`;
    case 'launch_checklist':
      return `# Launch Day Checklist — ${project}

${H('T-7 days')}
- [ ] Production deploy on a real domain
- [ ] OG/meta tags verified in the share debugger
- [ ] Analytics + error monitoring live
- [ ] 5 design partners onboarded, feedback loop open
- [ ] Support channel + canned replies ready

${H('T-3 days')}
- [ ] 40s demo recorded (Loom)
- [ ] 6 screenshots at 1440 width
- [ ] Product Hunt draft: tagline, description, first comment, 5 images
- [ ] Social posts scheduled (LinkedIn, X, Reddit)
- [ ] Email #1 written for the waitlist

${H('T-1 day')}
- [ ] Full QA checklist signed off
- [ ] Rollback tested (promote previous Vercel build)
- [ ] Database branch snapshot taken
- [ ] On-call person decided for 48h
- [ ] Landing copy proofread by one outsider

${H('Launch day')}
- [ ] Deploy at 00:01 PT / 9:30 IST
- [ ] Publish PH, post on 3 channels, email the list
- [ ] Watch: 5xx, signup funnel, first-room creation
- [ ] Reply to every comment within 2 hours
- [ ] Ship one visible improvement before the day ends

${H('T+1')}
- [ ] Publish "launch learnings" post
- [ ] Fix the top 3 friction points from feedback
- [ ] Segment signups: PM / engineer / founder
- [ ] Book 5 calls with activated teams

${H('Success thresholds')}
| Metric | Target |
| --- | --- |
| Visitors → room created | ≥ 12% |
| Room created → problem approved | ≥ 60% |
| Activation (plan generated) | ≥ 40% |
| Day-7 return | ≥ 25% |

${H('Rollback triggers')}
Error rate > 2%, data loss, or auth broken for > 10 minutes → promote previous build, then investigate.
`;
    case 'metrics_plan':
      return `# Metrics & Learning Plan — ${project}

${H('North star')}
**${metric}** — it ties the product to the outcome the team actually cares about.

${H('Metric tree')}
| Layer | Metric | Target |
| --- | --- | --- |
| Acquisition | Landing → room created | 12% |
| Activation | Room created → problem approved | 60% |
| Value | Problem approved → ≥ 3 artifacts generated | 70% |
| Habit | Weekly active teammates per project | 3.5 |
| Outcome | ${metric} | baseline + 30% |
| Quality | P0 bugs per release | 0 |

${H('Instrumentation')}
| Event | Properties |
| --- | --- |
| room_opened | project_id, member_count |
| message_sent | kind, length_bucket |
| problem_generated | engine, confidence, signal_count |
| problem_approved | confidence, edit_distance |
| doc_generated | kind, stage, engine |
| stage_advanced | from, to, days_in_stage |
| task_moved | from, to, priority |

${H('Review cadence')}
- **Daily:** errors, activation funnel, support pings.
- **Weekly:** north star, stage progression, top drop-off; write one paragraph in Grow.
- **Monthly:** cohort retention, decide double-down / pivot / kill.

${H('Learning loop')}
1. Pick the single biggest funnel drop.
2. Write the hypothesis as a problem statement (use the room!).
3. Ship the smallest test within a week.
4. Read the result against a pre-committed threshold.
5. Kill or keep. Write it in the decision log.

${H('Guardrail metrics')}
Latency p95 < 2s, LLM cost per active team < $1, no increase in error rate, no drop in a11y score.

${H('Free analytics stack')}
${toolsFor('grow', ctx, 5)}
`;
    case 'feedback_loop':
      return `# Feedback Loop & Roadmap — ${project}

${H('Where feedback comes from')}
| Source | Cadence | Owner |
| --- | --- | --- |
| In-app feedback (Crisp/Intercom free tier) | Continuous | PM |
| Weekly user call (Cal.com link) | Weekly, 2 calls | PM + Design |
| Session replay review (PostHog) | Weekly, 30 min | Design |
| Support inbox triage | Daily | Eng on rotation |
| Community channel (Discord/Slack) | Continuous | Growth |

${H('Triage rules')}
1. Tag every request with the problem it serves, not the feature it asks for.
2. Score: frequency × severity × strategic fit.
3. Anything requested by 3+ teams in a month goes to the top of the board.
4. If a request does not serve the current problem statement, park it explicitly.

${H('The loop, weekly')}
1. Collect — 10 minutes, add raw items to Signals.
2. Cluster — group by underlying pain, not by tool.
3. Decide — one bet per week, written as a new problem statement.
4. Ship — smallest slice that proves or disproves it.
5. Report — one paragraph in the Grow doc, visible to the whole team.

${H('Roadmap rhythm')}
| Horizon | Commitment |
| --- | --- |
| Now (2 weeks) | Current bet + P0 fixes |
| Next (6 weeks) | Top 3 validated pains |
| Later | Parked ideas with the reason they wait |

${H('Roadmap (v0.1.1 → v0.3)')}
- **v0.1.1** — smoother onboarding, presence, better empty states.
- **v0.2** — Slack/Jira import, template gallery, exported PDF.
- **v0.3** — realtime collaboration (live cursors), billing, team analytics.

${H('Kill criteria')}
If fewer than 3 teams run a full ideate → launch cycle in 60 days, stop adding features and talk to 20 users before writing more code.
`;
    case 'competitive_analysis':
      return `# Competitive Analysis — ${project}

> Where does ${project} sit, what does the buyer do today, and why would they switch?

${H('The market in one paragraph')}
${whoAll} solve this by stitching together meetings, docs, tickets and chat. The alternatives below are the ones a real buyer would compare — not a list of every tool in the category.

${H('Alternatives, including “do nothing”')}
| Option | What it is good at | Where it breaks for ${who} | Our edge |
| --- | --- | --- | --- |
| Do nothing (notes + memory) | Free, zero setup | Decisions evaporate by mid-sprint | One room that keeps the problem alive |
| Generic docs (Notion, Confluence) | Flexible, cheap | The problem is never *decided*, only described | Problem statement with confidence and evidence |
| Work trackers (Jira, Linear) | Delivery discipline | Starts at the ticket, not the problem | Starts at the conversation |
| Meeting tools (Meet, Zoom, Fireflies) | Capture what was said | Notes are output, not a plan | Transcript → signals → plan in the same room |
| All-in-one suites | One vendor | Expensive, heavy for a 6-person team | Free tiers, nothing to migrate |

${H('What buyers actually decide on')}
1. **Time to first useful artifact** — ours is minutes, not a setup project.
2. **Does the team keep using it after week two?** — the stage checklist is the retention mechanic.
3. **Will it survive our stack?** — Vercel + Neon + any LLM key, no lock-in.
4. **Cost at 10 people** — free tiers cover a pilot; we publish the upgrade path in Pricing.

${H('Positioning statement')}
For **${whoAll}** who **${pain}**, ${project} is the workspace that turns the meeting into an approved problem, then walks the team through the nine stages to launch. Unlike ${angle.toLowerCase()}, everything stays anchored to one problem statement.

${H('What we deliberately do not compete on')}
- Not a video-call product (link out to Meet/Zoom).
- Not a code review tool (link out to GitHub).
- Not a design tool (link out to Figma).

${H('Signals to watch')}
- Mentioned in the same breath as a competitor (track in Signals).
- Teams exporting the pack and leaving → we are a note-taking tool to them.
- Teams skipping stages → the checklist is too long, not the market.

${H('Research tasks')}
- [ ] Interview 3 people who tried a docs-only workflow and gave up.
- [ ] Price-check the paid tier of each alternative above.
- [ ] Write the one-line answer to “why not just Notion?” and test it on a stranger.

${H('Sources to keep current')}
${stageTools}
`;
    case 'roadmap':
      return `# Roadmap & Milestones — ${project}

> ${statement}

${H('How this roadmap works')}
Dates are commitments to *decide*, not promises of scope. Each milestone names the evidence that lets us continue, so the team never argues about whether we are ready — the milestone says it.

${H('Milestones')}
| Milestone | Date | Ships | Exit criteria | Owner |
| --- | --- | --- | --- | --- |
| M0 · Problem locked | ${d(3)} | Approved problem statement, signals clustered | Problem approved by the team, confidence ≥ 70% | ${team.split(',')[0]} |
| M1 · Scope agreed | ${d(10)} | PRD, personas, MVP scope, non-goals | Written sign-off, no open P0 questions | PM |
| M2 · Design ready | ${d(17)} | Flows, wireframes, design system | 3 people completed the prototype unaided | Design |
| M3 · Vertical slice live | ${d(24)} | Database → API → UI on a real URL | One real user finishes the core job | Eng |
| M4 · Pilot | ${d(31)} | Test plan, 5 usability sessions | No P0 bugs, 4/5 users succeed | QA |
| M5 · Launch | ${d(38)} | Pricing, launch assets, analytics | ${metric} instrumented and visible | Growth |
| M6 · First review | ${d(52)} | Metrics review, decision log entry | Double down / pivot / kill decided in writing | PM |

${H('What is in v0.1 (and what is not)')}
**In:** the single job in the problem statement, one happy path, one integration.
**Out:** roles and permissions, billing, mobile apps, realtime collaboration, custom templates. Each gets an explicit “not now” in the Decision Log.

${H('Cadence')}
- **Weekly:** Friday demo, something visible ships every week.
- **Every two weeks:** milestone check — move it or change the scope, never both silently.
- **Every month:** re-read the problem statement. If it changed, the roadmap is wrong.

${H('Critical path')}
Problem approval → PRD sign-off → data model → first deploy. Anything that blocks one of those four outranks everything else on the board, regardless of priority label.

${H('If we slip')}
Cut scope, not quality: drop M4's second usability round, ship the pilot to 3 users, keep the launch date. A late launch with no evidence is worse than a small launch with real usage.

${H('Tooling')}
${stageTools}
`;
    case 'risk_register':
      return `# Risk Register — ${project}

> The risks that could stop **${metric}** from moving. Reviewed every Monday, owned by a name, not by “the team”.

${H('Top risks')}
| # | Risk | Type | Likelihood | Impact | Score | Mitigation | Owner | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | ${unknown0} stays unanswered and we build the wrong thing | Product | High | High | 9 | Interview 3 users this week; block scope until answered | PM | ${d(7)} |
| R2 | ${unknown1} | Market | Medium | High | 6 | Pull public numbers, write the assumption down, timebox | PM | ${d(14)} |
| R3 | Scope grows past one happy path | Delivery | High | Medium | 6 | Non-goals in the PRD; every new ask goes to the Decision Log | PM | Weekly |
| R4 | Free-tier limits hit during the pilot (DB connections, LLM quota) | Technical | Medium | Medium | 4 | Pool connections, cap generations per room, alert at 80% | Eng | ${d(21)} |
| R5 | One person holds all the context | Team | Medium | High | 6 | Docs are generated in the room, not in DMs; rotate demo duty | PM | Weekly |
| R6 | A P0 bug lands on launch day | Launch | Low | High | 3 | Rollback plan in the Launch Checklist, feature flag the risky path | Eng | ${d(35)} |
| R7 | Nobody returns after week two | Retention | Medium | High | 6 | Stage checklist + weekly demo; measure weekly active teammates | Growth | ${d(28)} |

${H('Assumptions we are betting on')}
${(p?.assumptions ?? []).length ? (p?.assumptions ?? []).map((a, i) => `${i + 1}. ${a} — test by ${d(7 + i * 7)}`).join('\n') : '1. The pain is frequent enough to pay for a fix.\n2. The buyer is the same person who runs the meeting.\n3. A one-room workflow beats a suite of best-of-breed tools.'}

${H('What would make us stop')}
- The problem is real but not frequent (users shrug after the first session).
- The work is already solved inside a tool the team cannot leave.
- We cannot reach the buyer without a sales team.

${H('How this register stays alive')}
1. Every Monday: 10 minutes, re-score, close what is dead.
2. Any new risk found in a meeting becomes a Signal of type **risk** and lands here.
3. When a risk fires, write what actually happened in the Decision Log — that is how the next estimate gets better.

${H('Evidence we already have')}
${evidence.map((e) => `- ${e}`).join('\n')}
`;
    case 'decision_log':
      return `# Decision Log — ${project}

> One line per decision, with the reason and the date. This is the document that stops the team re-litigating the same argument two weeks later.

${H('How to use it')}
- Log the **decision**, not the discussion.
- Always write the **why** and what we gave up (the trade-off).
- Never rewrite history: if a decision changes, add a new entry that supersedes the old one.
- Anything that costs more than a day of work needs an entry.

${H('Decisions')}
| Date | Decision | Why | Alternatives rejected | Owner | Revisit |
| --- | --- | --- | --- | --- | --- |
| ${d(-14)} | Solve **${statement}** before anything else | It is the only problem with evidence from more than one team | A generic meeting-notes tool | PM | After 5 interviews |
| ${d(-10)} | One room per product, not one workspace for everything | Context switching was the actual pain | Org-wide workspace | PM | Post-pilot |
| ${d(-7)} | Nine stages, fixed | The checklist is the retention mechanic; a blank canvas gets abandoned | Free-form projects | PM | Never |
| ${d(-5)} | Free tiers only for v0.1 | Zero procurement friction, proves value before cost | Paid infra from day one | Eng | At 25 teams |
| ${d(-2)} | Any one LLM key, built-in reasoner without one | The platform must never be dead on arrival | OpenAI-only | Eng | — |
| ${d(0)} | ${metric} is the launch metric | It moves weekly and needs no dashboard project | Feature count, NPS | PM | Monthly |

${H('Open questions that need a decision')}
1. Who signs off a launch — the room owner or the whole team?
2. Do we charge per seat or per active product room?
3. What do we do with a room that has been silent for 60 days?

${H('Decision template (copy this)')}
\`\`\`
Date:
Decision:
Why:
Alternatives rejected:
What it costs us:
Owner:
Revisit on:
\`\`\`

${H('Where decisions come from')}
Every message marked **Decision** in the meeting room is a candidate for this log. Prime surfaces them as signals; the PM promotes the real ones here.
`;
    case 'pricing':
      return `# Pricing & Packaging — ${project}

> What a team pays, when they start paying, and what they get for it. Free until the value is obvious.

${H('Principles')}
1. The pilot is free and always will be — no credit card to start.
2. Charge per **active product room**, not per seat: the value is the product, not the person.
3. Never charge for the thing that decides whether the product works (the problem engine, the docs).
4. Price against the cost of a wasted sprint, not against other tools.

${H('Packages')}
| Plan | Price | Who it is for | Includes | Limit |
| --- | --- | --- | --- | --- |
| Free | ₹0 | One team proving the workflow | 1 room, unlimited members, all 9 stages, built-in reasoner | 3 AI generations / day |
| Team | ₹1,500 / room / month | A team shipping continuously | Unlimited generations, export to PDF, history, priority support | 10 rooms |
| Studio | ₹6,000 / month | An agency or product studio | White-label, client read-only links, SSO on request | 40 rooms |
| Enterprise | Talk to us | Compliance-heavy orgs | Custom hosting, DPA, audit log | — |

${H('Why this shape')}
- A room is the unit of value: one product, one problem, one launch.
- Generations cost us money; seats do not. So we meter the thing that costs.
- Team plan pays for itself if it saves **one day of rework** a month.

${H('What we will not do')}
- No per-seat pricing that punishes inviting the team.
- No feature held hostage that the free plan needs to prove value.
- No annual lock-in in the first year.

${H('Launch offer')}
First 20 teams: 3 months of Team free, in exchange for a 20-minute call and permission to use the story. Tracked in the Decision Log.

${H('Numbers to verify before launch')}
- [ ] Cost per active room per month (DB + LLM).
- [ ] Willingness to pay: ask 5 pilot teams the price question directly.
- [ ] Break-even rooms at current infra cost.

${H('How we will charge')}
Razorpay or Stripe (free-tier friendly) with a manual invoice fallback for the first 10 customers. Nothing in the product blocks on billing in v0.1.
`;
    case 'release_notes':
      return `# Release Notes — ${project}

> Written for the person using the product, not for the person who wrote it. One screen, plain language, no internal ticket numbers.

${H('v0.1 — first release (${d(0)})')}
**What is new**
- One room per product: the meeting, the problem, the documents, the board and the tools in one place.
- The problem engine reads the conversation and proposes the real question, with confidence, assumptions and unknowns.
- Nine stages from Discover to Grow, each with a checklist, the documents that stage needs and the free tools for the job.
- Ask Prime answers from your own room — problem, documents, board, signals and stack.

**Fixed**
- Joining from a shared link no longer needs an account: name only.
- Exporting the product pack no longer drops documents with no owner.

**Known limits**
- Collaboration is a 14-second refresh, not live cursors yet.
- Voice capture is browser dictation, not a call bot.
- The built-in reasoner is rules-based; add an AI key for sharper drafts.

${H('How to tell users')}
| Channel | Message | Owner |
| --- | --- | --- |
| In-app banner | “Your room now keeps the problem, the plan and the launch in one place.” | PM |
| Email to pilots | Short note + 60-second Loom of one problem going from meeting to launch | Growth |
| LinkedIn / X | The before/after: notes → approved problem → shipped | Growth |
| Support macros | Answers to “where do I start?” and “can I import my Notion docs?” | QA |

${H('Template for the next release')}
\`\`\`
## vX.Y — <theme> (<date>)
**What is new** — one line per user-visible change.
**Improved** — what got faster, clearer or safer.
**Fixed** — the bug in the user's words.
**Known limits** — honest, with the workaround.
**Upgrade notes** — anything the user must do.
\`\`\`

${H('Checklist before publishing')}
- [ ] Every line is understandable without internal context.
- [ ] Screenshots or a 30-second clip for the headline feature.
- [ ] Support knows the answers before users ask.
- [ ] Changelog published in the room, not only on the marketing site.
`;
    default:
      return `# ${title} — ${project}

${H('Context')}
${statement}

${H('Why this document exists')}
The team is in the **${ctx.stageName}** stage. This artifact keeps the work anchored to the problem and gives every member the same next action.

${H('Plan')}
1. Confirm the problem statement is still accurate.
2. Assign an owner and a due date for each item below.
3. Ship the smallest visible result this week.

${H('Checklist')}
- [ ] Owner assigned
- [ ] Definition of done agreed
- [ ] Dependencies identified
- [ ] Review scheduled with the team

${H('Free tools')}
${stageTools}
`;
  }
}

export function generateProblemSummary(p: ProblemStatement): string {
  return `**${p.title}**\n\n${p.statement}\n\n_Confidence ${p.confidence}% · ${p.productType} · engine: ${p.engine}_`;
}
