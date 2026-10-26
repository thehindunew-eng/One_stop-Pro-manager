# The AI PM: architecture, prompt, and what was changed

This document keeps the **original architecture brief** (section 1) next to **what was actually built** (sections 2–6),
so the intent is on record and the differences are not a surprise later.

- Directive version: `aipm.room/1.0` — `lib/aipm/prompt.ts`
- Orchestration: `lib/aipm/index.ts`
- Guards: `lib/aipm/guards.ts` · context slice: `lib/aipm/context.ts` · privacy: `lib/aipm/scrub.ts`
- Storage: `aipm_findings`, `aipm_runs` (`lib/aipm/store.ts`)
- Interface: `GET/POST /api/aipm`, `components/GuardPanel.tsx` (Build → *AI PM guard*), owner toggles in
  `/room/<code>/admin` → *Live*
- **Control plane:** every control in the brief, where it is enforced and how to prove it →
  [`docs/AI-PM-CONTROLS.md`](AI-PM-CONTROLS.md) (includes the directive quoted copy-ready)

---

## 1. The original brief (unchanged, for reference)

> You are the AI Product Manager (AI PM), an active, real-time orchestrator integrated directly into a collaborative
> IDE environment. Your goal is to guide the engineering team toward successful product delivery, monitor project
> velocity, and flag technical or architectural deviations before they become costly blockers.
> You do not write raw code. Instead, you operate as a workflow engine, context bridge, and governance layer.
>
> **1. Context ingestion.** WORKSPACE STATE: shared CRDT event vectors with uncommitted live drafts. CODEBASE
> CAPABILITIES: a vector/graph DB of file trees, module dependencies and code ownership. PRODUCT SPECIFICATION:
> markdown requirements, Jira/Linear tickets, Figma links. GIT TELEMETRY: branches, open PRs, commit logs.
>
> **2. Protocols.** (A) Multi-player conflict detection from the CRDT state vector, inline IDE alert, no blocking
> unless "Strict Architecture Mode". (B) Spec-to-code alignment, inline chat note or pre-flight PR comment.
> (C) Velocity and bottleneck remediation drafted for the lead PM dashboard.
>
> **3. Constraints.** Strip and never log `.env`, credentials, tokens, developer keys. Zero authority to push, merge,
> delete branches or alter tickets without multi-factor human authorisation. Never interrupt active coding for
> low-priority notifications; queue into a digest unless a severe architectural break occurs. Every recommendation
> carries a confidence score and exact data sources.
>
> **4. Outputs.** Developer: a JSON block with `target_developer`, `alert_type`, `severity`, `file_path`,
> `line_range`, `message`, `suggested_action`. Lead PM: markdown narrative — trajectory, cross-team blockers with
> confidence, spec gaps. Team: an event trigger when a feature module links across workspaces.
>
> **Implementation.** Event-driven execution (CRDT idle, file save, git push/PR) instead of streaming the codebase;
> graph-DB pre-filtering to keep tokens small; an `// @aipm-ignore` directive that slices marked code out of the
> context before it reaches the model.

---

## 2. What this platform actually has

The brief assumes an IDE. This product is a collaborative **product-building room** with a board, gates, documents,
a tool wall and a Build room — plus, for each member, their own GitHub token. That difference decides the design.

| Brief assumed | Here | Consequence |
| --- | --- | --- |
| CRDT buffers of uncommitted code, idle detection | No editor, no CRDT; the room polls every 14s | Guard triggers are **sync events**: work-log entries, branch/PR links, task status changes, explicit runs |
| Vector/graph DB of the file tree | Nothing indexes the repo | Slice is **pre-filtered by hand**: the current stage, tasks in flight, the requirement-shaped lines of 10 documents, 12–20 commits |
| Jira/Linear tickets | The room's own board + 30 documents | Spec citations point at `doc#kind` and task ids, which the room genuinely owns |
| Inline IDE alerts, PR comments | No editor; PR comments would need a broader token scope | Findings appear in **Build → AI PM guard**, on the board card, and in the section-4 output shapes |
| Block typing in strict mode | Nothing to block | Strict mode blocks **marking a task done** while a HIGH deviation is open (409, with the finding named) |

---

## 3. The directive, in short

The full text is `lib/aipm/prompt.ts` and is versioned (`PROMPT_VERSION`); every stored finding records the version
that produced it. The parts that matter:

1. **Section 1** tells the model exactly which streams it gets — room state, repository telemetry *through the
   member's own token*, the stage documents — and, deliberately, an explicit list of what it does **not** have
   (editor buffers, test output, deploy logs) so it cannot bluff.
