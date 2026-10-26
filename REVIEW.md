# Platform review — One Stop Pro Manager

**Reviewed:** 25 Oct 2026 · branch `arena/d3a3b79e-one-stop-pro-manager`
**Scope:** every route, the data model, the Vercel + Neon deployment path, and the full PM workflow from ideation to launch.

## Verdict

The core promise is real and deployable: one room per product, a conversation that becomes an approved problem
statement, nine stages with documents, board and tools, and an owner console that edits the product without code.
Nothing in the critical path is a placeholder.

Three things stood between this and a safe public URL, and all three are now fixed: concurrent cold starts could
seed twice on a fresh Neon database, the session secret fell back to a value published in this repo, and the owner
passcode had no brute-force limit. Details below.

What remains missing is mostly **collaboration depth and scheduling** — comments, notifications, due dates,
version history, a read-only client view. None of it blocks a first team; all of it shows up by week three.

---

## 1. Deployment: Vercel + Neon

### Set these three values, in this order

| # | Variable | Value | Why it matters |
| --- | --- | --- | --- |
| 1 | `DATABASE_URL` | Neon **pooled** connection string (`-pooler` in the host, ends with `?sslmode=require`) | Without it Vercel runs an ephemeral `/tmp` Postgres: every instance gets its own copy and data disappears on redeploy |
| 2 | `AUTH_SECRET` | 32+ random characters | Signs sessions. Rotating it signs everyone out — that is your "revoke access" button |
| 3 | `ADMIN_PASSCODE` | a private passcode | Owner console access. The default is documented in the repo — change it before sharing the link |

Then, optionally: `ADMIN_EMAILS` (always-admin emails), `OWNER_NAME` / `OWNER_EMAIL` (choose **before the first boot**),
`PRODUCT_NAME`, `PROD_PROJECT_CODE` / `DEMO_PROJECT_CODE`, a local model (`OLLAMA_BASE_URL` + `OLLAMA_MODEL`, see
section 8) or any one hosted AI key (`GEMINI_API_KEY` is the free path).

### After the first deploy — five checks

| Check | Where | Good looks like |
| --- | --- | --- |
| Real database | `/api/health` | `"database":"neon"` (not `pglite`) |
| Both rooms | `/api/health` | `ok: true`, 104 tools, 9 stages, live + demo |
| Secrets | `/setup` | Neon and session secret show **Linked**, not *Running on a fallback* |
| Owner access | `/join?code=<live>` → *Owner access* | passcode opens `/room/<live>/admin` |
| Team join | invite link in a private window | room opens with a name only, no account |

### Vercel / Neon behaviour that is now handled in code

- **Connection limits** — the pool is capped at 3 per instance with a 10s idle timeout and a 12s connect timeout, so a
  busy room cannot exhaust Neon's free-tier connection budget.
- **Neon sleep/wake** — one automatic retry on connection reset/timeout; a suspended database becomes a slow request
  instead of a 500.
- **Concurrent cold starts** — the tool catalogue and both seeded rooms are claimed with atomic
  `INSERT … ON CONFLICT` / marker rows, so two lambdas booting together cannot create duplicates.
- **Schema races** — creating the schema tolerates `duplicate_object` / `unique_violation` on the system catalogue and
  retries; additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations run on every boot.
- **New document types reach old rooms** — the blueprint is topped up against every existing project on boot, versioned
  by a marker row so a warm deploy does no work. Seeded rooms get starter text for the new documents; rooms the team
  created keep them empty for on-demand generation.
- **Function duration** — AI drafting stops at a 42-second budget and returns the documents it did not reach, so the
  UI can continue instead of the request dying. On Vercel **Hobby** (10s limit) use the template engine for bulk
  generation; the live model is best on Pro or one document at a time.

### Remaining deployment caveats (not bugs, just facts)

- Polling (14s) keeps serverless free-tier workable, but it is not realtime. Two people typing at once will not see
  each other until the next poll.
- In-memory rate limits and the presence cache reset on every cold start.
- No background jobs. Anything that should happen "later" (email, reminders, metric collection) does not exist yet.

---

