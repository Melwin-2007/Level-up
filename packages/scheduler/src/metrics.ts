import type {
  GoalMetricInput,
  GoalAchievementDetail,
  WeightedAchievementMetric,
  TaskExecutionMetric,
  TaskAccuracyItem,
  EstimateAccuracyMetric,
  WeekConsistencyItem,
  ConsistencyMetric,
  PlanComparisonMetric,
  PlanPerformanceRecord,
  MetricResult,
  CycleReportMetrics,
  TaskExecutionItem,
  TaskLogItem,
  PlanItemSnapshot,
  CycleMetricsInput,
} from './types';

/**
 * Calculates achievement for a single goal using its success criteria (checklist, metric, binary)
 * or fallback to task completion progress if no criteria is provided.
 */
export function calculateGoalAchievement(
  goal: GoalMetricInput,
  tasks: TaskExecutionItem[]
): GoalAchievementDetail {
  const weight = Math.max(1, Math.min(5, goal.priority ?? 1));
  let rawScore = 0;
  let criteriaType: GoalAchievementDetail['criteriaType'] = 'none';
  let calculationDetails = '';

  if (goal.successCriteria) {
    switch (goal.successCriteria.type) {
      case 'checklist': {
        criteriaType = 'checklist';
        const totalItems = goal.successCriteria.items.length;
        const completedItems =
          goal.progress && goal.progress.type === 'checklist' ? goal.progress.completedItems : [];
        // Only count items that are part of the original checklist
        const validCompletedCount = completedItems.filter(
          (item: string) =>
            goal.successCriteria?.type === 'checklist' && goal.successCriteria.items.includes(item)
        ).length;
        rawScore = totalItems > 0 ? Math.min(1.0, validCompletedCount / totalItems) : 0;
        calculationDetails = `${validCompletedCount}/${totalItems} checklist items completed`;
        break;
      }
      case 'metric': {
        criteriaType = 'metric';
        const target = goal.successCriteria.target;
        const current =
          goal.progress && goal.progress.type === 'metric' ? goal.progress.currentValue : 0;
        rawScore = target > 0 ? Math.min(1.0, Math.max(0.0, current / target)) : 0;
        calculationDetails = `${current}/${target} ${goal.successCriteria.unit} achieved`;
        break;
      }
      case 'binary': {
        criteriaType = 'binary';
        const isDone =
          goal.progress && goal.progress.type === 'binary'
            ? goal.progress.completed
            : goal.status === 'completed';
        rawScore = isDone ? 1.0 : 0.0;
        calculationDetails = isDone
          ? 'Binary success criteria fulfilled'
          : 'Binary success criteria not fulfilled';
        break;
      }
    }
  } else {
    // Task-based fallback
    const goalTasks = tasks.filter((t) => t.goalId === goal.goalId);
    if (goalTasks.length > 0) {
      criteriaType = 'tasks_fallback';
      const completedTasks = goalTasks.filter((t) => t.status === 'completed').length;
      rawScore = completedTasks / goalTasks.length;
      calculationDetails = `${completedTasks}/${goalTasks.length} associated tasks completed`;
    } else {
      criteriaType = 'none';
      if (goal.status === 'completed') {
        rawScore = 1.0;
        calculationDetails = 'Goal status marked as completed';
      } else {
        rawScore = 0.0;
        calculationDetails = 'No success criteria or associated tasks defined';
      }
    }
  }

  // Round rawScore to 4 decimal places
  rawScore = Math.round(rawScore * 10000) / 10000;
  const weightedScore = Math.round(weight * rawScore * 10000) / 10000;

  return {
    goalId: goal.goalId,
    title: goal.title,
    weight,
    rawScore,
    weightedScore,
    criteriaType,
    calculationDetails,
  };
}

/**
 * Calculates weighted achievement across all goals according to priority weights.
 */
