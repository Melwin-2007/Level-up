# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 7
- Current prompt: P70 (Complete)
- Branch: feat/p70-xp-ledger
- Next prompt: P71 (Streaks and achievements)

## Checklist

### Milestone 1: Foundations & Group Planning (Complete)

- [x] P00-P13 Complete (Repo bootstrap, DB/API/Mobile scaffolds, auth, submissions, reviews, acceptance)

### Milestone 2: AI Goal Analysis & Plan Generation (Complete)

- [x] P20-P25 Complete (LLM gateway, planner builder, decomposition, generation/approval APIs, mobile review)

### Milestone 3: Daily Task Scheduling Engine (Complete)

- [x] P30-P33 Complete (Pure scheduler, calendar/timezone, pipeline integration, mobile weekly/daily views)

### Milestone 4: Execution, Reminders, BullMQ (Complete)

- [x] P40-P45 Complete (BullMQ/Redis, task materialization, task execution & immutable logs, reminders, auto transitions, mobile execution)

### Milestone 5: Reoptimization and Version History (Complete)

- [x] P50-P53 Complete (Remaining-work calculator, reoptimize endpoint, approval & task sync, mobile version history)

### Milestone 6: Reports and Retrospectives (Complete)

- [x] P60 Metrics calculator
- [x] P61 Individual report generation
- [x] P62 Group report
- [x] P63 Mobile reports

### Milestone 7: XP and Gamification (In Progress)

- [x] P70 Ledger
- [ ] P71 Streaks and achievements

## Decisions made in sessions (also copied to DECISIONS.md)

- Implemented backend-only XP ledger and level derivation in `@mp/shared` and `apps/api` (`XpService`, `XpController`, `GET /me/xp`): awards task completion XP with deterministic idempotency keys (`${taskId}:task_completed:1`) scaled by estimated duration, deriving level progression dynamically from the append-only ledger sum via quadratic curve `50 * (L - 1) * L` without mutable counter columns.

- Implemented mobile monthly report views and retrospective controls (`apps/mobile/app/cycles/[id]/report.tsx`, `components/reports/`): built individual and group retrospective tabs with expandable formula calculation breakdowns, pure dark token SVG progress gauges (`no-hex-outside-tokens`), dual-plan baseline vs current plan comparison, evidence-backed AI insights citing metric IDs, `SharingSheet` granular privacy controls, and `RegenerateSheet` audit reason notes.

- Implemented group aggregated reports and granular privacy controls in `apps/api` (`ReportsService`, `ReportsController`, `GET /cycles/:id/reports/group`, `PUT /cycles/:id/reports/sharing`): aggregates group averages across shared metrics while strictly omitting unshared data (`null` / empty arrays) from member summaries, enforcing `report_type = 'group' AND user_id IS NULL`.