## 2. Fixed in this review pass

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | Two cold serverless instances could seed duplicate rooms/tools on a fresh database | High | Atomic `ON CONFLICT (code) DO NOTHING RETURNING` for rooms, marker row in `app_settings` for the tool catalogue |
| 2 | Session signing key fell back to a constant committed to this repo → anyone could mint an owner session if they knew a user id (member ids are visible in any room payload) | High | When `AUTH_SECRET` is unset, the key is derived from `DATABASE_URL`; the public constant is only used with no database at all (local preview) |
| 3 | Owner passcode could be brute-forced on `/api/auth/join`; comparison was not constant-time | High | 8 failed attempts per IP per 10 minutes → `429` with `Retry-After`, constant-time compare, failures cleared on success |
| 4 | Editing a stage in the owner console (e.g. renaming) blanked its checklist, tagline and colour | High | `saveStage` now uses `COALESCE` — omitted fields keep their current value |
| 5 | Concurrent schema creation could fail the first request with a catalogue collision | Medium | Tolerate `42P07` / `42710` / `23505`, wait 250ms, re-run the idempotent schema |
| 6 | A rejected database driver promise was cached forever — after one Neon hiccup every later request failed until redeploy | Medium | The cache is cleared on failure; the next request reconnects |
| 7 | Bulk AI document generation could exceed the function timeout and lose everything it had done | Medium | 42s deadline, `skipped` list returned, UI tells you to press again |
| 8 | A brand-new product room showed 1 task *done* and 1 *in progress* before anyone touched it | Medium | New rooms seed all 48 checklist tasks as `todo` |
| 9 | Six PM-critical documents were missing from the blueprint (competitive analysis, roadmap, risk register, decision log, pricing, release notes) | Medium | Added with full templates, checklist steps and automatic top-up for existing rooms (24 → **30 docs**, 45 → **48 tasks**) |
| 10 | Ticking a checklist item with no matching board task silently did nothing (happens after editing a checklist) | Medium | The item is created on the board as done |
| 11 | `javascript:` links were possible through generated markdown and through tool/stack URLs | Medium | Scheme allowlist on render; admin tool links and team workspace links must be `http(s)` |
| 12 | The "room does not exist" page linked to hardcoded `/room/onestop` and `/room/studio` | Low | Uses the configured room codes |
| 13 | A teammate pre-added by email kept a placeholder name (`priya`) when they finally joined | Low | Their real name replaces the placeholder on join |
| 14 | Advancing a stage at 20% looked risk-free | Low | Confirmation prompt under 50% completion, naming what stays behind |
| 15 | Tokens could leak through the `Referer` header | Low | `Referrer-Policy`, `nosniff`, `Permissions-Policy` added (no `X-Frame-Options`, so iframe previews still work) |

Defaults that changed with them: `/setup` now reports the real secret source, the passcode warning says when the
documented default is still in use, and the document counts (30 docs / 48 tasks) are stated everywhere.

---

## 3. Still open — ranked

### P0 — do before sharing the link (10 minutes, mostly configuration)

1. **Change the owner passcode** and add `ADMIN_EMAILS`. The shipped default is public knowledge; throttling makes
   guessing impractical, not impossible.
2. **Join with `OWNER_EMAIL`.** The live room's owner is a seeded user with `OWNER_EMAIL` (default
   `amar@onestop.pro`). If you join with a different email you are a normal member; the passcode (or `ADMIN_EMAILS`)
   is what makes you an admin. Pick `OWNER_EMAIL` **before** the first boot.
3. **Delete the seeded demo room from your team's view** — members of the live room can see it from the room switcher
   and it contains fictional people. It is genuinely useful for a demo; just know it is there.
4. **Invite only people you trust with edit rights.** Holding the link grants edit access to the whole room; there is
   no read-only mode yet.

### P1 — the first week of real use

