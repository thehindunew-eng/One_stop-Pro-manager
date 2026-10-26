import type { Stage, StageKey, Tool } from './types';

export const STAGE_SEED: Stage[] = [
  {
    key: 'discover',
    name: 'Discover',
    tagline: 'Understand the real problem, the people who feel it and the evidence behind it.',
    icon: 'Compass',
    color: '#0e7490',
    position: 1,
    enabled: true,
    checklist: [
      'Run the meeting and let the copilot extract the problem statement',
      'Approve the problem question with the team',
      'Write 5–8 interview questions and talk to 3 real users',
      'Capture evidence: numbers, quotes, frequency of the pain',
      'Write the competitive analysis: what buyers compare us to',
      'Decide: is this worth building now?',
    ],
  },
  {
    key: 'define',
    name: 'Define',
    tagline: 'Turn the problem into a scoped, testable product brief everyone agrees on.',
    icon: 'ClipboardList',
    color: '#4338ca',
    position: 2,
    enabled: true,
    checklist: [
      'Write the one-page PRD (problem, users, jobs, non-goals)',
      'Define personas and the job-to-be-done',
      'Cut scope to a 2-week MVP with explicit non-goals',
      'Pick the single success metric for launch',
      'Set the dated roadmap and the risk register',
      'Get written sign-off from the team',
    ],
  },
  {
    key: 'ideate',
    name: 'Ideate',
    tagline: 'Explore solution angles, kill weak ones and pick the smallest thing that proves value.',
    icon: 'Lightbulb',
    color: '#b45309',
    position: 3,
    enabled: true,
    checklist: [
      'Generate 5+ solution concepts without judging',
      'Score each on impact, effort and risk',
      'Choose the concept and write the solution brief',
      'Map the happy path and the top 3 failure paths',
      'Pre-mortem: what would make this fail in 30 days?',
    ],
  },
  {
    key: 'design',
    name: 'Design',
    tagline: 'Make it usable: flows, wireframes, design system and a landing page that sells it.',
    icon: 'Palette',
    color: '#be123c',
    position: 4,
    enabled: true,
    checklist: [
      'Map the core user flow in one diagram',
      'Wireframe the 3 key screens',
      'Set the design system (type, color, spacing, components)',
      'Clickable prototype reviewed by 3 people',
      'Draft the landing page hero copy',
    ],
  },
  {
    key: 'architect',
    name: 'Architect',
    tagline: 'Choose a free-tier stack that ships now and scales without a rewrite.',
    icon: 'Boxes',
    color: '#6d28d9',
    position: 5,
    enabled: true,
    checklist: [
      'Lock the stack: framework, database, hosting, auth',
      'Model the data (entities, keys, relations)',
      'Spec the API contracts you need on day one',
      'Define environments, secrets and branching',
      'Write the deployment runbook',
    ],
  },
  {
    key: 'build',
    name: 'Build',
    tagline: 'Ship the MVP in weekly slices with a board, a repo and an AI pair.',
    icon: 'Code2',
    color: '#047857',
    position: 6,
    enabled: true,
    checklist: [
      'Create the repo and run the first deploy today',
      'Break the MVP into sprint-sized tasks on the board',
      'Build vertical slices: database → API → UI',
      'Keep main always deployable (preview per PR)',
      'Demo every Friday, ship something weekly',
    ],
  },
  {
    key: 'test',
    name: 'Test',
    tagline: 'Prove it works, prove it is safe, and prove real users can complete the job.',
    icon: 'FlaskConical',
    color: '#0369a1',
    position: 7,
    enabled: true,
    checklist: [
      'Write the test plan (unit, E2E, manual)',
      'Cover the 5 flows that must never break',
      'Usability test with 5 real users',
      'Fix P0/P1 bugs before launch',
      'Run the accessibility and security pass',
    ],
  },
  {
    key: 'launch',
    name: 'Launch',
    tagline: 'Deploy to the world with a story, a channel plan and a rollback plan.',
    icon: 'Rocket',
    color: '#c2410c',
    position: 8,
    enabled: true,
    checklist: [
      'Deploy to production on a real domain',
      'Publish the landing page and launch assets',
      'Instrument analytics and the success metric',
      'Agree pricing and write the release notes',
      'Prepare support, status and rollback',
      'Post the launch story on 3 channels',
    ],
  },
  {
    key: 'grow',
    name: 'Grow',
    tagline: 'Measure what matters, learn from users and decide the next bet.',
    icon: 'TrendingUp',
    color: '#0f766e',
    position: 9,
    enabled: true,
    checklist: [
      'Review the success metric weekly',
      'Run a feedback loop (in-app, calls, community)',
      'Fix the biggest drop-off in the funnel',
      'Decide: double down, pivot or kill',
      'Publish a public changelog',
    ],
  },
];

