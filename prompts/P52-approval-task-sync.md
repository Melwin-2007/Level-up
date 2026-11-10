# P52: Approval and Task Sync

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Extend plan approval logic so that approving a `reoptimized` version syncs future execution tasks: replaces future pending tasks only, marks removed tasks as `cancelled`, and preserves completed/postponed history.

## Tasks

1. In `apps/api`:
   - `PlansService.approvePlan`:
     - If approving a `reoptimized` plan:
       - Update approval status: `approved`, `approvedAt = clock.now()`, `isBaseline = false`.
       - Query member's existing tasks for the cycle.
       - Completed tasks and their logs remain 100% untouched.
       - Tasks on or after `today` that are still `pending` or `postponed` are updated/rescheduled to match the new approved plan items.
       - Future tasks removed from the new plan are marked `cancelled` (rows preserved with status `cancelled`).
       - New tasks in the plan are materialized into `tasks` table.
2. Unit tests in `apps/api`:
   - Approving reoptimized plan replaces future pending tasks only.
   - Cancelled tasks keep row with status `cancelled`.
   - Completed and postponed history stays unchanged.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P52, commit `feat(plans): reoptimized plan approval and future task sync`.