| Gap | Why it hurts | Suggested approach | Effort |
| --- | --- | --- | --- |
| No due dates or milestones on tasks | A PM cannot answer "what ships by Friday?" | Add `due_date` + `milestone` columns, date pill on cards, "This week" filter on the board | 1 day |
| No document version history | Two people editing a PRD overwrite each other silently | Append every save to `artifact_versions` (kind, content, editor, at), "History" drawer with restore | 1 day |
| No notifications | Nobody knows a problem was approved or a task assigned | In-app inbox table + unread badge; email later via Resend/Postmark free tier | 2 days |
| No room archive/delete | Test rooms and old products accumulate in "My rooms" | `archived_at` on projects, archive from the owner console, hidden from the switcher | half day |
| No read-only link | Clients and stakeholders get edit rights or nothing | Signed `?view=read` grant: `guard()` accepts read tokens for GET routes, UI hides mutations | 1 day |
| No document comments | Review discussion lives in Slack and is lost | `comments` table keyed to artifact + range, mentions by name | 2 days |

### P2 — after the first pilot

- **Search** across documents, tasks and messages (Postgres `ILIKE` or `pg_trgm` is enough at this size).
- **Metric actuals** — the metrics plan is a document today; a simple `metric_readings` table plus a sparkline turns
  Grow from a template into a dashboard.
- **Sprint/velocity view** — the board has points and priorities but no iterations, so estimation has no payoff yet.
- **Attachments and links on documents** — evidence is currently prose; a link field per document (Figma, Loom, Sheet)
  would close the loop with the tool wall.
- **Audit log** — who approved the problem, who deleted a task, who changed a plan price.
- **Realtime** — swap the 14s poll for Supabase Realtime or Partykit when the team is bigger than five.
- **Export pack** — include the tool stack, accepted/rejected signals and checklist state (it currently exports all
  documents, the board and signals, but not the stack).

### Known sharp edges worth deciding about deliberately

- **Roles are advisory.** Everyone in the room can edit everything; only the owner console is restricted. This is
  stated in the guide and the Team tab, but if you expect "QA cannot edit the PRD", that is not enforced.
- **Members' emails are visible to everyone in the room** (the team list joins `users`). Fine for one company, not for
  a client-facing room.
- **The `?k=` token is a URL credential.** It is stripped from the address bar after load and referrers are blocked,
  but it can still appear in access logs. It exists only so rooms open where cookies are blocked.
- **"Advance stage" is a soft gate** — a confirmation under 50% completion, not a hard lock.
- **Deleting a tool from the owner console deletes it from the catalogue for every room**, not just yours.

---

## 4. PM workflow coverage, stage by stage

| Stage | In the product today | Thin or missing |
| --- | --- | --- |
| **Discover** | Problem engine with confidence and unknowns, signal rail, Problem Canvas, Interview Guide, Research Plan, **Competitive Analysis**, 3 free-tool picks | Interview notes repository (transcripts only), evidence attachments, evidence-strength scoring |
| **Define** | PRD, Personas/JTBD, MVP Scope & Non-Goals, **Roadmap & Milestones**, **Risk Register**, **Decision Log** | Formal sign-off with a timestamp, document version history |
| **Ideate** | Scored solution concepts, chosen solution brief, pre-mortem checklist, board tasks | Interactive scoring (impact/effort/risk is prose, not a calculator) |
| **Design** | User flows, design system starter, landing blueprint, design playbook, Figma-class tools on the wall | Per-document file links, prototype feedback capture |
| **Architect** | Free-tier stack, data model, API contracts, repo plan, deployment runbook, engineering standards | Architecture diagrams (text only) |
| **Build** | Repo & sprint plan, deployment runbook (Vercel + Neon), standards, board with owners/points, weekly demo reminder | Due dates, sprints, dependencies, PR links, velocity |
| **Test** | Test plan, release QA checklist, QA playbook, bug tasks | Bug log view with severity rollups, test-run tracking |
| **Launch** | GTM plan, landing copy, launch-day checklist, **Pricing & Packaging**, **Release Notes** | Support/status page wiring, rollback automation |
| **Grow** | Metrics & learning plan, feedback loop & roadmap, retro prompts | Metric actuals over time, experiment log, cohort retention |
| **Cross-cutting** | Ask Prime with room context and one-click actions, My work panel, export pack, owner console, tool wall with team status | Comments, notifications, search, version history, attachments, audit trail, read-only links |

A PM can run a complete first cycle today. What they cannot yet do is run **three cycles in a row comfortably** — that
is where the P1 items matter.

---

## 5. Where the interface is still vague