export const ARTIFACT_BLUEPRINTS: Record<
  StageKey,
  { kind: string; title: string; hint: string }[]
> = {
  discover: [
    { kind: 'problem_canvas', title: 'Problem Canvas', hint: 'Who, what, why, evidence and constraints' },
    { kind: 'interview_guide', title: 'User Interview Guide', hint: 'Questions that uncover real behaviour' },
    { kind: 'research_plan', title: 'Research & Validation Plan', hint: 'How to prove the problem in 5 days' },
    { kind: 'competitive_analysis', title: 'Competitive Analysis', hint: 'What buyers compare us to, including doing nothing' },
  ],
  define: [
    { kind: 'prd', title: 'Product Requirements (PRD)', hint: 'The one-page contract for the team' },
    { kind: 'personas', title: 'Personas & Jobs To Be Done', hint: 'The humans behind the problem' },
    { kind: 'mvp_scope', title: 'MVP Scope & Non-Goals', hint: 'What ships in v0.1 and what waits' },
    { kind: 'roadmap', title: 'Roadmap & Milestones', hint: 'Dated milestones with exit criteria' },
    { kind: 'risk_register', title: 'Risk Register', hint: 'What could stop us, owned and reviewed' },
    { kind: 'decision_log', title: 'Decision Log', hint: 'Every decision, the reason and when to revisit' },
  ],
  ideate: [
    { kind: 'concepts', title: 'Solution Concepts (scored)', hint: 'Five directions, ranked' },
    { kind: 'solution_brief', title: 'Chosen Solution Brief', hint: 'The bet, the wedge and the risk' },
  ],
  design: [
    { kind: 'ux_flows', title: 'User Flows & Wireframe Plan', hint: 'Screen by screen, path by path' },
    { kind: 'design_system', title: 'Design System Starter', hint: 'Type, colour, spacing and components' },
    { kind: 'landing_wireframe', title: 'Landing Page Blueprint', hint: 'Hero, proof and call to action' },
  ],
  architect: [
    { kind: 'tech_stack', title: 'Free-Tier Tech Stack', hint: 'Ship today, scale later' },
    { kind: 'data_model', title: 'Data Model', hint: 'Entities, keys and relations' },
    { kind: 'api_spec', title: 'API Contracts', hint: 'The endpoints v0.1 needs' },
  ],
  build: [
    { kind: 'repo_plan', title: 'Repository & Sprint Plan', hint: 'Repo layout and weekly slices' },
    { kind: 'devops', title: 'Deployment Runbook', hint: 'Vercel + Neon, step by step' },
    { kind: 'engineering_standards', title: 'Engineering Standards', hint: 'Definition of done and review rules' },
  ],
  test: [
    { kind: 'test_plan', title: 'Test Plan', hint: 'What to test and how' },
    { kind: 'qa_checklist', title: 'Release QA Checklist', hint: 'Nothing ships without these' },
  ],
  launch: [
    { kind: 'gtm_plan', title: 'Go-To-Market Plan', hint: 'Story, channels and the first 100 users' },
    { kind: 'landing_copy', title: 'Landing Page Copy', hint: 'Words that convert' },
    { kind: 'launch_checklist', title: 'Launch Day Checklist', hint: 'T-minus, deploy and announce' },
    { kind: 'pricing', title: 'Pricing & Packaging', hint: 'Plans, the price question and what stays free' },
    { kind: 'release_notes', title: 'Release Notes', hint: 'The launch written for the user, not the team' },
  ],
  grow: [
    { kind: 'metrics_plan', title: 'Metrics & Learning Plan', hint: 'The numbers that decide the next bet' },
    { kind: 'feedback_loop', title: 'Feedback Loop & Roadmap', hint: 'How the product keeps learning' },
  ],
};

/**
 * A stage exit criterion. Machine-checkable kinds read the room; `manual` is a
 * confirmation only the team can give. Shared by the seed and the editor.
 */
export type GateRuleSeed =
  | { kind: 'problem_approved'; label?: string }
  | { kind: 'evidence'; min: number; label?: string }
  | { kind: 'decisions'; min: number; label?: string }
  | { kind: 'artifact'; ref: string; level?: 'filled' | 'ready'; label?: string }
  | { kind: 'tasks'; minPct: number; label?: string }
  | { kind: 'owners'; min: number; label?: string }
  | { kind: 'tools'; min: number; label?: string }
  | { kind: 'manual'; id: string; label: string };

export const ROLE_LABELS: Record<string, string> = {
  pm: 'Product Manager',
  design: 'Product Designer',
  eng: 'Engineer',
  qa: 'QA / Tester',
  growth: 'Growth / Marketing',
  member: 'Team Member',
};

