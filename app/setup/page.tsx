import Link from 'next/link';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDashed, Database, KeyRound,
  Rocket, Sparkles, Server, ShieldCheck, Wrench,
} from 'lucide-react';
import { integrationSummary, integrations, type Integration } from '@/lib/integrations';
import { Logo, Pill } from '@/components/ui';

export const dynamic = 'force-dynamic';

const NEED_LABEL: Record<Integration['need'], { text: string; tone: 'rose' | 'amber' | 'slate' }> = {
  required: { text: 'Needed for a real team', tone: 'rose' },
  recommended: { text: 'Recommended', tone: 'amber' },
  optional: { text: 'Optional', tone: 'slate' },
};

const STATE_LABEL: Record<Integration['state'], { text: string; tone: 'mint' | 'amber' | 'slate'; icon: any }> = {
  on: { text: 'Connected', tone: 'mint', icon: CheckCircle2 },
  off: { text: 'Not set up', tone: 'slate', icon: CircleDashed },
  fallback: { text: 'Running on a fallback', tone: 'amber', icon: AlertTriangle },
};

const CATEGORY_ICON: Record<Integration['category'], any> = {
  Data: Database,
  Security: ShieldCheck,
  Deployment: Rocket,
  AI: Sparkles,
  'Room setup': Wrench,
  'Team tools': Server,
};

export default function SetupPage() {
  const all = integrations();
  const summary = integrationSummary();
  const categories = [...new Set(all.map((i) => i.category))];

  return (
    <main className="app-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <Link href="/" className="btn-subtle px-2 py-1.5" title="Back to the overview">
            <ArrowLeft className="h-3.5 w-3.5" /> Overview
          </Link>
          <div className="ml-2">
            <Logo size={26} />
          </div>
          <Pill tone={summary.requiredMissing ? 'amber' : 'mint'} className="ml-auto">
            {summary.requiredMissing ? `${summary.requiredMissing} setup item missing` : 'Production ready'}
          </Pill>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900">Setup &amp; access</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600">
          What the platform needs to run for a real team, what is already switched on, and what happens if you
          leave something off. Everything works today — the items marked <em>needed</em> are the ones that make it
          survive a redeploy with a team using it.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="panel p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Working now</div>
            <div className="mt-1 text-[22px] font-semibold text-slate-900">
              {summary.on}<span className="text-[13px] font-normal text-slate-500"> / {summary.total}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">integrations switched on</p>
          </div>
          <div className="panel p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fallbacks in use</div>
            <div className="mt-1 text-[22px] font-semibold text-slate-900">{summary.usingFallback.length}</div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {summary.usingFallback.length ? summary.usingFallback.join(', ') : 'none — everything is live'}
            </p>
          </div>
          <div className="panel p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Keys you must add</div>
            <div className="mt-1 text-[22px] font-semibold text-slate-900">{summary.requiredMissing}</div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {summary.requiredMissing ? 'see the red cards below' : 'nothing blocking a real team'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-electric/20 bg-electric/[0.04] p-4">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-mint" /> Works with zero setup
          </div>
          <ul className="mt-2 grid gap-1.5 text-[12px] leading-relaxed text-slate-600 sm:grid-cols-2">
            <li>• Both rooms open and seed themselves on first request.</li>
            <li>• Team members join from one link with just a name.</li>
            <li>• The problem engine, 30 documents, 48 tasks and 104 tools are built in.</li>
            <li>• Prime answers from the room using the built-in reasoner.</li>
            <li>• Tool wall, board, documents, signals and owner console are all editable.</li>
            <li>• Export downloads the whole product pack as a file.</li>
            <li>• Existing rooms pick up new document types automatically on the next request.</li>
          </ul>
        </div>

        {categories.map((cat) => {
          const Icon = CATEGORY_ICON[cat] ?? Wrench;
          return (
            <section key={cat} className="mt-7">
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Icon className="h-3.5 w-3.5 text-electric" /> {cat}
              </h2>
              <div className="space-y-2.5">
                {all.filter((i) => i.category === cat).map((i) => {
                  const state = STATE_LABEL[i.state];
                  const StateIcon = state.icon;
                  const need = NEED_LABEL[i.need];
                  return (
                    <div key={i.id} className="panel overflow-hidden p-0">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                        <span className="text-[13px] font-semibold text-slate-900">{i.name}</span>
                        <Pill tone={need.tone} className="!text-[9px]">{need.text}</Pill>
                        <Pill tone={state.tone} className="!text-[9px]">
                          <StateIcon className="h-2.5 w-2.5" /> {state.text}
                        </Pill>
                        {i.variable && (
                          <code className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600">
                            {i.variable}
                          </code>
                        )}
                      </div>
                      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-0.5 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            <CircleDashed className="h-2.5 w-2.5" /> If you leave it off
                          </div>
                          <p className="text-[11.5px] leading-relaxed text-slate-600">{i.without}</p>
                        </div>
                        <div>
                          <div className="mb-0.5 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            <Check className="h-2.5 w-2.5" /> What you get
                          </div>
                          <p className="text-[11.5px] leading-relaxed text-slate-600">{i.withIt}</p>
                        </div>
                      </div>
                      <details className="border-t border-slate-200 px-4 py-2">
                        <summary className="cursor-pointer list-none text-[11px] font-medium text-electric">
                          How to set it up <ArrowRight className="inline h-2.5 w-2.5" />
                        </summary>
                        <ol className="mt-1.5 space-y-1 pl-4 text-[11.5px] leading-relaxed text-slate-600">
                          {i.how.map((step, n) => (
                            <li key={n} className="list-decimal">{step}</li>
                          ))}
                        </ol>
                        {i.docs && (
                          <a
                            href={i.docs}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-electric hover:underline"
                          >
                            <KeyRound className="h-3 w-3" /> Official sign-up page
                          </a>
                        )}
                      </details>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="mt-7 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-mint" /> What we never ask you for
          </h2>
          <ul className="mt-2 grid gap-1.5 text-[11.5px] leading-relaxed text-slate-600 sm:grid-cols-2">
            <li>• No OAuth apps or client IDs for Figma, Notion, Slack or Linear.</li>
            <li>• No payment keys — there is nothing to charge for.</li>
            <li>• No paid plan required for any tool on the wall.</li>
            <li>• No access to your repositories or cloud accounts.</li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            The platform stores the workspace links you paste next to a tool, never credentials. Nothing on this page
            shows a secret — only whether it is set.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/" className="btn-ghost">Back to the overview</Link>
          <Link href="/live" className="btn-primary">
            Open the live room <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