| Place | The problem | Suggested wording or change |
| --- | --- | --- |
| Room switcher | Shows `demo` room and every test room you ever created | Add archive (P1); until then, hide the demo room unless `settings.showDemo` |
| Stage tabs | "Stage plan" and "Board" show the same checklist items twice | Rename to **"Checklist"** and **"All tasks"**, and say the board is the source of truth |
| Tool wall | 104 tools with 40+ unrelated to a PM's day | Default the scope to **This stage** and add a "Recommended for a PM" filter |
| `/setup` | Calls the AI provider an integration even though it is optional | Split into "Needed" and "Upgrades" sections (state is already there, just needs grouping) |
| Help / guide | Opens automatically once, then is hidden behind a small `?` in the header | Add "How this room works" to the user menu too |
| Empty documents | 30 empty documents in a new room looks like homework | The empty state is good; consider a "Generate every stage with the template engine" button for new rooms |

---

## 6. Suggested next two weeks, in order

1. Deploy with the three variables, run the five checks, change the passcode, invite two real teammates.
2. Run one real cycle in the live room. The two gaps you will feel first are **due dates** and **notifications**.
3. Ship P1 in this order: due dates → document history → notifications → read-only link.
4. Only then add AI volume features. The AI is already good; the missing parts are the boring, load-bearing ones.

---

*Companion file: `README.md` (deploy checklist and environment table) and `/setup` (live status of every integration).*

## 7. Visual reset (this pass)

"Not looking visually professional" was a real defect, not a matter of taste. The first light retint kept the dark
theme's DNA: nine shades of micro-type between 9px and 13px, an Inter font family that was declared in CSS but never
loaded, neon stage colours, gradient tiles and glow, a radial-gradient page wash, and backdrop blur on every sticky bar.

What changed:

| Defect | Fix |
| --- | --- |
| Inter declared, never loaded → Segoe UI/Roboto fallback | Self-hosted `@fontsource-variable/inter`, imported in `app/layout.tsx`. Ships woff2 in the bundle; no Google Fonts request. |
| 8 hardcoded sizes below 12px (`text-[9px]` … `text-[11.5px]`) | 778 replacements; nothing renders below 11px now. Scale: 11 meta / 12 dense / 13 body / 14 prose / 16+ headings. |
| Gradient logo, gradient tool tiles, avatar hue-gradients, `shadow-glow` | Flat solid marks: indigo square + mark, tinted initial tiles, solid avatar circles. `shadow-glow` is now `none`. |
| Neon stage palette (`#22d3ee`, `#818cf8`, `#fbbf24`…) | Muted stage accents; `stageAccent()` maps the bright hexes already stored in Postgres so existing rooms change without a re-seed. |
| Radial-gradient `.app-bg`, `grid-lines`, `backdrop-blur-xl` | Flat `#f7f8fa` canvas, white surfaces, 1px `#e4e7ec` borders, one hairline shadow. |
| Wash-tinted "selected" states (`bg-electric/[0.08]`) | Neutral selected states: `bg-slate-50` + border, indigo only for primary actions and links. |
| Landing hero: gradient text, blurred blobs, 58px headline | Solid headline at 46px, no blobs, alternating white/canvas section rhythm, real wordmark in nav and footer. |

Guard rails for future work: use the primitives in `app/globals.css` (`.panel`, `.btn*`, `.chip`, `.field`, `.label`,
`.tab`, `.section-label`) and the type scale in `tailwind.config.ts`. A new `text-[9.5px]` or `bg-gradient-to-*` should
be treated as a regression.

---

## 8. Local models (Ollama) — what is supported now

Local inference is a first-class provider, not an afterthought. It is the cheapest way to run this platform: no key,
no quota, no document ever leaving the machine.