export const ROLES: { key: string; label: string; blurb: string }[] = [
  { key: 'pm', label: 'Product Manager', blurb: 'Owns the problem, scope and launch' },
  { key: 'design', label: 'Product Designer', blurb: 'Flows, interface and usability' },
  { key: 'eng', label: 'Engineer', blurb: 'Architecture, build and deploy' },
  { key: 'qa', label: 'QA / Tester', blurb: 'Quality, edge cases and release' },
  { key: 'growth', label: 'Growth / Marketing', blurb: 'Story, channels and adoption' },
  { key: 'member', label: 'Team Member', blurb: 'Collaborate across the board' },
];

const T = (
  name: string,
  slug: string,
  category: string,
  stages: string,
  url: string,
  color: string,
  free_tier: string,
  description: string,
): Omit<Tool, 'id' | 'sort' | 'enabled'> => ({
  name,
  slug,
  category,
  stages: stages.split(',') as StageKey[],
  url,
  color,
  free_tier,
  description,
});

/** Curated catalogue of genuinely free-to-start tools mapped to the product lifecycle. */
export const TOOL_SEED: Omit<Tool, 'id' | 'sort' | 'enabled'>[] = [
  // Meetings, notes & docs
  T('Zoom', 'zoom', 'Meetings & Docs', 'discover,define', 'https://zoom.us', '2D8CFF', '40 min / meeting free', 'Run the discovery meeting with recording.'),
  T('Google Meet', 'googlemeet', 'Meetings & Docs', 'discover,define', 'https://meet.google.com', '00897B', '60 min group calls', 'Zero-setup team calls with live captions.'),
  T('Slack', 'slack', 'Meetings & Docs', 'discover,define,ideate,build,test,launch,grow', 'https://slack.com', '4A154B', 'Free plan, 90-day history', 'Team channel, standups and launch room.'),
  T('Discord', 'discord', 'Meetings & Docs', 'discover,ideate,grow', 'https://discord.com', '5865F2', 'Unlimited free', 'Community, voice rooms and user feedback.'),
  T('Notion', 'notion', 'Meetings & Docs', 'discover,define,ideate,architect,launch,grow', 'https://notion.so', '000000', 'Free for personal + small teams', 'Wiki, PRD and decision log.'),
  T('Google Docs', 'googledocs', 'Meetings & Docs', 'discover,define,architect', 'https://docs.google.com', '4285F4', 'Free with Google account', 'Live co-writing for briefs and specs.'),
  T('Google Sheets', 'googlesheets', 'Meetings & Docs', 'discover,define,test,grow', 'https://sheets.google.com', '34A853', 'Free with Google account', 'Interview tracker, backlog and metrics.'),
  T('Google Forms', 'googleforms', 'Research & Validation', 'discover,test,grow', 'https://forms.google.com', '7248B9', 'Unlimited free', 'Survey real users in minutes.'),
  T('Tally', 'tally', 'Research & Validation', 'discover,test', 'https://tally.so', '000000', 'Unlimited forms, free', 'Beautiful forms without a paywall.'),
  T('Typeform', 'typeform', 'Research & Validation', 'discover,test', 'https://typeform.com', '262627', '10 responses / month', 'Conversational surveys that get completed.'),
  T('Loom', 'loom', 'Meetings & Docs', 'discover,define,design,launch', 'https://loom.com', '625DF5', '25 videos, 5 min each', 'Async walkthroughs and user feedback clips.'),
  T('Miro', 'miro', 'Whiteboard & Ideation', 'discover,define,ideate', 'https://miro.com', '050038', '3 boards free', 'Problem framing and idea clusters.'),
  T('Excalidraw', 'excalidraw', 'Whiteboard & Ideation', 'ideate,design,architect', 'https://excalidraw.com', '6965DB', 'Unlimited free', 'Fast hand-drawn flows and architecture sketches.'),
  T('Whimsical', 'whimsical', 'Whiteboard & Ideation', 'ideate,design', 'https://whimsical.com', '7B61FF', '3 free boards', 'Flowcharts and wireframes in one place.'),
  T('Mermaid', 'mermaid', 'Whiteboard & Ideation', 'architect,build', 'https://mermaid.js.org', 'FF3670', 'Open source', 'Diagrams as code, versioned with the repo.'),
  T('Reddit', 'reddit', 'Research & Validation', 'discover,grow', 'https://reddit.com', 'FF4500', 'Free', 'Where users already complain about the problem.'),
  T('Product Hunt', 'producthunt', 'Growth & Launch', 'launch,grow', 'https://producthunt.com', 'DA552F', 'Free to launch', 'Launch day traffic and early adopters.'),
  T('YouTube', 'youtube', 'Growth & Launch', 'launch,grow', 'https://youtube.com', 'FF0000', 'Free uploads', 'Demo video and tutorials.'),
  T('LinkedIn', 'linkedin', 'Growth & Launch', 'launch,grow', 'https://linkedin.com', '0A66C2', 'Free', 'Founder story and B2B distribution.'),
  T('X', 'x', 'Growth & Launch', 'launch,grow', 'https://x.com', '000000', 'Free', 'Build in public and launch thread.'),
  T('Substack', 'substack', 'Growth & Launch', 'launch,grow', 'https://substack.com', 'FF6719', 'Free publishing', 'Own the audience with a newsletter.'),
  T('Hashnode', 'hashnode', 'Growth & Launch', 'launch,grow', 'https://hashnode.com', '2962FF', 'Free blog + domain', 'SEO content for the problem you solve.'),
  T('Buffer', 'buffer', 'Growth & Launch', 'launch,grow', 'https://buffer.com', '231F20', '3 channels free', 'Schedule the launch week.'),
  T('Mailchimp', 'mailchimp', 'Growth & Launch', 'launch,grow', 'https://mailchimp.com', 'FFE01B', '500 contacts free', 'Waitlist and launch email.'),
  T('Brevo', 'brevo', 'Growth & Launch', 'launch,grow', 'https://brevo.com', '0B996E', '300 emails / day', 'Transactional and campaign email.'),
  T('Resend', 'resend', 'Deploy & Infra', 'build,launch', 'https://resend.com', '000000', '3,000 emails / month', 'Product email with a clean API.'),

  // Design
  T('Figma', 'figma', 'Design & Prototype', 'ideate,design,test', 'https://figma.com', 'F24E1E', '3 files free', 'Wireframes, UI and clickable prototypes.'),
  T('FigJam', 'figma', 'Whiteboard & Ideation', 'discover,define,ideate', 'https://figma.com/figjam', 'A259FF', 'Included in Figma free', 'Meeting boards that live next to the design.'),
  T('Penpot', 'penpot', 'Design & Prototype', 'design', 'https://penpot.app', '31EFB8', 'Open source, unlimited', 'Design tool you can self-host.'),
  T('Canva', 'canva', 'Design & Prototype', 'design,launch', 'https://canva.com', '00C4CC', 'Free tier', 'Launch graphics and social assets.'),
  T('Framer', 'framer', 'Design & Prototype', 'design,launch', 'https://framer.com', '0055FF', 'Free site on framer.website', 'Publish a real marketing site visually.'),
  T('Webflow', 'webflow', 'Design & Prototype', 'launch,grow', 'https://webflow.com', '4353FF', 'Free staging + subdomain', 'No-code production website.'),
  T('Unsplash', 'unsplash', 'Design & Prototype', 'design,launch', 'https://unsplash.com', '000000', 'Free license', 'Photography for the landing page.'),
  T('Google Fonts', 'googlefonts', 'Design & Prototype', 'design', 'https://fonts.google.com', '4285F4', 'Free', 'Type pairing for the design system.'),
  T('Lucide', 'lucide', 'Design & Prototype', 'design,build', 'https://lucide.dev', 'F56565', 'Open source', 'Consistent icon set for the UI.'),
  T('Storybook', 'storybook', 'Design & Prototype', 'design,build,test', 'https://storybook.js.org', 'FF4785', 'Open source', 'Build and review components in isolation.'),
  T('Coolors', 'coolors', 'Design & Prototype', 'design', 'https://coolors.co', '000000', 'Free generator', 'Lock the palette fast.'),
  T('Spline', 'spline', 'Design & Prototype', 'design', 'https://spline.design', 'FF5B5B', 'Free tier', '3D touches for the landing page.'),

  // Code, AI, data
  T('GitHub', 'github', 'Code & Repo', 'architect,build,test,launch', 'https://github.com', '181717', 'Unlimited private repos', 'Repo, issues, reviews and Actions.'),
  T('VS Code', 'visualstudiocode', 'Code & Repo', 'build', 'https://code.visualstudio.com', '007ACC', 'Free', 'Editor with AI assistants built in.'),
  T('Replit', 'replit', 'Code & Repo', 'build', 'https://replit.com', 'F26207', 'Free starter workspace', 'Write and run code from the browser.'),
  T('CodeSandbox', 'codesandbox', 'Code & Repo', 'build', 'https://codesandbox.io', '151515', 'Free sandboxes', 'Share a running prototype by URL.'),
  T('StackBlitz', 'stackblitz', 'Code & Repo', 'build', 'https://stackblitz.com', '1389FD', 'Free', 'Instant full-stack dev in the browser.'),
  T('Next.js', 'nextdotjs', 'Code & Repo', 'architect,build', 'https://nextjs.org', '000000', 'Open source', 'Full-stack React framework, deploys anywhere.'),
  T('React', 'react', 'Code & Repo', 'architect,build', 'https://react.dev', '61DAFB', 'Open source', 'Component model for the product UI.'),
  T('TypeScript', 'typescript', 'Code & Repo', 'architect,build', 'https://typescriptlang.org', '3178C6', 'Open source', 'Types that keep a small team honest.'),
  T('Tailwind CSS', 'tailwindcss', 'Code & Repo', 'design,build', 'https://tailwindcss.com', '06B6D4', 'Open source', 'Ship a design system without CSS debt.'),
  T('Node.js', 'nodedotjs', 'Code & Repo', 'architect,build', 'https://nodejs.org', '5FA04E', 'Open source', 'Runtime for API and tooling.'),
  T('Python', 'python', 'Code & Repo', 'architect,build', 'https://python.org', '3776AB', 'Open source', 'Data, scripts and ML services.'),
  T('OpenAI', 'openai', 'AI & Models', 'ideate,build,grow', 'https://platform.openai.com', '412991', 'Pay-as-you-go', 'Copilot, extraction and generation.'),
  T('Anthropic', 'anthropic', 'AI & Models', 'ideate,build', 'https://anthropic.com', '191919', 'Pay-as-you-go', 'Long-context reasoning for product docs.'),
  T('Google Gemini', 'googlegemini', 'AI & Models', 'ideate,build', 'https://ai.google.dev', '8E75B2', 'Generous free tier', 'Fast, cheap multimodal model access.'),
  T('Groq', 'groq', 'AI & Models', 'build', 'https://groq.com', 'F55036', 'Free dev tier', 'Ultra-fast inference for live copilots.'),
  T('Ollama', 'ollama', 'AI & Models', 'build', 'https://ollama.com', '000000', 'Free, local', 'Run open models on your own machine.'),
  T('Hugging Face', 'huggingface', 'AI & Models', 'build,grow', 'https://huggingface.co', 'FFD21E', 'Free tier', 'Models, datasets and Spaces demos.'),
  T('LangChain', 'langchain', 'AI & Models', 'build', 'https://langchain.com', '1C3C3C', 'Open source', 'Agents, RAG and tool calling.'),
  T('Pinecone', 'pinecone', 'AI & Models', 'build', 'https://pinecone.io', '000000', 'Free starter index', 'Vector search for product context.'),
  T('Neon', 'neon', 'Database & Backend', 'architect,build,launch', 'https://neon.tech', '00E599', 'Free tier + branching', 'Serverless Postgres for the product.'),
  T('Supabase', 'supabase', 'Database & Backend', 'architect,build,launch', 'https://supabase.com', '3FCF8E', '2 free projects', 'Postgres, auth, storage and realtime.'),
  T('PostgreSQL', 'postgresql', 'Database & Backend', 'architect,build', 'https://postgresql.org', '4169E1', 'Open source', 'The default database for a reason.'),
  T('Prisma', 'prisma', 'Database & Backend', 'architect,build', 'https://prisma.io', '2D3748', 'Open source', 'Typed schema and migrations.'),
  T('Drizzle', 'drizzle', 'Database & Backend', 'architect,build', 'https://orm.drizzle.team', 'C5F74F', 'Open source', 'SQL-first TypeScript ORM.'),
  T('MongoDB', 'mongodb', 'Database & Backend', 'architect,build', 'https://mongodb.com', '47A248', '512 MB free cluster', 'Document store for flexible data.'),
  T('Firebase', 'firebase', 'Database & Backend', 'architect,build', 'https://firebase.google.com', 'FFCA28', 'Spark plan free', 'Realtime sync, auth and hosting.'),
  T('Redis', 'redis', 'Database & Backend', 'architect,build', 'https://redis.io', 'DC382D', '30 MB free cloud', 'Cache, queues and rate limits.'),
  T('Vercel', 'vercel', 'Deploy & Infra', 'architect,build,test,launch', 'https://vercel.com', '000000', 'Hobby: free deploys + previews', 'Ship every PR to a preview URL.'),
  T('Netlify', 'netlify', 'Deploy & Infra', 'launch,grow', 'https://netlify.com', '00C7B7', 'Free 100 GB bandwidth', 'Static hosting and forms.'),
  T('Cloudflare', 'cloudflare', 'Deploy & Infra', 'launch,grow', 'https://cloudflare.com', 'F38020', 'Free DNS + CDN + Pages', 'Domain, CDN, Workers and R2.'),
  T('Railway', 'railway', 'Deploy & Infra', 'build', 'https://railway.app', '0B0D0E', 'Trial credit', 'Deploy a backend in one click.'),
  T('Render', 'render', 'Deploy & Infra', 'build', 'https://render.com', '000000', 'Free web services', 'Cron jobs and background workers.'),
  T('Fly.io', 'flydotio', 'Deploy & Infra', 'build,launch', 'https://fly.io', '24175B', 'Free allowance', 'Run containers close to users.'),
  T('Docker', 'docker', 'Deploy & Infra', 'architect,build', 'https://docker.com', '2496ED', 'Free', 'Reproducible environments.'),
  T('GitHub Actions', 'githubactions', 'Deploy & Infra', 'build,test,launch', 'https://github.com/features/actions', '2088FF', '2,000 min / month', 'CI/CD without another vendor.'),
  T('Clerk', 'clerk', 'Payments & Auth', 'architect,build', 'https://clerk.com', '6C47FF', '10,000 MAU free', 'Drop-in auth and user management.'),
  T('Auth0', 'auth0', 'Payments & Auth', 'architect,build', 'https://auth0.com', 'EB5424', '25,000 MAU free', 'OAuth, SSO and social login.'),
  T('Stripe', 'stripe', 'Payments & Auth', 'build,launch,grow', 'https://stripe.com', '635BFF', 'No monthly fee, test mode free', 'Payments and subscriptions.'),
  T('Razorpay', 'razorpay', 'Payments & Auth', 'build,launch', 'https://razorpay.com', '0C2451', 'Test mode free', 'Payments for India, UPI included.'),
  T('Lemon Squeezy', 'lemonsqueezy', 'Payments & Auth', 'launch', 'https://lemonsqueezy.com', 'FFC233', 'No monthly fee', 'Merchant of record for global sales.'),
  T('Postman', 'postman', 'Testing & QA', 'architect,test', 'https://postman.com', 'FF6C37', 'Free plan', 'Explore and document the API.'),
  T('OpenAPI', 'openapiinitiative', 'Testing & QA', 'architect', 'https://openapis.org', '6BA539', 'Open standard', 'Contract-first API spec.'),
  T('Playwright', 'playwright', 'Testing & QA', 'test,build', 'https://playwright.dev', '2EAD33', 'Open source', 'End-to-end tests that catch real breaks.'),
  T('Cypress', 'cypress', 'Testing & QA', 'test', 'https://cypress.io', '69D3A7', 'Open source', 'Browser test runner with great DX.'),
  T('Vitest', 'vitest', 'Testing & QA', 'test', 'https://vitest.dev', '6E9F18', 'Open source', 'Unit tests at Vite speed.'),
  T('Sentry', 'sentry', 'Testing & QA', 'test,launch,grow', 'https://sentry.io', '362D59', '5k errors / month free', 'Catch production errors before users report them.'),
  T('Lighthouse', 'lighthouse', 'Testing & QA', 'test,launch', 'https://developer.chrome.com/docs/lighthouse', 'F44B21', 'Free', 'Performance, a11y and SEO audit.'),
  T('PostHog', 'posthog', 'Analytics & Feedback', 'launch,grow', 'https://posthog.com', '000000', '1M events / month free', 'Product analytics, funnels, session replay.'),
  T('Mixpanel', 'mixpanel', 'Analytics & Feedback', 'launch,grow', 'https://mixpanel.com', '7856FF', '20M events free', 'Behavioural analytics and cohorts.'),
  T('Plausible', 'plausibleanalytics', 'Analytics & Feedback', 'launch,grow', 'https://plausible.io', '405AFF', '30-day trial', 'Privacy-friendly traffic analytics.'),
  T('Google Analytics', 'googleanalytics', 'Analytics & Feedback', 'launch,grow', 'https://analytics.google.com', 'E37400', 'Free', 'Traffic and acquisition baseline.'),
  T('Hotjar', 'hotjar', 'Analytics & Feedback', 'test,grow', 'https://hotjar.com', 'FF3C00', 'Free plan', 'Heatmaps and user recordings.'),
  T('Maze', 'maze', 'Analytics & Feedback', 'design,test', 'https://maze.co', '0B0A0F', 'Free research runs', 'Unmoderated prototype testing.'),
  T('Metabase', 'metabase', 'Analytics & Feedback', 'grow', 'https://metabase.com', '509EE3', 'Open source', 'Self-serve dashboards for the team.'),
  T('Cal.com', 'caldotcom', 'Meetings & Docs', 'discover,test,grow', 'https://cal.com', '292929', 'Free, open source', 'Let users book research calls.'),
  T('Intercom', 'intercom', 'Analytics & Feedback', 'launch,grow', 'https://intercom.com', '6AFDEF', 'Free starter', 'In-app support and onboarding.'),
  T('Crisp', 'crisp', 'Analytics & Feedback', 'launch,grow', 'https://crisp.chat', '1972F5', '2 seats free', 'Live chat the team can run itself.'),
  T('Linear', 'linear', 'Project Management', 'define,ideate,build,test,launch,grow', 'https://linear.app', '5E6AD2', 'Free for small teams', 'Fast issue tracking for shipping teams.'),
  T('Jira', 'jira', 'Project Management', 'define,build,test', 'https://jira.atlassian.com', '0052CC', 'Free up to 10 users', 'Sprints and backlog if you need ceremony.'),
  T('Trello', 'trello', 'Project Management', 'define,build,test', 'https://trello.com', '0052CC', 'Free boards', 'Simple kanban for the MVP.'),
  T('ClickUp', 'clickup', 'Project Management', 'build,launch,grow', 'https://clickup.com', '7B68EE', 'Free forever plan', 'Docs, tasks and goals in one tool.'),
  T('Asana', 'asana', 'Project Management', 'define,build,launch', 'https://asana.com', 'F06A6A', 'Free up to 10 users', 'Timeline planning and handoffs.'),
  T('Airtable', 'airtable', 'Project Management', 'discover,define,build,grow', 'https://airtable.com', '18BFFF', 'Free bases', 'Lightweight database for research and roadmap.'),
  T('Zapier', 'zapier', 'Automation', 'build,launch,grow', 'https://zapier.com', 'FF4F00', '100 tasks / month', 'Glue the free tools together.'),
  T('Make', 'make', 'Automation', 'build,launch,grow', 'https://make.com', '6D00CC', '1,000 ops / month', 'Visual multi-step automations.'),
  T('n8n', 'n8n', 'Automation', 'build,grow', 'https://n8n.io', 'EA4B71', 'Self-host free', 'Own your automations and AI agents.'),
];