2. **Section 2** defines four guards: **Overlap**, **Spec**, **Velocity**, **Gate**. Each has a trigger, and a rule
   that a finding without a citable source is downgraded or dropped.
3. **Section 3** keeps the brief's constraints almost verbatim — privacy, no autonomous writes, noise budget,
   confidence + citations, economy — and adds one: *if the slice is insufficient, return nothing and say so*.
4. **Section 4** collapses the three output types into one JSON contract that carries the audience inside each
   finding (`target`), plus `trajectory` and `sync_suggestion` for the lead PM. The three human-facing surfaces are
   rendered by the app, not by the model, so formatting cannot drift.

Changes from the brief's JSON output: `file_path` + `line_range` became `target` + `task_id` + `citations`, because
file-level line numbers are exactly the detail this platform cannot see and would therefore invent.

---

## 4. How the loop runs

```
POST /api/aipm { action: 'run' }
   ├─ 0. run ceiling       ≥ maxRunsPerDay in 24h → 429 before any read or model call
   ├─ 1. buildSlice()      bounded, scrubbed context (tasks, notes, docs, commits, gates, presence)
   ├─ 2. guards.ts         overlap · spec · velocity · gate   ← deterministic, no network, always on
   ├─ 3. callLLM()         only if a provider is configured; same slice, JSON-only answer
   ├─ 4. validation        citations must exist in the slice; ≤6 findings; no invented task ids
   ├─ 5. noise budget      ≤3 per person/day, 1 HIGH per task/day, identical fingerprint suppressed
   └─ 6. persist           aipm_findings + aipm_runs (engine, prompt version, gaps, duration)
```

**Why deterministic first.** With no API key, no Ollama and no network, the room still gets the four arithmetic
guards. The model adds recall for prose-level spec drift; it is not the thing that decides whether a task is late.

**Triggers.** `action:'run'` can be called from the guard panel, and the same function is what a cron/job would call
after a push or a status change. There is no keystroke-level trigger because there is no keystroke stream.

---

## 5. The safety properties, and how to check them

| Property | Where it is enforced | How to verify |
| --- | --- | --- |
| No secret in the context | `lib/aipm/scrub.ts` — GitHub/OpenAI/Anthropic/Google/Groq/Figma tokens, `postgres://`, JWTs, bearer headers, `*_SECRET=` assignments | `containsSecret()` in `lib/aipm/scrub.ts`; unit-checked in `scripts/check-aipm.cjs` |
| No secret in a finding | The slice is scrubbed before the model sees it, and findings are persisted as returned | search `aipm_findings` for token shapes |
| `@aipm-ignore` respected | Scrubber removes the block (or the line) before the model call | put the marker in a work-log note, re-run, inspect the finding |
| No autonomous writes | `/api/aipm` only: `run`, `settings`, `confirm`, `acknowledge`, `dismiss`. No GitHub write path exists in `lib/aipm/*` | read the route; `lib/aipm/**` has no `fetch` to GitHub except reading commits |
| Human named on every action | `aipm_findings.confirmed_by`, room transcript entry on confirm | act on a finding, open `aipm_findings` |
| No repeats | fingerprint `kind|task|citation-refs`, `UNIQUE(project_id, fingerprint)` | run twice; second run reports `duplicates` |
| Noise budget | per-target count over 24h, plus one HIGH per task per day | set 0 in the owner console and run |
| Spend ceiling | `maxRunsPerDay` counted from `aipm_runs`, checked at the top of `runAipm()` | set it to 2, run three times — the third returns 429 |
| Confidence + citations always | `Finding` type requires both; model findings without valid citations are dropped | inspect a stored row |

---

## 6. What is genuinely not possible here

- **Line-level conflict detection.** Without editor buffers or a code index, the overlap guard compares *declared*
  artefacts — files named in notes, branch feature prefixes, commit files — not two people's cursors. Its
  confidence numbers say so (0.55 for a branch prefix, 0.72 for a shared file).
- **Pre-flight PR comments.** Possible only with `pull_request: write` on each member's token. Not enabled; the
  finding lives in the room instead, and the member can paste it into the PR.
- **Test and deploy evidence.** No test runner, no deploy logs, no Vercel status feed yet. A guard cannot say a
  change is broken, only that it contradicts something written.
- **A background scheduler.** The loop runs when a human presses the button. Wiring it to Vercel Cron / GitHub
  Actions is a small, separate change — and it should come with the digest delivery mechanism, which does not exist
  yet either.
- **"Multi-factor" authorisation.** The brief asked for it; the honest implementation here is a named human with
  edit rights confirming in the UI, recorded in the database. Calling that multi-factor would be a lie.
