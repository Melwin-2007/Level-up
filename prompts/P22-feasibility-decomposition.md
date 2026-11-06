# P22: Feasibility and Decomposition

READ: AGENTS.md, docs/PROGRESS.md, docs/SPEC.md (sections on AI planning and goal decomposition), docs/DATABASE.md.

## Goal

Define structured schemas and prompts for goal feasibility verdicts, conflict identification, and weekly milestone decomposition.

## Tasks

1. Define `FeasibilityReportSchema` and `GoalDecompositionSchema` in `packages/shared/src/validation/planner.ts`:
   - `verdict`: `feasible` | `tight` | `infeasible`.
   - `totalEstimatedHours`, `totalAvailableHours`, `capacityRatio`.
   - `goalVerdicts`: array per goal with `goalId`, `status` (`achievable`, `at_risk`, `unrealistic`), `risks: string[]`, `recommendations: string[]`.
   - `conflicts`: array of `{ type: 'capacity' | 'deadline' | 'dependency', description: string, goalIds: string[] }`.
   - `milestones`: array of `{ goalId: string, title: string, description?: string, targetWeek: number, estimatedMinutes: number, dependencies?: string[] }`.
   - `rationale`: string summary explaining tradeoffs and pacing.
2. Implement `FeasibilityPrompt` and `PlannerPrompt` templates with versioned IDs (`planner-v1`, `feasibility-v1`) in `apps/api/src/ai/prompts/`.
3. Unit tests in `apps/api/src/ai/__tests__/feasibility-decomposition.spec.ts`:
   - Schema validation with Zod against valid and invalid fixtures.
   - Fixture scenarios:
     1. Infeasible total hours (e.g., 120h required vs 40h available).
     2. Conflicting deadlines (e.g., dependent goal scheduled before prerequisite).
     3. Missing or cyclic dependencies.
   - Validate audit log emission with prompt version and model name.

## Verify

```
pnpm --filter api test -- feasibility-decomposition
```

## Finish

Tick P22 in `docs/PROGRESS.md`, commit `feat(api): goal feasibility and milestone decomposition schemas and prompts`.