export function calculateWeightedAchievement(
  goals: GoalMetricInput[],
  tasks: TaskExecutionItem[]
): MetricResult<WeightedAchievementMetric> {
  if (goals.length === 0) {
    return {
      value: {
        score: 0,
        totalWeight: 0,
        totalWeightedScore: 0,
        goals: [],
      },
      displayValue: '0%',
      formula: 'Weighted Achievement = (Sum of (Weight * GoalScore) / TotalWeight) * 100',
      inputs: { totalGoals: 0, totalWeight: 0, totalWeightedScore: 0 },
    };
  }

  const goalDetails = goals.map((goal) => {
    const goalTasks = tasks.filter((t) => t.goalId === goal.goalId);
    return calculateGoalAchievement(goal, goalTasks);
  });

  const totalWeight = goalDetails.reduce((sum, g) => sum + g.weight, 0);
  const totalWeightedScore = goalDetails.reduce((sum, g) => sum + g.weightedScore, 0);

  const scoreRatio = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const scorePercentage = Math.round(scoreRatio * 1000) / 10;

  return {
    value: {
      score: scorePercentage,
      totalWeight,
      totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
      goals: goalDetails,
    },
    displayValue: `${scorePercentage}%`,
    formula: 'Weighted Achievement = (Sum of (Weight * GoalScore) / TotalWeight) * 100',
    inputs: {
      totalGoals: goals.length,
      totalWeight,
      totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
    },
  };
}

/**
 * Computes task execution counts, execution status breakdown, and completion rate.
 */
export function calculateTaskExecutionCounts(
  tasks: TaskExecutionItem[],
  logs: TaskLogItem[] = []
): MetricResult<TaskExecutionMetric> {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const cancelledTasks = tasks.filter((t) => t.status === 'cancelled').length;

  const postponedTaskIds = new Set<string>([
    ...tasks.filter((t) => t.status === 'postponed').map((t) => t.id),
    ...logs.filter((l) => l.action === 'postpone').map((l) => l.taskId),
  ]);
  const postponedTasks = postponedTaskIds.size;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;
  const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
  const totalActualMinutes = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);

  return {
    value: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      postponedTasks,
      cancelledTasks,
      completionRate,
      totalEstimatedMinutes,
      totalActualMinutes,
    },
    displayValue: `${completedTasks}/${totalTasks} tasks (${completionRate}%)`,
    formula: 'Completion Rate = (CompletedTasks / TotalTasks) * 100',
    inputs: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      postponedTasks,
      cancelledTasks,
      totalEstimatedMinutes,
      totalActualMinutes,
    },
  };
}

/**
 * Calculates estimate accuracy comparing actual vs estimated minutes for completed tasks.
 */
export function calculateEstimateAccuracy(
  tasks: TaskExecutionItem[]
): MetricResult<EstimateAccuracyMetric> {
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const taskBreakdown: TaskAccuracyItem[] = completedTasks.map((t) => {
    const estimated = t.estimatedMinutes || 0;
    const actual = t.actualMinutes || 0;
    return {
      taskId: t.id,
      title: t.title,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      varianceMinutes: actual - estimated,
    };
  });

  const totalEstimatedMinutes = taskBreakdown.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const totalActualMinutes = taskBreakdown.reduce((sum, t) => sum + t.actualMinutes, 0);
  const varianceMinutes = totalActualMinutes - totalEstimatedMinutes;

  let accuracyRatio = 100;
  if (totalEstimatedMinutes > 0) {
    const absoluteErrorRatio = Math.abs(varianceMinutes) / totalEstimatedMinutes;
    accuracyRatio = Math.max(0, Math.round((1 - Math.min(1, absoluteErrorRatio)) * 1000) / 10);
  } else if (totalActualMinutes > 0) {
    accuracyRatio = 0;
  }

  const sign = varianceMinutes > 0 ? '+' : '';

  return {
    value: {
      completedTasksCount: completedTasks.length,
      totalEstimatedMinutes,
      totalActualMinutes,
      varianceMinutes,
      accuracyRatio,
      taskBreakdown,
    },
    displayValue: `${accuracyRatio}% accuracy (${sign}${varianceMinutes}m variance)`,
    formula:
      'Accuracy = max(0, 1 - (|TotalActualMinutes - TotalEstimatedMinutes| / TotalEstimatedMinutes)) * 100',
    inputs: {
      completedTasksCount: completedTasks.length,
      totalEstimatedMinutes,
      totalActualMinutes,
      varianceMinutes,
    },
  };
}

function parseDateOnly(dateInput: string | Date): string {
  if (typeof dateInput === 'string') {
    return dateInput.slice(0, 10);
  }
  return dateInput.toISOString().slice(0, 10);
}

