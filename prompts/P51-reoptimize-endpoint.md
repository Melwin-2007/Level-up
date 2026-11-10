# P51: `POST /cycles/:id/reoptimize`

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Endpoint `POST /cycles/:id/reoptimize` allowed only in `execution` phase.
Calculates remaining work via `calculateRemainingWork`, generates updated schedule for remaining period using AI proposal and pure scheduler, and creates a new `plan_versions` row (`reoptimized`, `pending`, `is_baseline = false`) with plain diff comparison against the active approved plan.

## Tasks

1. Schema validation in `@mp/shared`:
   - `reoptimizePlanSchema`: `reason`: string (10..500 chars), optional goal changes.
   - `PlanDiff`: added tasks, removed tasks, moved tasks, duration changes.
2. In `apps/api`:
   - `POST /cycles/:id/reoptimize`:
     - Must be in `execution` cycle phase.
     - Fetches member's active approved plan and current task statuses.
     - Computes remaining work from today through cycle end date.
     - Feeds remaining tasks and capacity into AI decomposition / scheduler.
     - Generates diff against current approved plan.
     - Stores new `plan_versions` row (`reoptimized`, `pending`, `is_baseline = false`, incremented `version_number`) and corresponding `plan_items`.
     - Baseline version is untouched. Completed tasks and past logs are untouched.
3. Tests in `apps/api`:
   - Reoptimization forbidden in non-execution phases.
   - Version number increments; baseline remains untouched.
   - Completed tasks and logs remain unchanged.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P51, commit `feat(plans): cycle reoptimization endpoint with version diff`.
