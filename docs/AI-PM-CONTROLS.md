# The AI PM control plane

`docs/AI-PM.md` answers *what was built and why it differs from the brief*. This document answers the harder
question: **which controls actually exist, where they are enforced, and how anyone can prove it.**

It is written for two readers. Amar, as owner, needs to know what the guard can and cannot do to his team. A reviewer
needs to check the claims without trusting the prose — every row in sections 2–4 names a file, and section 8 lists the
command that proves it.

- Directive: `aipm.room/1.0` — `lib/aipm/prompt.ts` (the full text is quoted in section 7, copy-ready)
- Loop: `lib/aipm/index.ts` · slice: `lib/aipm/context.ts` · guards: `lib/aipm/guards.ts` · privacy: `lib/aipm/scrub.ts`
- Interface: `app/api/aipm/route.ts` · console: `components/GuardPanel.tsx` · owner knobs: `/room/<code>/admin` → *Live*

---

## 1. The architecture, as it actually is

```
 Room mutations                          one bounded slice                 findings a human acts on
 ─────────────────────────────────       ───────────────────────────       ─────────────────────────
 tasks · status · due dates      ┐       18 tasks in flight                ┌  4 deterministic guards
 work log (note|commit|blocker)  │       24 recent notes                 │  + model findings that cite
 30 stage documents              ├──▶    10 documents × 8 requirement    ──▶  something in the slice
 gate criteria + met/unmet       │       lines · 20 commits              │         │
 members + presence              │       members + presence              │         ▼
 per-member GitHub token ────────┘       (scrubbed, deep)              │   noise budget → aipm_findings
 (commits only)                                                        ┘   (+ aipm_runs audit row)
                                                                                │
                                        Build → AI PM guard  ◀─────────────────┘
                                        digest · Appendix D · board card
                                                 │
                                                 ▼
                                     a named human: confirm / dismiss / acknowledge
                                     → board task + work-log note + transcript row
```

Five decisions define this architecture, and each one is a control in disguise:

1. **Room events are the only trigger.** There is no editor, so there is no keystroke stream to reason about. A run
   reads the state of the room *as of now* — the UI says "as of the last sync", never "live".
2. **Deterministic guards run first and always.** With no API key, no Ollama and no network, the four arithmetic
   guards still fire. The model is an optional recall improvement, never the source of truth.
3. **The slice is the contract.** A finding can only cite what is in the slice, and the slice is bounded by
   construction. This is what makes "no invented ids" enforceable rather than aspirational.
4. **A finding is a row, not a toast.** It has an id, a severity, a status, a prompt version, a fingerprint and a
   confirmation trail. Chat messages cannot be audited six months later; rows can.
5. **The agent has no write path.** Not "is instructed not to" — there is no code in `lib/aipm/**` that writes to a
   repository, a task or a gate. The only writes happen in the route, after a human presses something.

---

## 2. Controls for the AI PM (its own guardrails)

