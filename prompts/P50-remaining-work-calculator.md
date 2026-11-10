# P50: Remaining-work calculator

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Create a pure function in `packages/scheduler` (`@mp/scheduler`):
`calculateRemainingWork(input: RemainingWorkInput): RemainingWorkOutput`
that computes remaining tasks, remaining available capacity, slipped work, and net feasibility deficit from a given evaluation date (`today`).
Never reads or writes completed work or mutates input data.

## Tasks

1. In `packages/scheduler`:
   - Define domain interfaces in `src/types.ts` (or `src/remaining-work.ts`):
     - `TaskExecutionItem`: id, goalId, title, scheduledDate (YYYY-MM-DD), estimatedMinutes, status ('pending' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'), actualMinutes, completedAt.
     - `PlanItemSnapshot`: id, goalId, itemType, title, plannedDate, estimatedMinutes, weekNumber.
     - `RemainingWorkInput`:
       - `today`: string (YYYY-MM-DD).
       - `cycleStartDate`: string (YYYY-MM-DD).
       - `cycleEndDate`: string (YYYY-MM-DD).
       - `availability`: DayAvailability[] (from today through cycleEndDate).
       - `currentTasks`: TaskExecutionItem[].
       - `baselinePlanItems`?: PlanItemSnapshot[].
       - `currentPlanItems`?: PlanItemSnapshot[].
     - `SlippedTask`: task: TaskExecutionItem, daysOverdue: number, originalDate: string.
     - `RemainingWorkOutput`:
       - `today`: string.
       - `completedTasks`: TaskExecutionItem[].
       - `completedMinutes`: number.
       - `slippedTasks`: SlippedTask[];
       - `slippedMinutes`: number;
       - `futurePendingTasks`: TaskExecutionItem[];
       - `futurePendingMinutes`: number;
       - `totalRemainingMinutes`: number;
       - `remainingCapacityMinutes`: number;
       - `capacityDeficitMinutes`: number;
       - `isFeasible`: boolean;
       - `uncompletedTasksToReschedule`: TaskCandidate[];
   - Implement `calculateRemainingWork` in `src/remaining-work.ts`.
   - Export from `src/index.ts`.
2. Unit tests in `packages/scheduler/src/__tests__/remaining-work.spec.ts`:
   - Tasks completed on or before `today` are marked completed and never modified.
   - Uncompleted tasks before `today` are accurately categorized as slipped with positive `daysOverdue`.
   - Future pending tasks on or after `today` are identified.
   - Uncompleted tasks to reschedule are converted into `TaskCandidate` items for the scheduler.
   - Total remaining minutes and capacity deficit correctly derived.
   - Edge cases:
     - `today` is cycle start date (0 slipped, all pending).
     - `today` is cycle end date.
     - Zero tasks, 100% completed tasks, 100% slipped tasks.
     - Deficit when remaining minutes exceed remaining capacity.

## Verify

```
pnpm --filter @mp/scheduler test
```

## Finish

Tick P50, commit `feat(scheduler): remaining work calculator for mid-month reoptimization`.
