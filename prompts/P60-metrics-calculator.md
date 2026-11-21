# P60: Metrics Calculator

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md.

## Goal

Create a pure, deterministic metrics calculation module in `packages/scheduler` (and shared types in `packages/shared`):
producing:

1. Weighted achievement rate (with partial-credit rules from success criteria).
2. Task execution counts and execution ratios.
3. Estimate accuracy (actual vs estimated variance on completed tasks).
4. Consistency (active calendar days and weekly completion rates).
5. Baseline vs Current-Plan dual performance comparison.

Every metric carries its inputs and human-readable formula so the mobile report can display the exact derivation.

## Tasks

1. In `packages/shared/src/validation/reports.ts`:
   - Define Zod schemas and TypeScript types for metrics and reports:
     - `SuccessCriteriaProgress`: checklist completed items, metric current value, binary verdict.
     - `GoalMetricInput`: goalId, title, priority (1-5), estimatedHours, successCriteria, progress.
     - `MetricResult<T>`: value, displayValue, formula, inputs.
     - `WeightedAchievementMetric`: overallScore, totalWeight, goals: GoalAchievementDetail[].
     - `TaskExecutionMetric`: totalTasks, completedTasks, inProgressTasks, pendingTasks, postponedTasks, cancelledTasks, completionRate, totalEstimatedMinutes, totalActualMinutes.
     - `EstimateAccuracyMetric`: totalEstimatedMinutes, totalActualMinutes, varianceMinutes, accuracyRatio, taskBreakdown: TaskAccuracyItem[].
     - `ConsistencyMetric`: activeDays, totalCycleDays, activeDaysRatio, weeklyCompletion: WeekConsistencyItem[].
     - `PlanComparisonMetric`: baseline (plannedTasks, completedTasks, completionRate), currentPlan (plannedTasks, completedTasks, completionRate), scopeVariance.
     - `CycleReportMetrics`: composite holding all 5 metric results.
   - Export from `packages/shared/src/index.ts`.

2. In `packages/scheduler`:
   - Implement pure calculation functions in `src/metrics.ts`:
     - `calculateGoalAchievement(goal: GoalMetricInput, tasks: TaskExecutionItem[]): GoalAchievementDetail`
     - `calculateWeightedAchievement(goals: GoalMetricInput[], tasks: TaskExecutionItem[]): MetricResult<WeightedAchievementMetric>`
     - `calculateTaskExecutionCounts(tasks: TaskExecutionItem[], logs?: TaskLogItem[]): MetricResult<TaskExecutionMetric>`
     - `calculateEstimateAccuracy(tasks: TaskExecutionItem[]): MetricResult<EstimateAccuracyMetric>`
     - `calculateConsistency(tasks: TaskExecutionItem[], logs: TaskLogItem[], cycleStartDate: string, cycleEndDate: string): MetricResult<ConsistencyMetric>`
     - `calculatePlanComparison(baselineItems: PlanItemSnapshot[], currentItems: PlanItemSnapshot[], tasks: TaskExecutionItem[]): MetricResult<PlanComparisonMetric>`
     - `calculateCycleMetrics(input: CycleMetricsInput): CycleReportMetrics`
   - Export from `src/index.ts`.

3. Unit Tests in `packages/scheduler/src/__tests__/metrics.spec.ts`:
   - Table-driven tests with hand-computed expected values.
   - Partial-credit for checklist (e.g. 2 of 4 items = 0.50).
   - Partial-credit for metric target (e.g. 75 of 100 = 0.75).
   - Binary criteria (0.0 vs 1.0).
   - Task fallback when no success criteria.
   - Estimate accuracy calculation on completed tasks.
   - Consistency calculation with distinct active days from logs/tasks.
   - Dual-plan baseline vs current plan comparison.
   - Edge cases: 0 tasks, 0 goals, all tasks postponed, zero estimated minutes.

## Verify

```
pnpm --filter @mp/shared test
pnpm --filter @mp/scheduler test
pnpm typecheck
pnpm lint
```

## Finish

Commit `feat(scheduler): pure metrics calculator for cycle reports`.