| # | Control | Threat it removes | Where it is enforced | How to check |
| --- | --- | --- | --- | --- |
| 1 | **No autonomous writes** — no push, merge, PR close, branch delete, task edit, gate tick | The agent becoming a deployer | `app/api/aipm/route.ts` accepts only `run`, `settings`, `confirm`, `acknowledge`, `dismiss`; `lib/aipm/**` has no GitHub write call | read the route's `action` branches; grep `lib/aipm` for `fetch(` → commits read only |
| 2 | **No secrets in** — GitHub / OpenAI / Anthropic / Google / Groq / Figma token shapes, `postgres://`, JWTs, `Bearer …`, `*_SECRET=` | Credential leakage into a hosted model | `lib/aipm/scrub.ts` → `scrub()`, `scrubDeep()` applied to the whole slice | `npm run test:aipm` (15 checks) |
| 3 | **`@aipm-ignore` respected** — a block or a single line never leaves the room | A developer's deliberate exclusion being overridden | `scrub()` strips markers and enclosed code before the slice is built | `npm run test:aipm` includes block, line and clean-prose cases |
| 4 | **No secrets out** — a pasted token cannot appear in a stored finding | A finding quoting the credential it caught | Findings are persisted after the slice is scrubbed; nothing re-reads raw notes | paste `ghp_…` in a note, run, search `aipm_findings` → 0 hits (done, section 7) |
| 5 | **Hard run ceiling** — N runs per room per 24 h, checked *before* any read or model call | A loop that keeps spending on a stuck state | `maxRunsPerDay` (default 24) → `runsInLastDay()` in `lib/aipm/store.ts`, gate at the top of `runAipm()`; POST returns **429** | set the ceiling to 2, run three times → third is refused |
| 6 | **Token economy by construction** — bounded slice, one model call per run, `maxTokens: 1400`, temperature 0.2 | Unbounded context and runaway output | caps in `lib/aipm/context.ts`; call options in `lib/aipm/index.ts` | read the caps; the run reports `ms` |
| 7 | **No repeats** — an unchanged state cannot re-notify | Death by identical alerts | fingerprint `kind｜task｜citation-refs`, `UNIQUE(project_id, fingerprint)`; an open duplicate is counted, not stored | run twice → second run reports `duplicates` |
| 8 | **Evidence or silence** — a model finding without a real citation is dropped | Plausible-sounding fabrication | `validCitations()` + `normalise()` in `lib/aipm/index.ts` | inspect a stored row: `citations` is never empty |
| 9 | **Confidence, always** — 0.0–1.0 on every row, downgrade instead of guessing | False authority | `Finding.confidence` is required; DEVIATION without a requirement citation becomes SUGGESTION in `guards.ts` | inspect rows |
| 10 | **Directive is code, not a text box** — versioned and pinned per finding | Someone quietly changing the agent's rules | `PROMPT_VERSION` in `lib/aipm/prompt.ts`; `aipm_findings.prompt_version` | any finding row |
| 11 | **Insufficient-context honesty** — the slice says what it could not see | Confident claims about code with no token | `gaps[]` built in `context.ts`, returned on every run, rendered in the digest and Appendix D | run with no GitHub token → the digest states it |
| 12 | **Kill switch** — one toggle disables running for the whole room | The feature outliving its welcome | `settings.enabled`; POST `run` → 409 when off | turn off in admin → run returns 409 |

### The noise budget, specifically

Three mechanisms stack, and each answers a different failure:

| Layer | Rule | Why this number |
| --- | --- | --- |
| Per person per day | ≤ `maxPerPersonPerDay` (default 3, 0–10) | Three findings is a conversation; ten is a backlog of guilt. |
| Per task per day | ≤ 1 **HIGH**, excluding CONFLICT | A task should be interrupted once, not repeatedly. Conflicts are exempt because a finding about two people that only reaches one of them is worse than useless. |
| Per fingerprint | identical ⇒ suppressed, counted as `duplicates` | If nothing changed, there is nothing to say. |

---

## 3. Controls for the team

The brief's team-side controls, against what exists today:

| Control | Status | How it works here |
| --- | --- | --- |
| **`// @aipm-ignore`** | **Built** | Works in work-log notes and document text — the two places code-shaped intent is written. Block form `@aipm-ignore … @aipm-ignore-end`, or a single marked line. |
| **RBAC — devs cannot change the rules** | **Built** | `run` needs edit access; `settings` needs owner/admin; the directive itself is in the repository, so there is no in-app field to edit at all. A member gets 403 on both. |
| **You can close a finding about you** | **Built** | Dismiss/acknowledge is allowed for an editor **or the person named in the finding** — and nobody else (403 otherwise). |
| **Everything is visible to everyone** | **Built** | Reading findings is open to the whole room. Governance only the owner can read is surveillance. |
| **Opt-in context sharing / "incognito dev mode"** | **Not built — proposed** | There is no local draft buffer to disconnect. The faithful analogue is: a member can exclude *their notes and commits* from the model slice while their board state stays visible. It is a real change (a settings array + a filter in `context.ts` + a toggle in the console) and it is **not** in this build. Section 9, item 1 has the design. |
| **No hidden developer scoring** | **Deliberate refusal** | Findings are about artefacts — a task, a file, a document line — and are named and citable. No per-person productivity number, no leaderboard, no "synergy combo". A hidden score on individuals is the fastest way to make a team optimise the score. |

### What can block a developer here

Exactly one thing: **strict architecture mode**, and only *marking a task done* while a HIGH spec deviation is open on
that task. The 409 names the finding, the finding has a citation, and the person it is about (or an editor) can dismiss
it. Nothing else in the platform can refuse a developer's action because of a model's opinion.

---

## 4. Controls for the lead PM

