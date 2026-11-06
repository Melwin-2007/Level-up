# P23: Plan Generation API (`POST /cycles/:id/generate-plan`)

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md, docs/DECISIONS.md (34), docs/TESTING.md.

## Goal

Create the `POST /cycles/:id/generate-plan` endpoint to invoke the AI planner, generate an initial or regenerated plan version with milestones and weekly tasks, enforce cycle state preconditions, rate limits, and immutability.

## Tasks

1. Endpoint `POST /cycles/:id/generate-plan`:
   - Allowed only when cycle phase is `planning` (`CycleStateService.assertAllows(cycle, 'plan.generate')`).
   - Member must have a `locked` submission for the cycle.
   - Rate limit: max 3 generations per cycle per member.
   - Idempotency support via `Idempotency-Key` or request hash.
   - Optional parameter: `adjustmentsNote?: string` (used when requesting regeneration with user feedback).
2. Plan Version creation in transaction:
   - Queries `max(version_number)` for `(cycle_id, user_id)`.
   - Creates `plan_versions` row with `version_number` (1 for initial, N+1 for re-plan), `version_type = 'initial'` or `'regenerated'`, `approval_status = 'pending'`, `is_baseline = false`, `plan_snapshot` storing raw AI decomposition.
   - Creates corresponding `plan_items` rows (`item_type = 'milestone' | 'weekly_task'`, `week_number`, `estimated_minutes`, `order_index`).
   - Prior unapproved plan versions remain immutable (status remains pending or marked superseded).
3. E2E and Service tests in `apps/api/test/plan-generation.e2e-spec.ts`:
   - Cycle state check: fails with `CYCLE_STATE_INVALID` if not in `planning`.
   - Ownership: member cannot generate plan for another user.
   - Rate limiting: 4th generation attempt is rejected with 429 `PLAN_GENERATION_LIMIT_EXCEEDED`.
   - Immutability of earlier plan versions.
   - Generates plan and items matching snapshot schemas.

## Verify

```
pnpm --filter api test:e2e -- plan-generation
```

## Finish

Tick P23 in `docs/PROGRESS.md`, commit `feat(api): plan generation endpoint with plan versions and items`.
