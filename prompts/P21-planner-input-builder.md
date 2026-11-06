# P21: Planner Input Builder

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md (three-record principle), docs/SECURITY.md (privacy boundaries).

## Goal

Create a pure, strictly isolated function `buildPlannerInput(cycleId, userId, db)` returning only the target member's locked submission goals, availability, constraints, and timezone. The model never receives other members' data or unrestricted database access.

## Tasks

1. Define `PlannerInput` and related types in `packages/shared/src/types/planner.ts` and export them:
   - Target member ID and timezone.
   - Goals: title, description, category, priority, estimated hours, deadline, success criteria, dependencies.
   - Availability: weekly recurring schedule, date-specific capacity overrides.
   - Constraints: max hours per day, blackout periods, preferred focus blocks.
   - Historical completion stats: null in M2 (stubbed for future milestone).
2. Implement `buildPlannerInput` in `apps/api/src/ai/planner-input.builder.ts`:
   - Validates that the member's submission is `locked` (rejects `draft` or `submitted` with appropriate error).
   - Validates that the cycle exists and is in `planning` state.
   - Queries strictly for the caller's `monthly_submissions` row and `submission_goals`.
   - Never loads group members' names, submissions, availability, or constraints.
3. Unit tests in `apps/api/src/ai/__tests__/planner-input.builder.spec.ts`:
   - Snapshot test of the generated `PlannerInput` shape.
   - Privacy test: Mock DB returns multiple members; proves that under no circumstance can member B's data enter member A's input.
   - Throws error if submission is not locked or does not exist.

## Verify

```
pnpm --filter api test -- planner-input.builder
```

## Finish

Tick P21 in `docs/PROGRESS.md`, commit `feat(api): planner input builder with strict privacy isolation`.
