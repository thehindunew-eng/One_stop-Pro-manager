# One Stop Pro Manager

**The meeting IDE for product teams.** One room where the team talks, an AI agent works out the *actual* problem
statement, and every stage from ideation to deployment arrives with its documents, checklists and 100+ free tools
already loaded.

Built for **Amar Tripathi** and his product team: share one link, everyone collaborates, and the owner can change
stages, tools and copy from inside the app — no redeploy, no code.

---

## What it does

| Capability | Where |
| --- | --- |
| Live meeting room — chat, notes, ideas, decisions, questions, transcript import, voice dictation | `Meeting` tab |
| **Problem engine** — reads the whole conversation and writes the real "How might we…" question, with confidence, users, pains, evidence, assumptions, unknowns, success metrics and solution angles | Right rail / `Build problem statement` |
| Signal extraction — pains, users, evidence, decisions, metrics, risks, open questions with evidence quotes and accept/dismiss | `Live signals` |
| 9 chronological lifecycle stages (Discover → Define → Ideate → Design → Architect → Build → Test → Launch → Grow) each with docs, checklist, board and scoped tool kit | `Lifecycle` tab |
| 24 auto-generated, editable artifacts: Problem Canvas, PRD, personas, MVP scope, concepts, solution brief, UX flows, design system, landing blueprint, tech stack, data model, API spec, repo/sprint plan, deployment runbook, engineering standards, test plan, QA checklist, GTM plan, landing copy, launch checklist, metrics plan, feedback loop… | `Documents` |
| Kanban board with owners, priorities, drag-to-move (45 tasks pre-seeded from stage checklists) | `Board` |
| 104 curated free-tier tools with brand-coloured icons, mapped to stages, searchable | `Tools` / tool wall |
| **Prime** — an agent you can ask about scope, risk, metrics, stack; always ends with one next action | `Ask Prime` |
| Owner console — edit stages, icons, colours, checklists; add/retire tools; manage team roles; workspace identity | `/room/<code>/admin` |
| Export the whole product pack as Markdown | profile menu → *Download product pack* |
| Share by link, role-aware seats, live presence, 14s auto-refresh | Header |

### The intelligence works without any API key

The built-in reasoner (`lib/intel.ts`) tokenises the conversation, detects pains/users/evidence/decisions/metrics,
merges near-duplicates, scores confidence and assembles the problem question. It is deterministic, private and free.
Add **one** provider key and the same pipeline upgrades to a live LLM (`lib/ai.ts`):

`OPENAI_API_KEY` · `ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `GROQ_API_KEY` · `OPENROUTER_API_KEY`

Every call degrades gracefully — if the model errors or times out, the room keeps working.

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
| **Demo room** | `/join?code=studio` | A fictional Monday kickoff (5 teammates, 12 messages, 22 signals, a **draft** problem statement at 90% confidence, 24 docs, 45 tasks) so anyone can see the whole experience in 30 seconds. |

Switch between them from the room header or the profile menu.

**Owner access:** expand *Owner passcode* on the join screen and enter the passcode (default `amar-admin`,
set `ADMIN_PASSCODE` in production). You land straight in the owner console.

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

4. **Deploy**, open `/join?code=onestop`, enter the passcode, then share `/room/onestop` with the team.
5. **Make it yours** — rename the product, rewrite the problem statement and adjust stages/tools in the owner console,
   or create a clean room from `/join` → *Create a room* if this is a second product.

> Without `DATABASE_URL` on Vercel the app falls back to an ephemeral `/tmp` Postgres so the preview still works —
> but data will not persist. Neon is required for a real workspace.

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
| GET | `/api/export?code=` | Download the product pack (Markdown) |
| GET | `/api/health` | Database, rooms, catalogue and AI engine status |

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
