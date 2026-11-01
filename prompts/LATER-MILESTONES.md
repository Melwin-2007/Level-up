# Prompts for Milestones 2 to 9

Use the same loop as Milestone 1: new branch, one prompt, review in a fresh session, update PROGRESS.md. Before starting a milestone, add its prompts as separate files `prompts/P2x-*.md` using the template in P05 and write down any new decisions in DECISIONS.md first. The prompts below are the contents of those files, in order.

Common READ for every item: AGENTS.md, docs/PROGRESS.md, the SPEC sections named, docs/DATABASE.md (three-record principle), docs/SECURITY.md.

---

## M2: AI goal analysis and plan generation

### P20: LLM gateway

Create `apps/api/src/ai` with an `LlmClient` interface and one provider implementation selected by env (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`). Features: structured outputs validated with zod, timeouts (30 s), retries with jitter (max 2), token and cost logging per call to `ai_action_logs` (table exists), prompt versions stored by id. A `FakeLlmClient` for tests returns fixtures. No endpoint yet. Tests: schema violations are rejected and retried once; secrets never appear in logs.

### P21: Planner input builder

Pure function `buildPlannerInput(cycleId, userId)` returning only: locked submission goals, availability, constraints, member timezone, historical completion stats (null in M2). The model never receives other members' data or free-form database access. Snapshot-test the shape. Tests prove no other member's content can enter the input.

### P22: Feasibility and decomposition

Prompt + schema for: feasibility verdict per goal, conflicts, milestones per goal with weeks, rationale. Output schema in `@mp/shared`. Store the raw model output and prompt version in `ai_action_logs`. Tests with fixtures covering infeasible total hours, conflicting deadlines, missing dependencies.

### P23: `POST /cycles/:id/generate-plan`

Allowed only in `planning`. Creates a `plan_versions` row (`initial`, `pending`, `is_baseline = false`) with `plan_snapshot` and `plan_items` (milestones and weekly tasks only; daily tasks arrive in M3). Idempotent per request key. Rate limit 3 per cycle per member. Returns the plan with explanations. Tests: ownership, state, immutability of earlier versions.

### P24: `POST /cycles/:id/approve-plan`

Approve a pending version: sets `approved`, `approved_at`; if it is the member's first approved plan it becomes `is_baseline = true` (single transaction; relies on the partial unique index). Reject approving a rejected or already approved version. Cycle advances to `execution` when all participating members approved or the owner proceeds. Tests include the double-approve race.

### P25: Mobile AI plan review

Screens "Plan review" (feasibility summary, milestones by week, flagged conflicts, Approve / Request changes) and the "AI assistant" tab limited to explaining the plan and requesting regeneration with a typed note (stored, passed to the next generation as an input constraint). Follow DESIGN.md; no chat-bubble styling: question and answer as plain rows. Visible label "Proposed by AI" on every unapproved plan.

---

## M3: Scheduling engine

### P30: Pure scheduler

`packages/scheduler` (no Nest, no DB): `schedule(input) => { scheduled, unscheduled, violations, tradeoffs }`. Hard constraints from SPEC 4.3: no overlaps, within availability, dependencies respected, deadlines, daily limit. Deterministic. Start with a greedy earliest-deadline-first heuristic with priority weights. Property-based tests (fast-check): no output ever violates a hard constraint; total scheduled minutes never exceed capacity. Never silently drop work: everything is scheduled or listed as unscheduled with a reason.

### P31: Timezone and calendar handling

Compute the member's available minutes per local date for the cycle month, handling month length, weekdays, dated exceptions, DST-free Asia/Kolkata and at least two DST zones in tests. Store dates as local dates, timestamps UTC.

### P32: Pipeline integration

AI proposal -> scheduler -> validation -> stored plan version. If the scheduler returns unscheduled work, the plan shows it and the explanation names the trade-off in plain language derived from scheduler output, not invented by the model. Daily tasks are created in `plan_items`.

### P33: Mobile weekly and daily planner views

Weekly planner (milestones by week) and daily planner (read-only for now), `MonthStrip` shows planned load per day as marker height.

---

## M4: Execution, reminders, BullMQ

### P40: Infrastructure

Add Redis (managed) and BullMQ in a `jobs` module. Queue for: cycle auto-advance on deadlines, reminder dispatch, report generation (later). Bull Board only in non-production behind auth. Tests use an in-memory or ioredis-mock strategy documented in TESTING.md.

### P41: Task materialization

On first plan approval, create `tasks` from the baseline `plan_items` (daily tasks), linked to goals. Tasks reference plan item ids in metadata so reports can compare to baseline.

### P42: Task API and logs

Endpoints to start, pause, complete, postpone, add feedback. Each writes an append-only `task_logs` row; the task status is derived or updated in the same transaction. Completed logs are never edited. Idempotency key header on every write.

### P43: Reminders

Expo push token registration, per-user notification settings, daily summary and deadline reminders scheduled via BullMQ in the member's timezone. Notification content never contains goal text on the lock screen (generic copy).

### P44: Automatic cycle transitions

Jobs implement the transition table in docs/API.md using the Clock. Tests with a fake Clock cover every transition and the "do not block on a missing member" rule.

### P45: Mobile Today and daily execution

Today tab becomes the daily planner with tasks, timer, postpone with reason, feedback. `MonthStrip` fills by completion ratio. XP is not shown yet.

---

## M5: Reoptimization

### P50: Remaining-work calculator

Pure function: given baseline, current version, logs and today, compute remaining tasks, remaining capacity, slipped work. Never reads or writes completed work.

### P51: `POST /cycles/:id/reoptimize`

Input: reason (typed note), optional new/changed goals. Pipeline: remaining-work -> AI proposal limited to remaining period -> scheduler -> new `plan_versions` row (`reoptimized`, `pending`, `is_baseline = false`). Diff against the current approved version (added, removed, moved, resized). Tests: baseline untouched, past logs untouched, completed tasks unchanged, new version number increments.

### P52: Approval and task sync

Approving a reoptimized version replaces future pending tasks only (cancelled tasks keep their rows with status `cancelled`; completed and postponed history stays). Tests for each status.

### P53: Mobile version history

List versions with a plain diff view: what moved, what was removed, why (generated from the diff, not invented). Approve or discard.

---

## M6: Reports

### P60: Metrics calculator

Pure, deterministic functions producing: weighted achievement rate (SPEC 5 formula, with partial-credit rules from success criteria), task execution counts, estimate accuracy, consistency (active days, weekly completion), baseline performance and current-plan performance. Table-driven tests with hand-computed expected values. Each metric carries its inputs so the report can show the calculation.

### P61: Individual report generation

Job produces `monthly_reports` row: stored metrics, plus AI insights restricted to evidence provided in the input. Post-check: the insight JSON must cite metric ids; reject insights without a citation. No causal claims about motives. Reports are stored once and never regenerated silently; regeneration creates a new row with a note.

### P62: Group report

Aggregates only. Respect per-member sharing settings (add a `sharing` JSON on the profile or submission as decided in DECISIONS.md first). Tests: private fields never appear in the group report for any sharing setting combination.

### P63: Mobile reports

Monthly report screen with expandable calculations, baseline versus current plan tabs, group report screen. Charts drawn with simple SVG using palette tokens only; every chart has a text equivalent.

---

## M7: XP and gamification

### P70: Ledger

Backend-only XP awards from task completion events using `idempotency_key = taskId:eventType:version`. Rules in a constants file with tests. Levels derived from the ledger sum, never stored as mutable counters.

### P71: Streaks and achievements

Derived from task logs and cycle history through pure functions; achievements are computed, with an `awarded` ledger entry for each. Mobile shows these on the You tab, small and secondary, per DESIGN.md.

---

## M8: Offline sync

### P80: Design note first

Write `docs/SYNC.md`: what is local, what is queued, conflict policy per entity (task logs append-only so no conflicts; task status last-writer-wins by server timestamp; submissions and plans online-only), idempotency, outbox retry. Review it before coding.

### P81: SQLite outbox

Local SQLite store for tasks and logs, outbox table with idempotency keys, background sync on connectivity regain, server endpoint `POST /sync/push` and `GET /sync/pull?since=`. Tests: replaying the same outbox twice changes nothing; offline completion appears once online.

---

## M9: Advanced analytics

### P90: Month-over-month

Needs at least two completed cycles. Use stored report metrics only (never recomputed from mutable data). Estimation-accuracy trend, consistency trend, goal category success rates. No new AI claims without cited metrics.