| Layer | Behaviour |
| --- | --- |
| Detection | `OLLAMA_BASE_URL` / `OLLAMA_MODEL` env, **or** an automatic probe of `http://127.0.0.1:11434` on first use. Start Ollama and the app uses it without any configuration. `DISABLE_LOCAL_AI=1` forces the built-in reasoner back. |
| Switching | Owner console → *Workspace* → **Local AI models**: lists everything pulled (`/api/tags`), shows size and parameter count, saves the choice in Postgres. No redeploy, no env edit, whole team follows. Members can see it; only the owner can change it. |
| Transport | Prefers Ollama's OpenAI-compatible `/v1/chat/completions`, falls back to native `/api/chat` on older builds. 120s default timeout (`OLLAMA_TIMEOUT_MS`) because local models are slower than APIs. |
| Qwen 3 | Appends `/no_think` by default; `OLLAMA_THINKING=on` keeps the reasoning trace if you prefer quality over latency. |
| Embeddings | `nomic-embed-text` is used to rank the room's documents against the question, so Prime reads the six most relevant docs instead of the first eight. Vectors are cached per document; without the model it falls back to stage order. |
| Guardrails | Server URLs are validated (scheme, no link-local/metadata addresses), the model must exist on the server, and a dead server returns a clear 503 instead of a silent downgrade. |

### Which model to use

| Model | Size | Use it for |
| --- | --- | --- |
| `qwen3:4b` | 2.5 GB | Default. Fast enough for a PM to use interactively; fine for structured problem extraction. |
| `llama3.1:8b` | 4.9 GB | Better prose in documents; roughly 2× slower on CPU. |
| `qwen3:14b` | 9.3 GB | Best structure for PRDs and pricing tables if you have the RAM/GPU. |
| `qwen2.5-coder:14b` | 9.0 GB | Keep for code-shaped documents (API spec, data model, runbook); weaker at product writing. |
| `nomic-embed-text` | 274 MB | Document ranking for Ask Prime. Cheap; pull it. |

### The honest limits

- **A Vercel function cannot reach your laptop.** `127.0.0.1:11434` inside a deploy is Vercel's sandbox. Local models
  work when you run the app locally, or when Ollama is exposed (`OLLAMA_HOST=0.0.0.0`) on a LAN address, Tailscale or
  a tunnel — then set `OLLAMA_BASE_URL` to that address. The owner console refuses a URL it cannot reach, so this fails
  loudly.
- **Timeouts.** A 14B model on CPU can take longer than a serverless function is allowed to live. On Hobby, prefer
  `qwen3:4b` or run locally; on Pro, 60s covers most prompts at 4B.
- **Quality.** Local 4B models write acceptable internal drafts but are noticeably weaker than a frontier model at
  judgement calls (scope cuts, pricing). Use them for the work, keep a hosted model for the decisions that matter.
- **Tested against a protocol stand-in, not your hardware.** This pass verified the full path (discovery, switching,
  permissions, chat, JSON extraction, embeddings, fallbacks) against a fake Ollama server (`npm run test:ollama`)
  matching the documented API; actual token throughput and JSON reliability depend on the model and machine.

## 9. From documents to a shipping plan (this pass)

The exported pack was 30 good documents with no spine. It told a reader what the product is; it did not tell
anyone **who does what next, by when, or when a stage is actually finished**. A team could read the whole thing and
still not start work on Monday. That is what this pass fixes — inside the product, so the pack is generated from a
live plan instead of being the plan itself.

### What a stage gate is

Every stage now carries 6–7 exit criteria (`GATE_SEED` in `lib/defaults.ts`). Two kinds:

| Kind | Example | How it is decided |
| --- | --- | --- |
| Automatic | "Problem Canvas is written", "Two decisions are recorded", "At least one tool is in use" | Read from real room state on every request |
| Human | "Three real user conversations happened", "Deployed to production on the real domain" | Ticked by a person in Run plan; stored in `projects.settings.gates` |

Most criteria are automatic on purpose: a gate that depends only on honesty is decoration. The human ones are the
things software genuinely cannot know.

### What is enforced, not suggested

- `PATCH /api/project` returns **409** with the unmet criteria when someone tries to advance a stage whose gate is
  open. The UI shows the list and offers *Move anyway*; that override is written into the room transcript, so the
  gate stays visibly open rather than disappearing.
- Launch readiness is a single percentage over every criterion from Discover to Launch, and the Run plan lists the
  six things blocking launch at any moment.
- Unclaimed board work is routed to exactly one seat — the seat that owns the stage — never suggested to everybody.

### Where it lives

