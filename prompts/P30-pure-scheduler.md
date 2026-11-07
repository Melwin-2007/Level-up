# P30: Pure scheduler

READ: AGENTS.md, docs/PROGRESS.md, docs/ROADMAP.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Create `packages/scheduler` (pure TypeScript, zero Nest, zero DB dependencies) implementing the deterministic constraint-based task scheduling engine:
`schedule(input: SchedulerInput): SchedulerOutput`.

## Tasks

1. Initialize workspace package `packages/scheduler`:
   - `package.json` named `@mp/scheduler`, TypeScript config extending root `tsconfig.base.json`, Vitest config.
   - Wire package into monorepo root and workspace dependencies.
2. Define input and output domain types:
   - `TaskCandidate`: id, goalId, title, estimatedMinutes, priority (1-5), deadline (YYYY-MM-DD), dependencies (ids of prerequisite tasks/goals), preferredTimeOfDay (optional: morning, afternoon, evening), fixedSlot (optional: { date, startMinute, endMinute }).
   - `TimeSlot` / `DayAvailability`: date (YYYY-MM-DD), availableMinutes, slots: Array<{ startMinute: number; endMinute: number }>.
   - `SchedulerInput`: tasks: TaskCandidate[], availability: DayAvailability[], maxDailyMinutes?: number.
   - `ScheduledTask`: taskId, goalId, date, startMinute, endMinute, durationMinutes.
   - `UnscheduledTask`: taskId, goalId, reason: 'insufficient_capacity' | 'deadline_unreachable' | 'unmet_dependency' | 'daily_limit_exceeded' | 'conflict', details: string.
   - `SchedulerOutput`: scheduled: ScheduledTask[], unscheduled: UnscheduledTask[], violations: ConstraintViolation[], tradeoffs: TradeoffExplanation[].
3. Implement deterministic scheduling engine (`schedule`):
   - Hard constraints:
     - No overlaps: no two tasks scheduled in the same time window.
     - Within availability: tasks only scheduled inside provided availability slots.
     - Dependencies respected: prerequisite tasks must be completed on or before the candidate task's scheduled slot.
     - Deadlines respected: tasks must be scheduled on or before their deadline date.
     - Daily limit: scheduled task minutes on any day cannot exceed `maxDailyMinutes` or day's available minutes.
   - Deterministic algorithm:
     - Topological sort for dependency resolution.
     - Earliest Deadline First (EDF) with priority weighting tie-breaking.
     - Bin-packing / interval assignment into valid slots.
   - Never silently drop work: every task candidate is either in `scheduled` or in `unscheduled` with a descriptive reason.
   - Generate human-readable tradeoffs explaining why unscheduled items couldn't fit.
4. Comprehensive testing:
   - Unit tests covering:
     - Empty inputs, single task, multiple tasks.
     - Dependency chaining (task B depends on task A).
     - Tight deadlines and infeasible total hours.
     - Fixed slot vs flexible slot collisions.
     - Priority tie-breaking.
   - Property-based tests with `fast-check`:
     - Invariant 1: No two scheduled tasks ever overlap in time.
     - Invariant 2: Total scheduled minutes on any day <= day's available minutes.
     - Invariant 3: No scheduled task is placed after its deadline.
     - Invariant 4: No task is scheduled before its dependencies.
     - Invariant 5: `candidates.length === scheduled.length + unscheduled.length` (zero work silently dropped).

## Constraints

- Pure functions, zero I/O, zero network, zero database, zero framework coupling.
- Fully deterministic: identical input produces identical schedule every run.
- TypeScript strictly typed, no `any`, no `@ts-ignore`.

## Verify

```
pnpm --filter @mp/scheduler test
```

## Finish

Tick P30 in `docs/PROGRESS.md`, commit `feat(scheduler): pure deterministic constraint scheduling engine`.
