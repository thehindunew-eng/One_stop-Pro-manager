# One Stop Pro Manager

**The meeting IDE for product teams.** One room where the team talks, an AI agent works out the *actual* problem
statement, and every stage from ideation to deployment arrives with its documents, checklists and 100+ free tools
already loaded.

Built for **Amar Tripathi** and his product team: share one link, everyone collaborates, and the owner can change
stages, tools and copy from inside the app — no redeploy, no code.

---

## Visual system (v3) — grey-and-white liquid glass

The look is now **opaque glass panels on a grey canvas, every panel framed by a 1px black hairline**. It replaced the
flat white cards of v2 at the owner's request: the chrome should feel like physical glass sheets, not a web template.

| Layer | Decision |
| --- | --- |
| Typeface | **Inter Variable**, self-hosted through `@fontsource-variable/inter` and loaded in `app/layout.tsx`. No Google Fonts request, no fallback to Segoe UI. |
| Type scale | Eight steps only: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 30px (`tailwind.config.ts`). Nothing renders below 11px; body copy is 13–14px with 1.5–1.7 line height. |
| Colour | Monochrome chrome: grey canvas `#e8eaee` with two soft white light sources, ink `#0b0f17`, and **one black hairline `#111827`** around every glass surface. The accent is graphite (`electric` now resolves to ink), and three semantic colours are reserved for meaning (emerald = done, amber = attention, rose = risk). |
| Glass | `.panel` / `.glass` share one recipe: a white-to-grey translucent gradient, `backdrop-filter: blur(22px) saturate(135%)`, an inset top highlight and one soft shadow — **opaque enough to keep 11px text legible**. `.panel-flat`, `.glass-card`, `.well`, `.glass-bar` and `.glass-rail` are the same idea at lighter weights for nested surfaces, chrome and the context rail. |
| Without blur | `@supports not (backdrop-filter: …)` falls back to a near-opaque white so old browsers never get mush. |
| Marks | Tool tiles are glass squares with a brand-tinted gradient and the black hairline; avatars are graphite, not confetti — the chrome is grey, so people are grey. |
| Components | `app/globals.css` defines the primitives — `.panel`, `.glass-card`, `.well`, `.btn*`, `.chip`, `.field`, `.label`, `.tab`, `.section-label`, `.tnum`. A new screen inherits the system instead of inventing one. |
| Motion | One 4px fade-up and a soft pulse for live indicators. `prefers-reduced-motion` disables both. |

If you add UI, use the primitives and the scale above. Hard-coded `text-[9.5px]`, a coloured glow or a panel without
the black hairline is treated as a regression.

---

## What it does