| Piece | File |
| --- | --- |
| Gate rules, evaluation, lanes, readiness, rhythm | `lib/plan.ts` |
| Seed criteria + role labels | `lib/defaults.ts` (`GATE_SEED`, `ROLE_LABELS`) |
| Server loader shared by the plan and the stage guard | `lib/planServer.ts` |
| Plan API (read for all, tick/date for editors) | `app/api/plan/route.ts` |
| Run plan UI | `components/PlanView.tsx` |
| Gate editor (owner, no code) | `components/AdminConsole.tsx` → Lifecycle → *Gate criteria* |
| Due dates on the board | `components/Board.tsx`, `tasks.due_date` |
| Date maths that does not break across timezones | `lib/dates.ts` |
| Launch pack export | `app/api/export/route.ts` |

### Honest limits of this pass

- The gate is a **process** control, not a security control. Anyone with edit access can confirm a human criterion
  or force an advance; the room records it, but nothing stops it.
- Dates are per task. There is no dependency graph, no capacity planning and no forecast — the plan says what is
  late, not what will slip.
- Custom stages added through the console have no seeded gate until the owner writes one; the plan shows them as
  open rather than hiding them.
- Notifications are still in-room only (polling every 14s). Nothing emails or pings anyone yet.

## 10. Build room, member credentials, and the glass reset (this pass)

Two requests in one: stop being only a meeting room, and restyle the chrome. Both are implemented; the honest limits
are at the bottom.

### The Build room

A stage plan is not a product. The room now carries the actual work:

| Capability | Where | Notes |
| --- | --- | --- |
| Attach your own credentials | `Build` → *Connections* | GitHub, Vercel, Neon, Figma, Supabase, OpenAI / Anthropic / Gemini / Groq, or a custom secret |
| Encrypted at rest | `lib/vault.ts` | AES-256-GCM, key from `CREDENTIAL_SECRET` → `AUTH_SECRET` → `DATABASE_URL`; a documented development default is used only when none is set, and the UI says so |
| Write-only from the browser | `GET /api/credentials` | Returns `•••• 1234`, status, timestamp. The decrypted value never leaves the server — that is enforced by the response shape, not by convention |
| Live verification where possible | `checkCredential()` | GitHub (`api.github.com/user`) and Vercel (`api.vercel.com/v2/user`) are checked; everything else is marked *unverified* rather than pretending |
| Branch per task | `POST /api/build` `create_branch` | Uses the **caller's** token, from the repo's default branch, with the task's name sanitised into a branch name; re-running is idempotent |
| Pull request link | `set_pr` | Stores the PR URL and moves the task to *review*; a compare link is generated from the branch |
| Recent commits | `GET /api/build?repo=` | Read from GitHub with the member's token; the room never invents activity |
| Work log | `task_notes` | note / pushed / link / blocked / status, on the task and in the room transcript, so status is written down instead of asked for |
| Live status for the owner | `Admin → Live`, `Build → Live status` | Online in the last 5 minutes, task in hand + branch, open/late counts, notes this week, access attached (count only) |

Permissions, verified by request: a member can log work on their own task (200) but not edit someone else's (403);
a member cannot see other people's credentials (empty list, `canAdmin: false`); a member cannot delete another
person's credential (403); the owner can revoke anyone's (200). No response anywhere contains the plaintext secret.

### The visual reset

Grey-and-white liquid glass: `--glass-fill` (white → grey translucent gradient), `blur(22px) saturate(135%)`, an
inset top highlight, one soft shadow, and a **1px `#111827` hairline around every panel, card, button, field, tab and
chip**. The accent colour is gone from the chrome — `electric` now resolves to ink — and only semantic emerald /
amber / rose remain, carrying meaning rather than decoration. Avatars are graphite; tool tiles keep a brand tint
inside a glass tile so the wall stays scannable. Everything is documented in README → *Visual system (v3)*.

### Honest limits of this pass

- **The room does not run code.** No containers, no `npm install`, no logs. Branch, PR and work log are real; the
  execution happens in GitHub Actions and Vercel. Running arbitrary commands on a serverless host would hand any
  member the platform's own environment.
- **GitHub is the only provider with a write action.** Vercel and the rest are stored and verified but not used to
  deploy yet; that is the obvious next step.