function computeDaysBetween(startDateStr: string, endDateStr: string): number {
  const startParts = startDateStr.split('-').map(Number);
  const endParts = endDateStr.split('-').map(Number);
  const startUtc = Date.UTC(startParts[0] ?? 2026, (startParts[1] ?? 1) - 1, startParts[2] ?? 1);
  const endUtc = Date.UTC(endParts[0] ?? 2026, (endParts[1] ?? 1) - 1, endParts[2] ?? 1);
  const diffDays = Math.round((endUtc - startUtc) / 86400000) + 1;
  return Math.max(1, diffDays);
}

/**
 * Calculates consistency: active calendar days and weekly completion rates.
 */
export function calculateConsistency(
  tasks: TaskExecutionItem[],
  logs: TaskLogItem[] = [],
  cycleStartDate: string,
  cycleEndDate: string
): MetricResult<ConsistencyMetric> {
  const totalCycleDays = computeDaysBetween(cycleStartDate, cycleEndDate);

  const activeDaysSet = new Set<string>();

  // Days with completed tasks
  for (const t of tasks) {
    if (t.status === 'completed' && t.completedAt) {
      const day = parseDateOnly(t.completedAt);
      if (day >= cycleStartDate && day <= cycleEndDate) {
        activeDaysSet.add(day);
      }
    }
  }

  // Days with logged execution actions
  for (const l of logs) {
    const day = parseDateOnly(l.loggedAt);
    if (day >= cycleStartDate && day <= cycleEndDate) {
      activeDaysSet.add(day);
    }
  }

  const activeDays = activeDaysSet.size;
  const activeDaysRatio = Math.round((activeDays / totalCycleDays) * 1000) / 10;

  // Weekly breakdown (Weeks 1 to 5)
  const weeksMap: Record<number, { scheduled: number; completed: number }> = {
    1: { scheduled: 0, completed: 0 },
    2: { scheduled: 0, completed: 0 },
    3: { scheduled: 0, completed: 0 },
    4: { scheduled: 0, completed: 0 },
    5: { scheduled: 0, completed: 0 },
  };

  for (const t of tasks) {
    if (t.scheduledDate) {
      const dayOfMonth = Number(t.scheduledDate.slice(8, 10));
      const weekNumber = Math.min(5, Math.max(1, Math.ceil(dayOfMonth / 7)));
      const weekEntry = weeksMap[weekNumber];
      if (weekEntry) {
        weekEntry.scheduled += 1;
        if (t.status === 'completed') {
          weekEntry.completed += 1;
        }
      }
    }
  }

  const weeklyCompletion: WeekConsistencyItem[] = [1, 2, 3, 4, 5].map((w) => {
    const entry = weeksMap[w] ?? { scheduled: 0, completed: 0 };
    const completionRate =
      entry.scheduled > 0 ? Math.round((entry.completed / entry.scheduled) * 1000) / 10 : 0;
    return {
      weekNumber: w as 1 | 2 | 3 | 4 | 5,
      scheduledTasks: entry.scheduled,
      completedTasks: entry.completed,
      completionRate,
    };
  });

  return {
    value: {
      activeDays,
      totalCycleDays,
      activeDaysRatio,
      weeklyCompletion,
    },
    displayValue: `${activeDays}/${totalCycleDays} active days (${activeDaysRatio}%)`,
    formula: 'Active Days Ratio = (ActiveDays / TotalCycleDays) * 100',
    inputs: {
      activeDays,
      totalCycleDays,
      activeDaysRatio,
    },
  };
}

/**
 * Calculates dual plan performance: baseline vs current reoptimized plan adherence.
 */