| Need | Where it lives | What it gives you |
| --- | --- | --- |
| Kill switch, strictness, noise, spend | `/room/<code>/admin` → *Live* | four knobs: guards on/off, strict mode, findings per person per day, runs per day; digest cadence is stored with them. Every change writes a `system` message into the transcript with the owner's name. |
| One readable summary | Build → *AI PM guard* → digest | trajectory in three sentences, findings by severity, “the one thing this week”, and an explicit list of what the guards could not see. |
| Traceability | `aipm_findings` + `aipm_runs` | who ran it, which engine, which prompt version, what it found, how long it took, and who confirmed each finding. |
| Evidence in the pack | Export → **Appendix D** | open findings with severity, kind, target, confidence and sources — emitted only when there is something open, so the pack never sprouts an empty section. |
| Gate discipline | *GATE* guard | later-stage work in flight while the current stage's exit criteria are open — with the single criterion that would unblock the most work. |
| Honest gaps | every run | "no repository telemetry", "no commits in the slice", "no test output, no deploy logs". |

---

## 5. Where I disagree with the pasted architecture

The brief is good, and most of it is already running. These are the places I would not build what it says, with the
reason, so the disagreement is on record rather than silently dropped.

| Brief says | Verdict here | Why |
| --- | --- | --- |
| Shared CRDT state; AI reads uncommitted drafts; predictive ghost cursors | **Not buildable here — do not fake it** | There is no editor and no CRDT layer. Simulating "live" from a 14-second poll would be theatre: the platform would claim to see typing it cannot see. The honest version is the one that shipped — declarative artefacts (branch, PR, note) with confidence lowered accordingly. |
| Vector DB (Pinecone/Qdrant) over the whole codebase | **Rejected at this size** | The slice is ~2–4k tokens of *chosen* material with real ids. Retrieval would add a service, an embedding cost and a new failure mode to answer a question a bounded query answers better. Revisit at multi-repo / ~100k LOC, where choosing by hand stops scaling. |
| Graph DB (Neo4j) mapping modules to owners | **Rejected — the board already is the graph** | Ownership, stage, dependency phrases and gate membership live in Postgres rows. Adding a graph database to re-derive them is architecture theatre. |
| "Multi-factor human authorisation" | **Renamed: a named human with edit rights** | There is one factor — the session cookie. The audit row (`confirmed_by`), the transcript entry and the ownership check make it *accountable*, not multi-factor. Calling it MFA would be a lie in a document a security reviewer will read. |
| Token/financial budgets with hard ceilings | **Adapted: a run ceiling** | The slice is already bounded and each run makes at most one model call, so spend per run is roughly constant. The lever that actually bounds spend is therefore the number of runs — now `maxRunsPerDay`, checked before any work. |
| Gamification — combo meters, boss fights, AI release anthems | **Refused as specified; kept as a room-level ritual** | Per-person counters turn collaboration into a leaderboard and invite gaming ("write a test in the last minute for the combo"). Celebrating a *milestone* at room level is motivating; ranking people is corrosive. If you want the ceremony, do it in the digest — one line, no scores. |
| Editor→canvas JSON payload with cursor coordinates | **Not applicable** | No editor. The equivalent contract is the finding schema, and it is already versioned and stored. |

---

## 6. What actually makes this different

Every "AI PM" in the market is a chat box bolted onto a tracker, and it dies the same death: the LLM bill arrives, the
key is removed, and the feature becomes a hollow shell. The differentiators below are the ones this build can defend
without adding a single new dependency — in the order I would argue them.

1. **It works with no key, no model and no network.** Four guards are arithmetic. The product is useful on day one and
   stays useful if the AI provider goes away. Almost nothing else in this category can say that.
2. **A finding is a durable artefact, not a notification.** It has a fingerprint, a severity, a prompt version, a
   citation list and a named human on the row. That is what lets a PM trust it months later, and what makes "the agent
   did it" impossible to be true.
3. **"Proposes, never writes" is enforced in the route, not asked for in the prompt.** The verbs are countable. A
   reviewer can confirm the claim in an afternoon.
4. **The whole team gets governance, not just the owner.** Anyone in the room can read the findings; the person a
   finding is about can close it; the rules need owner rights. Most tools in this space do the opposite and call it
   "admin".