export const STAGE_TOOL_CATEGORIES: Record<StageKey, string[]> = {
  discover: ['Meetings & Docs', 'Research & Validation', 'Whiteboard & Ideation'],
  define: ['Meetings & Docs', 'Project Management', 'Whiteboard & Ideation'],
  ideate: ['Whiteboard & Ideation', 'AI & Models', 'Meetings & Docs'],
  design: ['Design & Prototype', 'Whiteboard & Ideation', 'Code & Repo'],
  architect: ['Code & Repo', 'Database & Backend', 'Deploy & Infra', 'Payments & Auth', 'Testing & QA'],
  build: ['Code & Repo', 'Database & Backend', 'Deploy & Infra', 'AI & Models', 'Project Management'],
  test: ['Testing & QA', 'Analytics & Feedback', 'Design & Prototype', 'Project Management'],
  launch: ['Deploy & Infra', 'Growth & Launch', 'Analytics & Feedback', 'Payments & Auth'],
  grow: ['Analytics & Feedback', 'Growth & Launch', 'Automation', 'AI & Models'],
};

export const LIFECYCLE_KEYS: StageKey[] = STAGE_SEED.map((s) => s.key);

/**
 * Two rooms ship with the platform:
 *  - demo: a fictional kickoff so anyone can see the full experience in 30 seconds
 *  - live: the real workspace where this product itself is being shipped
 */