export function calculatePlanComparison(
  baselineItems: PlanItemSnapshot[] = [],
  currentItems: PlanItemSnapshot[] = [],
  tasks: TaskExecutionItem[] = []
): MetricResult<PlanComparisonMetric> {
  const baselineDailyTasks = baselineItems.filter((i) => i.itemType === 'daily_task');
  const currentDailyTasks = currentItems.filter((i) => i.itemType === 'daily_task');

  const baselineIds = new Set(baselineDailyTasks.map((i) => i.id));
  const currentIds = new Set(currentDailyTasks.map((i) => i.id));

  // Baseline performance
  const baselinePlannedTasks = baselineDailyTasks.length;
  const completedBaselineTasks = tasks.filter(
    (t) => t.status === 'completed' && t.planItemId && baselineIds.has(t.planItemId)
  );
  const baselineCompletedTasks = completedBaselineTasks.length;
  const baselineCompletionRate =
    baselinePlannedTasks > 0
      ? Math.round((baselineCompletedTasks / baselinePlannedTasks) * 1000) / 10
      : 0;
  const baselinePlannedMinutes = baselineDailyTasks.reduce((s, i) => s + i.estimatedMinutes, 0);
  const baselineActualMinutes = completedBaselineTasks.reduce(
    (s, t) => s + (t.actualMinutes || 0),
    0
  );

  const baselineRecord: PlanPerformanceRecord = {
    plannedTasks: baselinePlannedTasks,
    completedTasks: baselineCompletedTasks,
    completionRate: baselineCompletionRate,
    plannedMinutes: baselinePlannedMinutes,
    actualMinutes: baselineActualMinutes,
  };

  // Current plan performance
  const currentPlannedTasks = currentDailyTasks.length;
  const completedCurrentTasks = tasks.filter(
    (t) => t.status === 'completed' && t.planItemId && currentIds.has(t.planItemId)
  );
  const currentCompletedTasks = completedCurrentTasks.length;
  const currentCompletionRate =
    currentPlannedTasks > 0
      ? Math.round((currentCompletedTasks / currentPlannedTasks) * 1000) / 10
      : 0;
  const currentPlannedMinutes = currentDailyTasks.reduce((s, i) => s + i.estimatedMinutes, 0);
  const currentActualMinutes = completedCurrentTasks.reduce(
    (s, t) => s + (t.actualMinutes || 0),
    0
  );

  const currentRecord: PlanPerformanceRecord = {
    plannedTasks: currentPlannedTasks,
    completedTasks: currentCompletedTasks,
    completionRate: currentCompletionRate,
    plannedMinutes: currentPlannedMinutes,
    actualMinutes: currentActualMinutes,
  };

  // Scope variance
  const addedTasks = currentDailyTasks.filter((curr) => !baselineIds.has(curr.id)).length;
  const removedTasks = baselineDailyTasks.filter((base) => !currentIds.has(base.id)).length;

  // Rescheduled tasks: in both plans but plannedDate changed
  const baselineDateMap = new Map(baselineDailyTasks.map((i) => [i.id, i.plannedDate]));
  let rescheduledTasks = 0;
  for (const curr of currentDailyTasks) {
    if (baselineDateMap.has(curr.id)) {
      const baseDate = baselineDateMap.get(curr.id);
      if (baseDate && curr.plannedDate && baseDate !== curr.plannedDate) {
        rescheduledTasks += 1;
      }
    }
  }

  return {
    value: {
      baseline: baselineRecord,
      currentPlan: currentRecord,
      scopeVariance: {
        addedTasks,
        removedTasks,
        rescheduledTasks,
      },
    },
    displayValue: `Baseline: ${baselineCompletionRate}% | Current: ${currentCompletionRate}%`,
    formula: 'Dual Plan Adherence: Baseline completion vs Current reoptimized plan completion',
    inputs: {
      baselinePlannedTasks,
      baselineCompletedTasks,
      currentPlannedTasks,
      currentCompletedTasks,
      addedTasks,
      removedTasks,
      rescheduledTasks,
    },
  };
}

/**
 * Composite function running all 5 metric calculators for a cycle report.
 */
export function calculateCycleMetrics(input: CycleMetricsInput): CycleReportMetrics {
  const weightedAchievement = calculateWeightedAchievement(input.goals, input.tasks);
  const taskExecution = calculateTaskExecutionCounts(input.tasks, input.logs);
  const estimateAccuracy = calculateEstimateAccuracy(input.tasks);
  const consistency = calculateConsistency(
    input.tasks,
    input.logs,
    input.cycleStartDate,
    input.cycleEndDate
  );
  const planComparison = calculatePlanComparison(
    input.baselinePlanItems ?? [],
    input.currentPlanItems ?? [],
    input.tasks
  );

  return {
    weightedAchievement,
    taskExecution,
    estimateAccuracy,
    consistency,
    planComparison,
  };
}