5. **One link to join, per-seat credentials.** No accounts to provision, no org-level OAuth app, and a member's GitHub
   token is theirs — the guard borrows it to read commits and never stores a second copy of anything.

Where the "make it more interesting" ideas land, honestly:

| Idea | Verdict |
| --- | --- |
| Asymmetric views of one dataset (dev: board + work log; PM: digest + gates) | **Already true, and the best idea in the brief.** The next increment is the trajectory chart (section 9, #4) — the PM's screen should show *movement*, not a snapshot. |
| Room-level celebration when a gate closes (a line in the digest, a merged milestone event) | **Cheap and worth it.** Ceremony at the team level builds momentum; ceremony aimed at individuals builds resentment. |
| Combo meters, per-dev synergy scores, "boss fights" | **Refused.** They rank people, which is exactly what makes a team write tests for the meter instead of for the product. |
| Ghost cursors, predictive shadows, a live topology canvas | **Right idea, wrong substrate.** It needs a real editor and a code index. Shipping a canvas fed by a 14-second poll would look impressive in a demo and be wrong in the room. |
| An "AI release anthem" written like a sports broadcast | **One paragraph, low stakes, optional.** Fine as flavour in a weekly digest. Not architecture. |

---

## 7. The directive, copy-ready

This is the exact text sent as the system instruction (`PROMPT_VERSION = aipm.room/1.0`). Treat it as the *contract
with the model*, not as the control plane: the controls in section 2 are enforced in TypeScript, because a model can
be persuaded and a 429 cannot.

```text
You are the AI Product Manager (AI PM), a governance layer inside a collaborative
product-building workspace. You do not write code. You do not change state. You read the room, compare it to the
product specification and the repository, and emit structured findings that a human acts on.

You are a workflow engine, a context bridge and a compliance guard — not a chatbot.

## 1. CONTEXT YOU RECEIVE

A. ROOM STATE (authoritative)
   - Board: task id, title, owner, status (todo|doing|review|done), priority, due_date, stage_key, repo, branch,
     pull_request.
   - Work log: note | commit | link | blocker | status entries with author and timestamp.
   - Gate criteria per stage and which are met; the problem statement and its approval state.
   - Presence: last_seen per member (online = active within 5 minutes).

B. REPOSITORY TELEMETRY (only through the requesting member's own GitHub token)
   - Recent commits: sha, message, author, date; files touched when the token can read them.
   - The branch and pull request linked to a task.
   If the token is missing, expired or unreadable, say so and reason from the room only. Never guess about code.

C. PRODUCT SPECIFICATION
   - The stage documents (problem canvas, PRD, MVP scope, personas, API spec, data model, tech stack, QA checklist,
     launch checklist, metrics plan…), each with status empty|draft|ready.
   - Accepted decisions, open questions and blockers.

D. WHAT YOU DO NOT HAVE — state it when it limits a finding
   - No live editor buffer, no CRDT cursors, no full file tree, no test output, no deploy logs.
   "Live" means "as of the last sync". If precision is impossible, lower the confidence rather than inflating it.

## 2. PROTOCOLS

A. OVERLAP GUARD — two people are changing the same thing.
   Trigger: two open tasks from different people reference the same file, table or endpoint; or their branches share
   a feature prefix; or a note says a schema is being changed while another task depends on it.
   Output: CONFLICT naming the shared artefact and both tasks. Never claim line-level precision you do not have.

B. SPEC GUARD — code drifting from what was agreed.
   Trigger: a commit message, PR title or note that contradicts a requirement in a document for that stage
   (hard-coding what the spec says must be configurable, skipping a validation the spec requires, an API field the
   spec names that the work never mentions).
   Output: DEVIATION citing the document and section. No citable requirement, no DEVIATION — downgrade to SUGGESTION.

C. VELOCITY GUARD — work is stuck.
   Trigger: a task in doing past its date, or with no commit or note for 48 hours; dependency language in a note
   ("waiting on", "blocked by", "needs … from"); an owner idle while their task is the only thing between the room
   and its next gate.
   Output: a sync suggestion naming who is waiting on whom.

D. GATE GUARD — work running ahead of its own definition of done.
   Trigger: the current stage has open exit criteria while tasks in later stages are in progress.
   Output: GATE finding naming the single criterion that would unblock the most work.

## 3. HARD CONSTRAINTS

- PRIVACY: never request, read, infer or repeat credentials, tokens, connection strings or .env values. You receive
  credential *status*, never secrets. Anything matching ghp_, github_pat_, sk-, AIza, postgres:// or eyJ is stripped
  before it reaches you. Code between @aipm-ignore and @aipm-ignore-end is never sent.
- AUTHORITY: you may not push, merge, close a pull request, delete a branch, edit a task, tick a gate, message
  anyone outside the room or write to a repository. You emit proposals; a named human confirms each one. A proposal
  that would write must state its exact effect.
- NOISE: no more than one HIGH finding per task per 24 hours and three recommendations per person per day. LOW and
  MEDIUM queue into the digest. If the state has not changed, do not repeat a finding.
- TRANSPARENCY: every finding carries a confidence (0.0–1.0) and citations (document section, task id, commit sha,
  branch, note). No citation, no finding.
- ECONOMY: reason over the supplied slice only. Never ask for the whole repository or the whole document set. If the
  slice is insufficient, return no findings and say "insufficient context" rather than speculating.

## 4. OUTPUT — one JSON object, nothing else

{
  "findings": [
    {
      "kind": "CONFLICT" | "DEVIATION" | "SUGGESTION" | "GATE" | "VELOCITY",
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "target": "person name, or the seat if unassigned",
      "task_id": "task id or null",
      "message": "one short peer-to-peer paragraph",
      "suggested_action": "one concrete step a human can take",
      "confidence": 0.0,
      "citations": [{ "source": "doc|task|commit|note|gate", "ref": "the exact identifier", "detail": "what it says" }]
    }
  ],
  "trajectory": "three sentences on where the product actually stands against its own gates",
  "sync_suggestion": "the one cross-team conversation worth having this week, or an empty string"
}

Rules for the object: no markdown inside strings, no invented ids, at most six findings, drop anything you cannot cite.
```

**If you fork this for another platform**, change section 1 first — it is the honest inventory of available context.
Everything downstream (the guards, the citation rule, the confidence) depends on that inventory being true. Changing
section 3's authority clause without adding an enforcement point in code makes the prompt a wish, not a control.

---

## 8. Proof, in commands

| Claim | Command | Expected |
| --- | --- | --- |
| No secret can reach the model | `npm run test:aipm` | `all privacy checks passed` (15 checks) |
| The guards fire, and a clean room stays quiet | `npm run test:guards` | `all guard checks passed` (11 checks, incl. "a clean room produces no findings") |
| A run is auditable | `curl -H "x-ospm-token: $TOK" '/api/aipm?code=onestop'` | `settings`, `runsToday`, `runsLeft`, `promptVersion`, `findings[]` with citations |
| The ceiling holds | set `maxRunsPerDay: 2`, then POST `run` three times | two `200`s and a `429` naming the ceiling |
| Members cannot change the rules | POST `settings` with a member token | `403 Only the owner can change governance settings.` |
| Members cannot run the guards | POST `run` with a member token | `403 Only people who can edit the room can run the guards.` |
| A finding about you can be closed by you, by nobody else | POST `dismiss` with a third member's token | `403 Only the owner, or the person this finding is about, can close it.` |
| Money cannot leak through a loop | set `maxRunsPerDay: 1`, run twice | second run is `429` — no slice built, no model call made |

---

## 9. What I would build next, in order

| # | Change | Effort | Why it is worth it |
| --- | --- | --- | --- |
| 1 | **Opt-in context sharing** — `settings.aipm.optOut: string[]`, filter notes/commits in `context.ts`, toggle on My Work | M | The one team-side control from the brief that is genuinely missing. It also makes the whole feature easier to consent to. |
| 2 | **Scheduled digest** — a Vercel cron that calls the same `runAipm()` with `roomOnly: true` once a day | S | Governance that depends on someone pressing a button is governance that stops. The ceiling already protects the spend. |
| 3 | **PR comment via a scoped token** — `pull_request: write` per member, opt-in | M | Turns a finding into a conversation where the code already lives. Needs the extra scope stated plainly at Connections. |
| 4 | **Trajectory** — store the plan snapshot per run; sparkline of gates-met and open-vs-late over time | S | One picture is worth the whole digest for a lead PM, and the data is already in `aipm_runs`. |
| 5 | **Topology canvas** | XL | Only becomes honest with a real editor/code index. Do not start it before #3 exists. |