- **Credential checks need outbound HTTPS** from the deployment. In this sandbox Node's TLS store cannot reach
  `api.github.com`, so the success path was verified against `scripts/fake-github.cjs` with `GITHUB_API_BASE`; with a
  real token on a normal host the same calls hit GitHub.
- **A development-default vault key is visible in the UI.** Set `CREDENTIAL_SECRET` before the team stores tokens.
- **Polished, not audited.** No rate limit on credential writes beyond the shared limiter, and no rotation reminders.

## 11. The AI PM guard (this pass)

The architecture brief asked for a real-time IDE orchestrator reading CRDT buffers, a code graph and Jira/Linear. Two
of those three do not exist here, so shipping the brief verbatim would have produced a feature that invents conflicts
it cannot see. `docs/AI-PM.md` records the original text beside the adaptation and the reasons; this section is the
engineering summary.

### What was built

| Piece | File |
| --- | --- |
| Directive, versioned (`aipm.room/1.0`) | `lib/aipm/prompt.ts` |
| Bounded, scrubbed context slice | `lib/aipm/context.ts` |
| Four guards + the PM digest | `lib/aipm/guards.ts` |
| Orchestration, model merge, noise budget | `lib/aipm/index.ts` |
| Findings + run audit (`aipm_findings`, `aipm_runs`) | `lib/aipm/store.ts` |
| Privacy gate (`@aipm-ignore`, token shapes) | `lib/aipm/scrub.ts` |
| API: read for the room, act for humans | `app/api/aipm/route.ts` |
| UI | `components/GuardPanel.tsx` (Build → *AI PM guard*), owner settings in `/room/<code>/admin` → *Live* |
| Export | `Appendix D` in `app/api/export/route.ts` |
| Checks | `npm run test:aipm`, `npm run test:guards` |

### What the adaptation changed, and why

- **Guards run on room events, not keystrokes.** No editor, no CRDT: triggers are work-log entries, branch/PR links,
  status changes and an explicit run. "Live" is never claimed.
- **File/line output became task + artefact.** `file_path` and `line_range` would be invented without a code index; the
  output contract is `target`, `task_id`, `citations`.
- **Strict Architecture Mode blocks completion, not typing.** There is nothing to block while typing, so it blocks the
  claim that work is done while a HIGH deviation is open.
- **The model is optional by design.** All four guards are deterministic. With a provider configured, the same slice is
  sent with the directive and only findings that cite something in the slice survive validation.

### Verified by request (not by assumption)

- A scenario with a shared file, a hard-coded value against a ready document, an overdue task, dependency language and
  an open gate produced: 2 CONFLICT, 1 DEVIATION, 2 VELOCITY, 1 GATE — each with citations and confidence.
- Second run: `duplicates` (no repeats). Budget of 1/person: 4 findings suppressed, 0 kept.
- A GitHub token pasted into a work-log note never appeared in any finding (0 occurrences of `ghp_`).
- Confirming a finding created a `Fix: …` board task, wrote the note onto the task, and logged a `decision` message in
  the transcript; the row records `confirmed_by`.
- Strict mode: `PATCH /api/tasks {status:'done'}` → **409** naming the open HIGH deviation; after the human confirms,
  the same request returns 200.
- Member permissions: run → 403, dismissing someone else's finding → 403; the owner and the named person can.
- Export: `Appendix D — AI PM guard findings` with severity, kind, target, confidence and citations.

### Bugs the checks caught

- The velocity guard had a sign error that reported **future** due dates as "N days past its date". Fixed; the unit
  check asserts a late task fires and a future one does not.
- `words()` was shadowed inside the spec guard, so tense differences ("refactor"/"refactored") silently failed to match.
  Renamed and stemmed; the check asserts a hard-coded value is caught against a *ready* document.

### Honest limits

- **No line-level collisions.** Overlap compares declared artefacts — files named in notes, branch prefixes, commit
  files — with confidence 0.55–0.72 to say so.
- **No PR comments, no auto-run.** Commenting needs `pull_request: write` on each member's token; the loop runs when a
  human presses the button (a cron job is a small, separate change).
- **No test or deploy evidence.** A guard can say a change contradicts a written requirement; it cannot say the build
  is broken.
- **"Multi-factor authorisation" is a named human with edit rights**, recorded in the database. Calling that
  multi-factor would be a lie.