| Capability | Where |
| --- | --- |
| Live meeting room — chat, notes, ideas, decisions, questions, transcript import, voice dictation | `Meeting` tab |
| **Problem engine** — reads the whole conversation and writes the real "How might we…" question, with confidence, users, pains, evidence, assumptions, unknowns, success metrics and solution angles | Right rail / `Build problem statement` |
| Signal extraction — pains, users, evidence, decisions, metrics, risks, open questions with evidence quotes and accept/dismiss | `Live signals` |
| 9 chronological lifecycle stages (Discover → Define → Ideate → Design → Architect → Build → Test → Launch → Grow) each with docs, checklist, board and scoped tool kit | `Lifecycle` tab |
| 30 auto-generated, editable artifacts: Problem Canvas, PRD, personas, MVP scope, concepts, solution brief, UX flows, design system, landing blueprint, tech stack, data model, API spec, repo/sprint plan, deployment runbook, engineering standards, test plan, QA checklist, GTM plan, landing copy, launch checklist, metrics plan, feedback loop… | `Documents` |
| Kanban board with owners, priorities, drag-to-move (48 tasks pre-seeded from stage checklists) | `Board` |
| 104 curated free-tier tools with flat brand-tinted marks, mapped to stages, searchable | `Tools` / tool wall |
| **Prime** — an agent you can ask about scope, risk, metrics, stack; always ends with one next action | `Ask Prime` |
| **Local AI** — any Ollama model (qwen3, llama3.1, qwen2.5-coder…), switchable from the owner console, plus optional `nomic-embed-text` document ranking | `/room/<code>/admin` → Workspace |
| Owner console — edit stages, icons, colours, checklists; add/retire tools; manage team roles; workspace identity | `/room/<code>/admin` |
| **Build room** — each member attaches their own GitHub / Vercel / database / model credentials (encrypted, write-only), picks a repo, creates the branch for a task with their own token, links the PR and logs progress | `Build` tab |
| **Live status** — every seat: online now, the task in hand, open/late counts, notes this week, access attached. The owner sees the same table in the console | `Build` → *Live status*, `/room/<code>/admin` → *Live* |
| **AI PM guard** — overlap, spec drift, stalls and gate order checked against the room, the plan and (with a member's GitHub token) the repo. Findings carry a confidence and citations; a human acts on each one | `Build` → *AI PM guard* |
| **Run plan** — launch readiness, the blocking list, a lane per seat with its next actions, and the gate checklist for every stage | `Run plan` tab |
| **Stage gates** — a stage is finished when its exit criteria are met, not when the board looks busy. Advancing early asks, then records the override | `Lifecycle` → *Advance* |
| **Due dates** — per-task dates on the board, overdue counts, "3d late" on your own work | `Board`, `My work` |
| Export the whole room as a **team launch pack** (Markdown) — who does what next, launch readiness, stage gates, board with dates, every document | profile menu → *Download launch pack* |
| Share by link, role-aware seats, live presence, 14s auto-refresh | Header |

### Bring your own access (Build room)

The room is not a meeting tool that stops at the plan — it is where the work happens.

- **Credentials belong to the person, not the platform.** A member attaches a GitHub token, a Vercel token, a database
  connection string or a model key under `Build → Connections`. Each secret is sealed with **AES-256-GCM** in
  `lib/vault.ts` and **never returned to a browser** — not to the member who typed it, not to the owner, not in an
  export. The API returns `•••• 1234`, a status and a timestamp.
- **Living credentials are verified, not assumed.** A GitHub token is checked against `api.github.com/user` and shows
  the signed-in login; Vercel against its user endpoint. Everything else is stored and honestly marked *unverified*.
- **Then you build from the task.** Pick the repo once; on any of your tasks press *Create* and the room creates the
  branch with **your** token, links it to the task, and gives you the compare link for the pull request. No platform
  token, no shared account, no OAuth app to register.
- **The repo tells its own story.** When a repo is selected the Build room reads the last commits straight from GitHub,
  so the team sees real activity beside the work log — no one types a commit message in by hand.
- **The work log is the status.** Notes, "pushed", links, blockers go on the task and into the room feed, so the board
  says what is really happening instead of what was hoped for.
- **The owner watches live, without reading secrets.** `Admin → Live` shows every seat: online in the last five
  minutes, the task in hand and its branch, open and late counts, notes this week, and who has attached access
  (status only). Members see the same table — status is not a secret, access is.

Honest limit: the room does not execute code. Running arbitrary build commands on a serverless platform would be a
security disaster; the repo, CI and Vercel do the running, and the room keeps the thread between task, branch and PR.

### The AI PM — governance, not autopilot

Ported from an IDE-orchestrator brief and adapted to what this platform can actually observe (the reasoning and the
full directive are in **[`docs/AI-PM.md`](docs/AI-PM.md)**, version `aipm.room/1.0`).

- **Four guards, four questions.** *Overlap* — are two people changing the same file or feature area? *Spec* — does a
  commit message or work-log note contradict a document that is marked ready? *Velocity* — what is late, quiet, or
  waiting on someone by name? *Gate* — is later-stage work running ahead of the current stage's exit criteria?
- **Deterministic first.** All four run on room data alone — no key, no model, no network. A configured model
  (Ollama or a hosted key) adds the prose-level findings arithmetic cannot see; it never decides whether a task is
  late.
- **Every finding is argued.** A confidence number and citations to the exact task, note, commit, document section or
  gate criterion. No citation, no finding — the validator drops anything the slice cannot support.
- **The agent proposes; a person acts.** `run`, `settings`, `confirm`, `dismiss` are the only verbs. Confirming creates
  a board task and writes the finding into the task's work log, with the human's name on the row and a line in the
  transcript. Nothing in `lib/aipm/` can push, merge or close anything.
- **Noise is capped, not hoped for.** Three findings per person per day, one HIGH per task per day, and an identical
  fingerprint never repeats — the second run reports `duplicates`.
- **Privacy gate.** `lib/aipm/scrub.ts` strips GitHub/OpenAI/Anthropic/Google/Groq/Figma tokens, connection strings,
  JWTs, bearer headers and `*_SECRET=` assignments before anything reaches a model, and honours `@aipm-ignore` …
  `@aipm-ignore-end` blocks. `npm run test:aipm` and `npm run test:guards` pin both behaviours.
- **Controls, enforced not promised.** A run ceiling (`maxRunsPerDay`, checked before any read or model call), a
  per-person noise budget, owner-only settings, and findings any member can read — the full matrix, with the file that
  enforces each one, is in [`docs/AI-PM-CONTROLS.md`](docs/AI-PM-CONTROLS.md).
- **Strict Architecture Mode, adapted.** There is no editor to block: strict mode refuses to mark a task *done* while a
  HIGH spec deviation is open on it (409, naming the finding), and a human dismissal unblocks it.

### The run plan — how the team actually ships

Documents describe the product; the run plan is what the team works from on a Tuesday morning.

- **Every stage has a gate.** Six or seven exit criteria per stage, seeded from `lib/defaults.ts` (`GATE_SEED`).
  Most are read from the room automatically — is the problem approved, is the document *ready*, are there three
  pieces of evidence, are two decisions accepted, is a tool marked in use. The rest are **human confirmations**
  (a user interview happened, a walkthrough was reviewed, the deploy is live) that a person ticks in `Run plan`.
- **Advancing a stage is checked.** `PATCH /api/project` refuses to move forward while the current stage's gate is
  open, and returns exactly what is missing. Overriding is allowed — plans slip — but it is a stated click, and the
  override is written into the room transcript.
- **One lane per seat.** PM, design, engineering, QA and growth each get a ranked list: the gate criteria they are
  expected to clear, their own open and overdue work, and unclaimed board tasks routed to the seat that owns the
  stage. Work is never recommended in two lanes at once, and a seat nobody holds says so instead of pretending.
- **Launch readiness is one number.** Percentage of every criterion from Discover through Launch. When it hits 100%
  the room is launchable by its own definition. Set a launch date and the plan tells you how many days you have.
- **The rhythm is written down**: daily standup from the board, twice-weekly gate clearing, a weekly meeting in the
  room, a reviewer at every gate, launch day on the checklist, weekly metrics after.

The owner edits gate criteria in `/room/<code>/admin` → Lifecycle → *Gate criteria* — no code changes.

### The intelligence works without any API key

The built-in reasoner (`lib/intel.ts`) tokenises the conversation, detects pains/users/evidence/decisions/metrics,
merges near-duplicates, scores confidence and assembles the problem question. It is deterministic, private and free.
Add **one** provider — a local model or a key — and the same pipeline upgrades to a live LLM (`lib/ai.ts`):

`OLLAMA_*` (local, free) · `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `GROQ_API_KEY` · `OPENROUTER_API_KEY`

Every call degrades gracefully — if the model errors or times out, the room keeps working.

### Local models (Ollama) — first-class

Any model pulled on your machine works for problem extraction, document drafting and Ask Prime. No key, no quotas,
nothing leaves the computer.

```bash
ollama serve                       # already running if you use the desktop app
ollama pull qwen3:4b               # 2.5 GB — fastest, good enough for drafts
ollama pull llama3.1:8b            # 4.9 GB — balanced
ollama pull qwen3:14b              # 9.3 GB — better structure, slower
ollama pull nomic-embed-text       # 274 MB — optional, ranks documents for Ask Prime
```

Then either set the environment, or open **Owner console → Workspace → Local AI** and pick from the models the app
found. That choice is stored in Postgres, so the whole team uses it and no redeploy is needed.

| Variable | Default | What it does |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Where the Ollama server listens |
| `OLLAMA_MODEL` | `qwen3:4b` | Model used when nobody has chosen one in the UI |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embeddings for document ranking (optional) |
| `OLLAMA_TIMEOUT_MS` | `120000` | Local models are slow; function timeout must allow it |
| `OLLAMA_THINKING` | `off` | `on` keeps Qwen 3's reasoning trace (slower, better JSON sometimes) |
| `AI_PROVIDER` | auto | Force one provider: `ollama`, `openai`, `anthropic`, `gemini`, `groq`, `openrouter` |

**The one catch:** a Vercel deployment runs in the cloud, so `127.0.0.1:11434` there is Vercel's own machine, not
yours. Local models therefore apply when the app runs on the same machine (`npm run dev`), or when you point
`OLLAMA_BASE_URL` at a reachable address (LAN IP with `OLLAMA_HOST=0.0.0.0`, Tailscale, or a tunnel). The owner
console says this plainly and refuses to save a model it cannot reach. Model switching also works for hosted
providers: choose the provider in env, the model in the env file.

`npm run test:ollama` (below) starts a fake Ollama server so the whole path can be checked without a GPU.

---

## Open a room (the three ways in)

| Link | Result |
| --- | --- |
| `/live` | Redirects to the live workspace room |
| `/demo` | Redirects to the demo room |
| `/room/<code>` | The room itself. If you are not signed in it shows an **in-room gate** — enter your name, or press **Enter as guest** / **Demo room** (one click, no details) |

Rooms never depend on cookies alone: the session also travels as a signed token (`?k=` once, then
`x-ospm-token` on API calls), so the room still opens in embedded previews, private windows and browsers
that block third-party cookies.

`/api/health` reports whether the database is reachable and both rooms exist — use it after every deploy.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

No database setup required: without `DATABASE_URL` the app boots an **embedded Postgres (PGlite)** in `./.data`.

Two rooms are seeded on first boot:

| Room | Link | What it is |
| --- | --- | --- |
| **Live workspace** | `/join?code=onestop` | The real product room: your founder brief captured as 10 messages, 4 locked decisions and an **approved** problem statement; Discover → Architect closed, Build nearly done, Launch in progress. Only you are a member — the team joins by link. |
| **Demo room** | `/join?code=studio` | A fictional Monday kickoff (5 teammates, 12 messages, 22 signals, a **draft** problem statement at 90% confidence, 30 docs, 48 tasks) so anyone can see the whole experience in 30 seconds. |

Switch between them from the room header or the profile menu.

**Owner access:** expand *Owner passcode* on the join screen and enter the passcode (default `amar-admin`,
set `ADMIN_PASSCODE` in production). You land straight in the owner console.

---

## Deploy: Vercel + Neon (free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fthehindunew-eng%2FOne_stop-Pro-manager&env=DATABASE_URL,AUTH_SECRET,ADMIN_PASSCODE&envDescription=Neon%20Postgres%20URL%2C%20a%20random%20session%20secret%20and%20your%20owner%20passcode)

1. **Create the database** — [neon.tech](https://neon.tech) → new project → copy the pooled connection string
   (`postgresql://…?sslmode=require`).
2. **Push this repo** to GitHub, then **import it in Vercel** (framework auto-detected as Next.js).
3. **Environment variables** (Production *and* Preview):

   | Key | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Neon connection string. Tables are created on first boot (idempotent). |
   | `AUTH_SECRET` | yes | Long random string used to sign session cookies. |
   | `ADMIN_PASSCODE` | yes | Your owner passcode. |
   | `ADMIN_EMAILS` | recommended | `you@company.com` — always admin on sign-in. |
   | `OWNER_NAME` / `OWNER_EMAIL` | optional | Defaults to Amar Tripathi / `amar@onestop.pro`. |
   | `PROD_PROJECT_CODE` / `DEMO_PROJECT_CODE` | optional | Room slugs, default `onestop` / `studio`. |
   | `PRODUCT_NAME` | optional | Name used for the live room and its generated docs. |
   | `OPENAI_API_KEY` *or* `GEMINI_API_KEY` *or* `GROQ_API_KEY` *or* `ANTHROPIC_API_KEY` *or* `OPENROUTER_API_KEY` | optional | Any one switches on live drafting. |
   | `OLLAMA_BASE_URL` + `OLLAMA_MODEL` | optional | Local models. Only useful on Vercel if the URL is publicly reachable — see the local-model section. |

4. **Deploy**, then run the five checks below before sharing the link.
5. **Make it yours** — rename the product, rewrite the problem statement and adjust stages/tools in the owner console,
   or create a clean room from `/join` → *Create a room* if this is a second product.

### After the first deploy — five checks (2 minutes)

| Check | Where | What "good" looks like |
| --- | --- | --- |
| Database is real | `/api/health` | `"database":"neon"` — if it says `pglite`, `DATABASE_URL` is missing and data will reset |
| Both rooms exist | `/api/health` | `ok: true`, 104 tools, 9 stages, live + demo rooms |
| Secrets are set | `/setup` | **Linked**, not *Running on a fallback*, for Neon and the session secret |
| Owner access works | `/join?code=<live>` → *Owner access* | the passcode opens `/room/<live>/admin` |
| Team can join | the invite link in a private window | the room opens with name only, no account |

### Things that bite on Vercel (and how this repo handles them)

- **Local models do not cross the internet by default.** `http://127.0.0.1:11434` inside a Vercel function is
  Vercel's own sandbox. Run the app locally for local models, expose Ollama with `OLLAMA_HOST=0.0.0.0` on your LAN
  (then use `http://<lan-ip>:11434`), or put it behind Tailscale/a tunnel. The owner console tests the URL before
  saving it, so a bad address fails loudly instead of silently falling back.

- **Use the pooled Neon string** (host contains `-pooler`). Each serverless instance keeps a pool of 3 connections;
  a direct (non-pooled) URL will exhaust Neon's connection limit under even light traffic.
- **Cold starts seed once.** Tool catalogue and both rooms are created behind atomic `ON CONFLICT` / marker inserts,
  so two instances booting at the same time cannot duplicate data. New document types are added to existing rooms
  on the next request.
- **Function duration.** AI drafting is capped per request: a stage of documents stops at ~42s and returns the
  remaining ones so you can press *Generate* again. On the Vercel **Hobby** plan functions are limited to 10s, so
  use the template engine (no AI key) for bulk generation, or upgrade to Pro for live-model drafting.
- **No build-time database access.** `next build` succeeds with an empty environment; the schema is created on the
  first request instead.
- **Rotating `AUTH_SECRET` signs everyone out** — that is the intended way to revoke sessions.

> Without `DATABASE_URL` on Vercel the app falls back to an ephemeral `/tmp` Postgres so the preview still works —
> but every instance gets its own copy and data will not persist. Neon is required for a real workspace.

CLI alternative:

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add ADMIN_PASSCODE production
vercel --prod
```

---

## Owner console — edit everything without code

`/room/<code>/admin`

- **Lifecycle** — rename stages, change icon/colour, edit the checklist (which seeds board tasks), hide a stage, or add
  a new one. Changes appear in the room immediately.
- **Tools** — edit a tool's name, colour, URL, free-tier note, description and which stages it belongs to; add new tools;
  disable or delete existing ones.
- **Team** — add members by email, change roles (PM / design / eng / QA / growth / member), remove members.
  The owner cannot be removed.
- **Workspace** — rename the product, edit the tagline, see the live engine, access and security settings.

Every change is a row in Postgres. No deploy required.

---

## Architecture

```
app/
  page.tsx                 landing
  join/                    join or create a room
  room/[code]/             workspace (server-rendered, client-hydrated)
  room/[code]/admin/       owner console
  api/                     auth, workspace, messages, analyze, problem, signals,
                           docs, tasks, project, agent, admin/*, export
components/                MeetingRoom, StageView, DocView, Board, ToolWall,
                           SignalRail, ProblemPanel, PrimePanel, AdminConsole, ui
lib/
  db.ts                    one SQL path: Neon (`pg`) or embedded PGlite
  repo.ts                  queries + first-run seeding
  auth.ts                  signed cookie sessions, owner/admin access
  intel.ts                 local reasoning engine (problem extraction)
  ai.ts                    provider-agnostic LLM layer with fallbacks
  generate.ts              deterministic artifact templates
  defaults.ts              9 stages, 104 tools, artifact blueprints
  types.ts                 domain model
```

**Data model:** `users`, `projects` (problem statement in JSONB), `members`, `messages`, `signals`, `artifacts`,
`tasks`, `tools`, `stages`, `app_settings`. Schema is created idempotently at boot, so the first request on a new Neon
database is all the migration you need.

**Security:** HMAC-signed httpOnly cookies, membership checks on every project read, owner checks on every admin
mutation, parameterised SQL only, no API keys exposed to the browser.

---

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/join` | Join or create a room (optional owner passcode) |
| GET | `/api/workspace?code=` | Full workspace payload |
| POST | `/api/messages` | Add a message (chat/note/idea/decision/question/transcript) |
| POST | `/api/analyze` | Run the problem engine over the conversation |
| PATCH | `/api/problem` | Edit / approve / reopen the problem statement |
| PATCH · POST | `/api/signals` | Accept, dismiss or add a signal |
| POST · PATCH | `/api/docs` | Generate one doc, a stage, or all; save edits and status |
| POST · PATCH · DELETE | `/api/tasks` | Board CRUD |
| PATCH | `/api/project` | Rename, retag, advance the lifecycle |
| POST | `/api/agent` | Ask Prime |
| POST · DELETE | `/api/admin/tools` | Tool catalogue |
| POST | `/api/admin/stages` | Stage editing / creation |
| POST | `/api/admin/team` | Members and roles |
| GET · POST · DELETE | `/api/credentials?code=` | Attach, rotate or remove a member credential (write-only; masked reads) |
| GET · POST | `/api/aipm?code=` | AI PM: findings + digest; `run`, `settings`, `confirm`, `dismiss` |
| GET · POST | `/api/build?code=` | Build room: my GitHub repos, task branches/PRs, work log, live status; create a branch, link a PR, log work |
| GET · POST | `/api/plan?code=` | The run plan for the room; `action:'gate'` ticks a manual criterion, `action:'launch_date'` sets the date |
| GET | `/api/export?code=` | Download the team launch pack (Markdown) |
| GET | `/api/health` | Database, rooms, catalogue and AI engine status |

---

## What needs an API key (and what does not)

There is a live checklist inside the app at **`/setup`** — it reads your environment and shows, for every
integration, whether it is connected, what the fallback is, and the exact steps to switch it on.

| Integration | Needed? | Variable | If you skip it |
| --- | --- | --- | --- |
| Neon Postgres | **Yes for a real team** | `DATABASE_URL` | Runs on an embedded Postgres file. Works locally; on Vercel the file system is temporary, so data resets on redeploy. |
| Session secret | **Yes for a real team** | `AUTH_SECRET` | Sessions work on a development default, but every deploy signs everyone out and a session could be forged. |
| Vercel hosting | Recommended | `VERCEL` (automatic) | Nothing breaks locally, but the team has no public link. |
| AI provider — one of | Optional (upgrade) | `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` | The built-in reasoner answers from the problem statement, board and documents. No key = no network call, no cost. |
| Owner passcode | Recommended | `ADMIN_PASSCODE` | The owner console falls back to the documented default passcode. |
| Room codes / owner identity | Optional | `PROD_PROJECT_CODE`, `DEMO_PROJECT_CODE`, `PRODUCT_NAME`, `OWNER_NAME`, `OWNER_EMAIL` | Defaults: `/room/onestop` (live), `/room/studio` (demo), owner “Amar Tripathi”. |
| Tool accounts (Figma, Notion, Linear…) | **No** | — | No OAuth app, no client ID, no credential sharing. The tool wall opens each tool in its own tab and stores only the workspace link your team pastes. |
| Payments, email, analytics | **No** | — | Nothing in the product requires them. |

**Free paths that work today:** Google AI Studio (Gemini), Groq and OpenRouter all have free tiers — one key is
enough and the platform picks the first one it finds. Everything else (rooms, documents, board, tool wall, signals,
export, owner console) works with no keys at all.

---

## Honest limits

- Live voice *transcription of a call* is not built in: the room captures typed chat, pasted transcripts and
  browser dictation. Use Google Meet/Zoom for video and paste the transcript, or let the copilot read the chat.
- Realtime collaboration is polling (14s), not WebSockets — deliberate for free-tier serverless.
- AI-generated documents are starting points with assumptions marked. The owner approves the problem statement and
  should review every doc before it reaches a client.
- Free tiers have ceilings. Set a Neon usage alert and an LLM spend cap on day one.

---

Built with Next.js 14, TypeScript, Tailwind, Postgres (Neon / PGlite), lucide icons and your choice of LLM.
