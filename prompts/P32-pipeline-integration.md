# P32: Pipeline Integration

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Integrate the pure scheduler into the AI plan generation pipeline: AI proposal -> scheduler -> validation -> stored plan version with daily `plan_items`.

## Tasks

1. In `apps/api/src/plans/plans.service.ts`:
   - After AI returns weekly milestones and tasks, pass them through `schedule(...)`.
   - If scheduler flags unscheduled work, append plain-language trade-off explanations to plan snapshot.
   - Materialize scheduled tasks as daily `plan_items` (`item_type = 'daily_task'`).
2. Tests:
   - Plan generation with overloaded input creates unscheduled tradeoffs.
   - E2E plan generation verifies daily `plan_items` exist.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P32, commit `feat(api): integrate pure scheduler into plan generation pipeline`.