- Implemented individual monthly report generation in `apps/api` (`ReportsService`, `ReportsController`, `GET/POST /cycles/:id/reports/me`): combines pure `@mp/scheduler` metrics with evidence-backed AI insights strictly citing metric IDs (`reportInsightSchema`), persisting immutable `monthly_reports` rows without silent regeneration.
- Implemented pure metrics calculator in `@mp/scheduler` (`src/metrics.ts`) and `@mp/shared`: computes partial-credit goal achievement across checklist, metric, and binary criteria; priority-weighted achievement rate; task execution status counts; estimate accuracy and variance; consistency (active calendar days & weekly completion); dual-plan performance comparing baseline vs reoptimized plan; and composite `calculateCycleMetrics` carrying formulas and inputs for self-explaining report rendering.
- Implemented mobile plan version history & reoptimization UI (`PlanVersionSheet`, `ReoptimizeSheet`, `PlanDiffView`, `GET /cycles/:id/plan-versions`): lets members inspect historical/reoptimized plan versions, preview structured diffs (moved/added/removed tasks), trigger reoptimization with reason validation, and approve reoptimized plans under dark tokens.
- Implemented reoptimized plan approval and task synchronization in `PlansService.approvePlan`: sets `approvalStatus: 'approved'`, `isBaseline: false`, syncs future pending tasks, marks removed tasks as `cancelled`, and preserves completed tasks and `task_logs` 100% untouched.
- Implemented `POST /cycles/:id/reoptimize` in `PlansService` & `PlansController`: computes remaining work and schedules candidates across remaining cycle days, generates immutable `PlanDiff` (moved/removed tasks), and persists new pending `plan_versions` record without mutating baseline plan or active tasks.
- Implemented pure remaining-work calculator in `@mp/scheduler` (`calculateRemainingWork`): isolates completed tasks (immutable actuals), identifies slipped tasks with days-overdue metrics, aggregates future pending tasks, computes remaining capacity from today onwards, and derives feasibility balance and reschedule candidates without mutating input data.
- Implemented Mobile Today & Daily Execution View (`apps/mobile/app/(tabs)/index.tsx`, `TaskCard`, `TaskActionSheet`, `useTasks`): displays scheduled daily tasks, live stopwatch execution timer, completion and postpone logging with append-only sync, and `MonthStrip` day completion fill ratios under dark design tokens.
- Implemented `CycleTransitionsWorker`: scans active cycles and auto-advances phases past deadlines (submission -> review -> planning -> execution -> completed) while locking submissions and ensuring baseline requirements are met without deadlock.
- Implemented push token registration and notification preferences in `UsersService` & `UsersController` (`PUT/GET /me/push-token`, `PUT/GET /me/notification-preferences`), plus `RemindersWorker` computing timezone-offset delays and building privacy-preserving generic notifications.
- Implemented task execution endpoints in `TasksService` & `TasksController`: `GET /tasks`, `GET /tasks/:id`, and `POST /tasks/:id/log` supporting `start`, `pause`, `complete`, and `postpone` with `Idempotency-Key` header deduplication and append-only `task_logs`.
- Added task materialization in `PlansService.approvePlan`: upon promoting a plan version to baseline, all `daily_task` plan items are materialized into `tasks` linked to the cycle, goal, plan item, and scheduled date, guarding idempotency against re-materialization.
- Added Redis and BullMQ infrastructure with in-memory fallback for test and non-redis environments (`JobsService`), supporting queues `cycles` and `reminders` with delay, retry, worker registration, and `GET /admin/queues` status endpoint.
- Embedded `MonthStrip` in mobile plan review (`apps/mobile/app/cycles/[id]/plan.tsx`) with daily scheduled workload gauge fills and active load markers.
- Expanded weekly plan breakdown with scheduled daily tasks displaying dates, duration formatting, and titles while adhering to dark design tokens (zero raw hex literals outside `theme/tokens.ts`).
- Integrated pure scheduler into `PlansService.generatePlan` pipeline: chunks large milestones (>120m) into sequential daily tasks, schedules tasks against member availability, and records explicit tradeoffs and conflicts when capacity is constrained.
- Implemented timezone & calendar availability calculator in `@mp/scheduler` (`packages/scheduler/src/calendar.ts`) computing exact available minutes per local date across month lengths (28-31 days, leap years 2028, century leap 2000 vs 1900) and DST transitions (`America/New_York`, `Europe/London`).
- Implemented pure deterministic constraint-based task scheduling engine in `packages/scheduler` (`@mp/scheduler`) with zero framework or database dependencies, verified with 100 fast-check property iterations.
- Implemented `apps/mobile/app/cycles/[id]/plan.tsx` with prominent "Proposed by AI" banner on unapproved plans, feasibility capacity load bar, conflict alerts, and weekly milestone breakdown.
- Built AI Assistant bottom sheet using plain-row layout (no chat bubbles) providing plan pacing insights and adjustment regeneration form; added baseline approval flow with confirmation sheet and atomic lock.
- Implemented `POST /cycles/:id/approve-plan` and automatic cycle transition from `planning` to `execution` when all participating members (locked submissions) approve baseline plans.
- Implemented `POST /cycles/:id/generate-plan` and `GET /cycles/:id/plan` with 3 generations per cycle rate limit; persisted immutable plan versions and items atomically via Prisma transactions.
- Added AI provider abstraction (`LlmClient`, `FakeLlmClient`, `GeminiLlmClient`) with Zod-validated structured outputs, 30s timeout, jittered retries, and token/cost audit logging in `ai_action_logs`.
- Milestone 1-4 architectural foundations: Encrypted-AsyncStorage session storage, custom dark design tokens (zero raw hex), JWT verification with fail-closed security, single-query nested creates, append-only triggers on `task_logs`, and comprehensive e2e and unit acceptance suites.

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.
- [PROD DEPLOYMENT]: The API container is packaged in `apps/api/Dockerfile`. To deploy to Railway/Render/Fly, create a service with build context `.` and Dockerfile `apps/api/Dockerfile`, configure env vars from `docs/SETUP.md` Section 11, and run `prisma migrate deploy`.