export const ROOM_CODES = {
  demo: process.env.DEMO_PROJECT_CODE || 'studio',
  live: process.env.PROD_PROJECT_CODE || 'onestop',
};

/**
 * The first release shipped a bright 400-weight palette. Rooms seeded before the
 * visual reset still carry those hex values in Postgres, so map them at render
 * time instead of asking the owner to re-seed.
 */
export const MUTED_STAGE_COLORS: Record<string, string> = {
  '#22d3ee': '#0e7490',
  '#818cf8': '#4338ca',
  '#fbbf24': '#b45309',
  '#f472b6': '#be123c',
  '#a78bfa': '#6d28d9',
  '#34d399': '#047857',
  '#38bdf8': '#0369a1',
  '#fb923c': '#c2410c',
  '#2dd4bf': '#0f766e',
};

export function stageAccent(hex: string | undefined | null): string {
  if (!hex) return '#4338ca';
  const key = hex.toLowerCase();
  return MUTED_STAGE_COLORS[key] ?? key;
}

/**
 * Exit criteria per stage — what "this stage is actually finished" means.
 *
 * Machine-checkable rules read the room (approved problem, document state, board
 * progress, accepted decisions, tools in use). `manual` rules are the things only
 * the team can confirm, and they are ticked in the Run plan view.
 *
 * The owner can rewrite these from the owner console; rooms keep them in
 * stages.gate, and this seed is only the default for a stage that has none.
 */
