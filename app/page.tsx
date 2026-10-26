import Link from 'next/link';
import {
  ArrowRight, AudioLines, BadgeCheck, Blocks, Braces, CircleDollarSign, Database, Gauge,
  Github, Layers, Rocket, ShieldCheck, Sparkles, Users, Wand2, Zap, GitBranch, Globe2,
} from 'lucide-react';
import { stageAccent, STAGE_SEED, TOOL_SEED, ROLES, ROOM_CODES } from '@/lib/defaults';
import { Logo, Pill, StageIcon, ToolIcon, Wordmark } from '@/components/ui';

const LIVE_LINK = `/room/${ROOM_CODES.live}`;
const DEMO_LINK = `/room/${ROOM_CODES.demo}`;

const CATEGORY_ORDER = [
  'Meetings & Docs', 'Whiteboard & Ideation', 'Research & Validation', 'Design & Prototype',
  'Code & Repo', 'Database & Backend', 'Deploy & Infra', 'AI & Models', 'Payments & Auth',
  'Testing & QA', 'Analytics & Feedback', 'Growth & Launch', 'Project Management', 'Automation',
];

export default function LandingPage() {
  const wall = CATEGORY_ORDER.map((cat) => ({
    cat,
    tools: TOOL_SEED.filter((t) => t.category === cat).slice(0, 6),
  })).filter((g) => g.tools.length);

  const toolCount = TOOL_SEED.length;

  return (
    <main className="app-bg min-h-screen">
      {/* nav */}
      <header className="glass-bar sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Wordmark />
          <div className="flex items-center gap-1.5">
            <Link href="#lifecycle" className="btn-subtle hidden md:inline-flex">Lifecycle</Link>
            <Link href="#tools" className="btn-subtle hidden md:inline-flex">Tool wall</Link>
            <Link href="#owner" className="btn-subtle hidden md:inline-flex">Owner console</Link>
            <Link href="/setup" className="btn-subtle hidden md:inline-flex">Setup &amp; keys</Link>
            <Link href={LIVE_LINK} className="btn-primary">
              Open the live room <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 md:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            <div className="animate-fade-up">
              <div className="chip mb-5 text-slate-600">
                <Sparkles className="h-3.5 w-3.5" />
                Meeting IDE · AI problem extraction · 9 stages to launch
              </div>
              <h1 className="text-balance text-[34px] font-semibold leading-[1.12] tracking-[-0.025em] text-slate-900 md:text-[46px]">
                Your meeting should end with a product.
                <span className="block text-slate-500">
                  Not a note.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-slate-500">
                One room where the whole team talks, the copilot works out the <strong className="font-medium text-slate-800">actual problem
                statement</strong>, and every stage from ideation to deployment arrives with its documents, checklists and free
                tools already loaded — {toolCount}+ of them, icons side by side.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={LIVE_LINK} className="btn-primary px-5 py-3 text-[14px]">
                  <AudioLines className="h-4 w-4" /> Open your live workspace
                </Link>
                <Link href={DEMO_LINK} className="btn-ghost px-5 py-3 text-[14px]">
                  <Users className="h-4 w-4" /> Explore the demo room
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="h-3.5 w-3.5 text-mint" /> Free-tier stack, $0 fixed cost</span>
                <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-cyan" /> Share by link</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-amber" /> Owner-editable, no redeploys</span>
              </div>
            </div>

            {/* mock: conversation → problem */}
            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="panel relative overflow-hidden p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose/60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose" />
                    </span>
                    Monday kickoff · 4 people talking
                  </div>
                  <Pill tone="electric"><Sparkles className="h-3 w-3" /> listening</Pill>
                </div>
                <div className="space-y-2.5">
                  {[
                    ['Amar', 'pm', 'By Wednesday nobody agrees what we decided. The problem itself never gets written down.'],
                    ['Rohan', 'eng', 'Scope arrives as vibes. We rework 30% of every sprint.'],
                    ['Priya', 'design', "I'm in four tools before I draw one screen."],
                  ].map(([name, role, text]) => (
                    <div key={name} className="rounded-xl border border-slate-900/20 bg-white/60 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                        <span className="text-slate-800">{name}</span>
                        <span className="rounded bg-white/55 px-1 py-px text-[11px] uppercase tracking-wider text-slate-500">{role}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-slate-500">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="my-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-slate-900/10" />
                  <span className="chip border-indigo-200 bg-indigo-50 text-indigo-700">
                    <Wand2 className="h-3 w-3" /> problem extracted
                  </span>
                  <div className="h-px flex-1 bg-slate-900/10" />
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-indigo-700">The real question</span>
                    <span className="text-[12px] font-semibold text-mint">87% confidence</span>
                  </div>
                  <p className="text-[13px] font-medium leading-snug text-slate-900">
                    How might we help product teams turn an unstructured working session into a validated, buildable
                    product — without losing the thread between meeting and launch?
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {['product teams', 'hand-off tax', 'rework', 'one workspace'].map((t) => (
                      <span key={t} className="rounded-md bg-white/55 px-1.5 py-0.5 text-[12px] text-slate-500">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ['Docs', '18'],
                    ['Tools', String(toolCount)],
                    ['Stages', '9'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-slate-900/20 bg-white/60 px-2.5 py-2">
                      <div className="text-[16px] font-semibold text-slate-900">{v}</div>
                      <div className="text-[11px] uppercase tracking-[.08em] text-slate-500">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* problem engine */}
      <section className="border-t border-slate-900/10 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-10 max-w-2xl">
            <Pill tone="cyan"><Wand2 className="h-3 w-3" /> The problem engine</Pill>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900 md:text-[32px]">
              It listens like a product lead, not a stenographer.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
              Every message is read for pains, users, evidence, decisions, blockers and metrics. When the conversation has
              enough signal, the room proposes the one question the team should answer — with confidence, unknowns and the
              evidence attached. A human always approves it.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: AudioLines, title: 'Understand', body: 'Pains, users, numbers, decisions and open questions are extracted live from the room — typed, pasted or transcribed.', tone: '#0f766e' },
              { icon: Sparkles, title: 'Synthesise', body: 'The copilot weighs the signal, discards the loudest opinion and writes a real "How might we…" with a confidence score.', tone: '#4338ca' },
              { icon: Blocks, title: 'Operationalise', body: 'Once approved, the problem becomes the spine: PRDs, scope, architecture, tests and launch copy all build against it.', tone: '#b45309' },
            ].map((f) => (
              <div key={f.title} className="panel card-hover p-5">
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg border border-slate-900/10" style={{ background: `${f.tone}12`, color: f.tone }}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[16px] font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* lifecycle */}
      <section id="lifecycle" className="border-t border-slate-900/10 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Pill tone="electric"><Layers className="h-3 w-3" /> Nine stages, one thread</Pill>
              <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900 md:text-[32px]">
                Ideation to deployment, in order.
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
                Each stage carries its own documents, checklist, board tasks and free tools. Nothing is skipped, and the
                lifecycle can be renamed, reordered or extended by the owner.
              </p>
            </div>
            <Link href={DEMO_LINK} className="btn-ghost">
              See a worked example <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAGE_SEED.map((s, idx) => (
              <div key={s.key} className="panel card-hover group relative overflow-hidden p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-900/10"
                    style={{ background: `${stageAccent(s.color)}12`, color: stageAccent(s.color) }}
                  >
                    <StageIcon name={s.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold tabular-nums text-slate-500">0{idx + 1}</span>
                      <h3 className="text-[14px] font-semibold text-slate-900">{s.name}</h3>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{s.tagline}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {s.checklist.slice(0, 2).map((c) => (
                        <span key={c} className="rounded bg-white/70 px-1.5 py-0.5 text-[12px] text-slate-500">
                          {c.length > 34 ? `${c.slice(0, 33)}…` : c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* tool wall */}
      <section id="tools" className="border-t border-slate-900/10 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-9 max-w-2xl">
            <Pill tone="mint"><Blocks className="h-3 w-3" /> {toolCount}+ free tools</Pill>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900 md:text-[32px]">
              The whole stack, visible at a glance.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
              Every tool below has a genuinely usable free tier and is mapped to the stage where it belongs. The owner can
              add, retire or rename any tile from inside the platform.
            </p>
          </div>
          <div className="space-y-5">
            {wall.map((group) => (
              <div key={group.cat}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">{group.cat}</span>
                  <div className="h-px flex-1 bg-white/55" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {group.tools.map((t) => (
                    <a
                      key={`${group.cat}-${t.name}`}
                      href={t.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="panel-flat card-hover flex items-center gap-2.5 p-2.5"
                    >
                      <ToolIcon name={t.name} color={t.color} size={30} rounded={8} />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-slate-800">{t.name}</div>
                        <div className="truncate text-[12px] text-slate-500">{t.free_tier.replace(' free', '')}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* roles */}
      <section className="border-t border-slate-900/10 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <Pill tone="amber"><Users className="h-3 w-3" /> Everyone in the same room</Pill>
              <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900 md:text-[30px]">
                Built for the whole product team.
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
                One link, role-aware access. Everyone sees the same problem, the same plan and the same next action —
                with live presence so nobody repeats the meeting.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="chip"><ShieldCheck className="h-3 w-3 text-mint" /> Owner keeps edit rights</span>
                <span className="chip"><Gauge className="h-3 w-3 text-amber" /> Live presence</span>
                <span className="chip"><GitBranch className="h-3 w-3 text-cyan" /> One thread of truth</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((r) => (
                <div key={r.key} className="panel-flat card-hover flex items-start gap-3 p-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-900/20 bg-white/60 text-slate-600">
                    <Braces className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">{r.label}</div>
                    <div className="text-[13px] leading-relaxed text-slate-500">{r.blurb}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* owner console + deploy */}
      <section id="owner" className="border-t border-slate-900/10 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 lg:grid-cols-2">
          <div className="panel relative overflow-hidden p-6">
            <Pill tone="amber"><ShieldCheck className="h-3 w-3" /> Owner access</Pill>
            <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-slate-900">
              Amar, the platform is yours to maintain.
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Unlock the owner console with a passcode. Edit stages, checklists, icons and colours. Add or retire tools
              with their free-tier notes and links. Everything is stored in Postgres — no code changes, no redeploy.
            </p>
            <ul className="mt-4 space-y-2 text-[13px] text-slate-600">
              {[
                'Rename, reorder, disable or add lifecycle stages',
                'Edit each stage checklist that becomes board tasks',
                'Add any tool: name, icon colour, category, free tier, URL',
                'Approve or rewrite the problem statement and keep history',
                'Manage the team, roles and who can edit',
              ].map((li) => (
                <li key={li} className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" /> {li}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-6">
            <Pill tone="electric"><Rocket className="h-3 w-3" /> Ships on free infrastructure</Pill>
            <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-slate-900">Vercel + Neon, by design.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Deploy the repo to Vercel, paste a Neon connection string, add one AI key (or none) and you are live.
              Locally it runs on an embedded Postgres with zero setup.
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                { icon: Github, title: 'Push the repo', body: 'Main branch is always deployable; every PR gets a preview URL.', tag: 'GitHub' },
                { icon: Database, title: 'Paste DATABASE_URL', body: 'Neon Postgres. Tables are created on first boot.', tag: 'Neon' },
                { icon: Wand2, title: 'Optional AI key', body: 'Gemini, Groq, OpenAI, Anthropic or OpenRouter. Without one, the built-in reasoner runs.', tag: 'AI' },
                { icon: Zap, title: 'Share the link', body: 'Team joins with a name and a role. Owner unlocks admin with a passcode.', tag: 'Live' },
              ].map((s) => (
                <div key={s.title} className="panel-flat flex items-start gap-3 p-3">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-900">{s.title}</span>
                      <span className="rounded bg-white/55 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-500">{s.tag}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-500">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* access checklist */}
      <section id="access" className="border-t border-slate-900/10 py-14">
        <div className="mx-auto max-w-5xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/[0.08] px-2.5 py-1 text-[12px] font-medium text-mint">
                <ShieldCheck className="h-3 w-3" /> Works today, with or without keys
              </div>
              <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900">What you need to give us</h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                Two values for a real team, one optional key for sharper AI, and no OAuth apps at all. The
                in-app checklist shows what is already connected.
              </p>
            </div>
            <Link href="/setup" className="btn-ghost">
              Open the checklist <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 grid gap-2.5 md:grid-cols-3">
            {[
              {
                icon: Database,
                tag: 'Needed',
                tone: 'text-rose',
                title: 'Neon database URL',
                body: 'DATABASE_URL — without it, data resets when the serverless instance restarts.',
              },
              {
                icon: ShieldCheck,
                tag: 'Needed',
                tone: 'text-rose',
                title: 'Session secret',
                body: 'AUTH_SECRET — a long random string, so people stay signed in after a deploy.',
              },
              {
                icon: Sparkles,
                tag: 'Optional',
                tone: 'text-amber',
                title: 'One AI key',
                body: 'Gemini, Groq, OpenAI, Anthropic or OpenRouter. Free tiers exist; without a key Prime uses the built-in reasoner.',
              },
            ].map((x) => (
              <div key={x.title} className="panel-flat p-3.5">
                <div className="flex items-center gap-2">
                  <x.icon className={`h-4 w-4 ${x.tone}`} />
                  <span className="text-[13px] font-semibold text-slate-900">{x.title}</span>
                  <span className="ml-auto rounded bg-white/55 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                    {x.tag}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{x.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] text-slate-500">
            Not needed: OAuth apps for Figma, Notion, Slack or Linear · payment keys · paid plans · repo or cloud access.
          </p>
        </div>
      </section>

      {/* cta */}
      <section className="border-t border-slate-900/10 py-20">
        <div className="mx-auto max-w-3xl px-5 text-center">
          
          <h2 className="text-[26px] font-semibold tracking-tight text-slate-900 md:text-[32px]">
            Stop taking notes. Start shipping.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-slate-500">
            Open the room, invite the team, and leave the meeting with an approved problem statement, a plan and a URL.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={LIVE_LINK} className="btn-primary px-5 py-3 text-[14px]">
              <Sparkles className="h-4 w-4" /> Open the live workspace
            </Link>
            <Link href={DEMO_LINK} className="btn-ghost px-5 py-3 text-[14px]">
              Walk through the demo first
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-[12px] text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Link href="/"><Wordmark compact /></Link>
            <span className="ml-1 hidden text-slate-300 sm:inline">·</span>
            <span className="hidden sm:inline">built for Amar Tripathi&apos;s team</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={LIVE_LINK} className="hover:text-slate-900">Live workspace</Link>
            <span>·</span>
            <Link href={DEMO_LINK} className="hover:text-slate-900">Demo room</Link>
            <span>·</span>
            <Link href="/setup" className="hover:text-slate-900">Setup &amp; keys</Link>
            <span>·</span>
            <span>Vercel + Neon</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
