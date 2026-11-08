# P41: Task Materialization

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/API.md.

## Goal

On first plan approval (when `is_baseline = true`), materialize `tasks` from the baseline `plan_items` (daily tasks), linked to goals and cycle.

## Tasks

1. In `apps/api/src/plans/plans.service.ts`:
   - When approving a plan version and setting `isBaseline = true`:
   - Find all `plan_items` with `item_type === 'daily_task'`.
   - Create corresponding `tasks` rows with:
     - `cycleId`, `userId`, `goalId`, `planItemId`: item.id
     - `title`: item.title
     - `description`: item.description
     - `status`: 'pending'
     - `scheduledDate`: item.plannedDate
     - `estimatedMinutes`: item.estimatedMinutes
2. Ensure idempotent behavior: do not duplicate tasks if already materialized.
3. Tests:
   - Approving baseline plan creates exact matching tasks with links to goals and plan items.
   - Re-approving or secondary approvals do not re-materialize duplicate tasks.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P41, commit `feat(plans): materialize daily tasks on baseline plan approval`.