/** kind → human title, so gate criteria read like a sentence. */
export const DOC_TITLES: Record<string, string> = Object.values(ARTIFACT_BLUEPRINTS)
  .flat()
  .reduce<Record<string, string>>((acc, d) => {
    acc[d.kind] = d.title;
    return acc;
  }, {});

export const GATE_SEED: Record<StageKey, GateRuleSeed[]> = {
  discover: [
    { kind: 'problem_approved' },
    { kind: 'evidence', min: 3, label: 'At least 3 pieces of real evidence sit under the problem' },
    { kind: 'artifact', ref: 'problem_canvas', level: 'filled' },
    { kind: 'artifact', ref: 'research_plan', level: 'filled' },
    { kind: 'manual', id: 'discover.calls', label: 'Three real user conversations happened (notes in the room)' },
    { kind: 'manual', id: 'discover.signoff', label: 'The team agrees this problem is worth building now' },
  ],
  define: [
    { kind: 'artifact', ref: 'prd', level: 'ready' },
    { kind: 'artifact', ref: 'personas', level: 'filled' },
    { kind: 'artifact', ref: 'mvp_scope', level: 'ready' },
    { kind: 'artifact', ref: 'roadmap', level: 'filled' },
    { kind: 'artifact', ref: 'risk_register', level: 'filled' },
    { kind: 'decisions', min: 2, label: 'Two decisions are recorded (scope, metric or non-goals)' },
    { kind: 'manual', id: 'define.signoff', label: 'Written sign-off from design, engineering and QA' },
  ],
  ideate: [
    { kind: 'artifact', ref: 'concepts', level: 'filled' },
    { kind: 'artifact', ref: 'solution_brief', level: 'ready' },
    { kind: 'owners', min: 2, label: 'Design and engineering both shaped the shortlist' },
    { kind: 'manual', id: 'ideate.review', label: 'The team picked one direction and wrote down why the others lost' },
  ],
  design: [
    { kind: 'artifact', ref: 'ux_flows', level: 'ready' },
    { kind: 'artifact', ref: 'design_system', level: 'filled' },
    { kind: 'artifact', ref: 'landing_wireframe', level: 'filled' },
    { kind: 'tasks', minPct: 60, label: '60% of the design board is done' },
    { kind: 'manual', id: 'design.review', label: 'A clickable walkthrough was reviewed by engineering and QA' },
  ],
  architect: [
    { kind: 'artifact', ref: 'tech_stack', level: 'ready' },
    { kind: 'artifact', ref: 'data_model', level: 'ready' },
    { kind: 'artifact', ref: 'api_spec', level: 'ready' },
    { kind: 'manual', id: 'architect.adr', label: 'One architecture decision is written with the option it beat' },
  ],
  build: [
    { kind: 'tasks', minPct: 70, label: '70% of the build board is done' },
    { kind: 'artifact', ref: 'repo_plan', level: 'filled' },
    { kind: 'artifact', ref: 'engineering_standards', level: 'filled' },
    { kind: 'manual', id: 'build.repo', label: 'Repo is wired: CI green, one review rule, main always deployable' },
    { kind: 'manual', id: 'build.staging', label: 'A staging URL is reachable and the happy path works there' },
  ],
  test: [
    { kind: 'artifact', ref: 'test_plan', level: 'filled' },
    { kind: 'artifact', ref: 'qa_checklist', level: 'ready' },
    { kind: 'tasks', minPct: 85, label: '85% of the test board is done' },
    { kind: 'manual', id: 'test.p0', label: 'Zero open P0 bugs; known issues are written down' },
  ],
  launch: [
    { kind: 'artifact', ref: 'launch_checklist', level: 'ready' },
    { kind: 'artifact', ref: 'landing_copy', level: 'ready' },
    { kind: 'artifact', ref: 'pricing', level: 'filled' },
    { kind: 'artifact', ref: 'release_notes', level: 'filled' },
    { kind: 'tools', min: 1, label: 'At least one tool is marked “in use” so the team knows where work lives' },
    { kind: 'manual', id: 'launch.deployed', label: 'Deployed to production on the real domain' },
    { kind: 'manual', id: 'launch.announced', label: 'Announcement sent and the first 5 users invited' },
  ],
  grow: [
    { kind: 'artifact', ref: 'metrics_plan', level: 'filled' },
    { kind: 'artifact', ref: 'feedback_loop', level: 'filled' },
    { kind: 'manual', id: 'grow.read', label: 'Week-1 numbers were read against the targets in the metrics plan' },
    { kind: 'manual', id: 'grow.next', label: 'The next bet is written in the decision log with a threshold' },
  ],
};
