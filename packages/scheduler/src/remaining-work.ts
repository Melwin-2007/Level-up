import type {
  GoalWorkSummary,
  RemainingWorkInput,
  RemainingWorkOutput,
  SlippedTask,
  TaskCandidate,
  TaskExecutionItem,
} from './types';

function parseDateUtc(dateStr: string): number {
  const parts = dateStr.split('-');
  const year = Number(parts[0] ?? '0');
  const month = Number(parts[1] ?? '1');
  const day = Number(parts[2] ?? '1');
  return Date.UTC(year, month - 1, day);
}

function daysBetween(fromStr: string, toStr: string): number {
  const msPerDay = 86_400_000;
  return Math.round((parseDateUtc(toStr) - parseDateUtc(fromStr)) / msPerDay);
}

function isTaskCompleted(task: TaskExecutionItem): boolean {
  return task.status === 'completed' || task.completedAt != null;
}

function isTaskCancelled(task: TaskExecutionItem): boolean {
  return task.status === 'cancelled';
}

/**
 * Pure function: calculates remaining work, slipped tasks, remaining capacity,
 * and feasibility balance as of evaluation date `today`.
 *
 * Adheres strictly to the three-record principle: never modifies completed work
 * or mutates input structures.
 */
export function calculateRemainingWork(input: RemainingWorkInput): RemainingWorkOutput {
  const { today, cycleStartDate, cycleEndDate, availability, currentTasks, maxDailyMinutes } =
    input;

  const completedTasks: TaskExecutionItem[] = [];
  const slippedTasks: SlippedTask[] = [];
  const futurePendingTasks: TaskExecutionItem[] = [];
  const rescheduleCandidates: TaskCandidate[] = [];

  let completedMinutes = 0;
  let slippedMinutes = 0;
  let futurePendingMinutes = 0;

  // Track summaries per goal
  const goalMap = new Map<string, GoalWorkSummary>();

  const getOrCreateGoalSummary = (goalId: string): GoalWorkSummary => {
    let summary = goalMap.get(goalId);
    if (!summary) {
      summary = {
        goalId,
        totalTasks: 0,
        completedTasks: 0,
        slippedTasks: 0,
        futurePendingTasks: 0,
        completedMinutes: 0,
        remainingMinutes: 0,
      };
      goalMap.set(goalId, summary);
    }
    return summary;
  };

  for (const task of currentTasks) {
    const goalId = task.goalId ?? 'unassigned';
    const goalSummary = getOrCreateGoalSummary(goalId);
    goalSummary.totalTasks += 1;

    if (isTaskCompleted(task)) {
      completedTasks.push(task);
      const minutes =
        task.actualMinutes && task.actualMinutes > 0 ? task.actualMinutes : task.estimatedMinutes;
      completedMinutes += minutes;
      goalSummary.completedTasks += 1;
      goalSummary.completedMinutes += minutes;
      continue;
    }

    if (isTaskCancelled(task)) {
      // Cancelled tasks do not require rescheduling and do not count toward remaining workload
      continue;
    }

    // Task is uncompleted (pending, in_progress, paused, postponed)
    const isSlipped = Boolean(task.scheduledDate && task.scheduledDate < today);

    if (isSlipped && task.scheduledDate) {
      const overdue = Math.max(1, daysBetween(task.scheduledDate, today));
      const slipped: SlippedTask = {
        task,
        daysOverdue: overdue,
        originalScheduledDate: task.scheduledDate,
      };
      slippedTasks.push(slipped);
      slippedMinutes += task.estimatedMinutes;

      goalSummary.slippedTasks += 1;
      goalSummary.remainingMinutes += task.estimatedMinutes;

      // Reschedule candidate with elevated priority for slipped work
      const candidatePriority = Math.min(5, (task.priority ?? 3) + 1);
      const candidateDeadline =
        task.deadline && task.deadline <= cycleEndDate ? task.deadline : cycleEndDate;

      rescheduleCandidates.push({
        id: task.id,
        goalId,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        priority: candidatePriority,
        deadline: candidateDeadline,
        dependencies: task.dependencies ? [...task.dependencies] : [],
      });
    } else {
      // Future or scheduled for today
      futurePendingTasks.push(task);
      futurePendingMinutes += task.estimatedMinutes;

      goalSummary.futurePendingTasks += 1;
      goalSummary.remainingMinutes += task.estimatedMinutes;

      const candidatePriority = task.priority ?? 3;
      const candidateDeadline =
        task.deadline && task.deadline <= cycleEndDate ? task.deadline : cycleEndDate;

      rescheduleCandidates.push({
        id: task.id,
        goalId,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        priority: candidatePriority,
        deadline: candidateDeadline,
        dependencies: task.dependencies ? [...task.dependencies] : [],
      });
    }
  }

  // Calculate remaining available capacity from today through cycleEndDate
  let remainingCapacityMinutes = 0;
  for (const day of availability) {
    if (day.date >= today && day.date <= cycleEndDate) {
      const cap =
        maxDailyMinutes != null
          ? Math.min(day.availableMinutes, maxDailyMinutes)
          : day.availableMinutes;
      remainingCapacityMinutes += cap;
    }
  }

  const totalRemainingMinutes = slippedMinutes + futurePendingMinutes;
  const capacityDeficitMinutes = Math.max(0, totalRemainingMinutes - remainingCapacityMinutes);
  const isFeasible = totalRemainingMinutes <= remainingCapacityMinutes;

  const goalSummaries = Array.from(goalMap.values());

  return {
    today,
    cycleStartDate,
    cycleEndDate,
    completedTasks,
    completedMinutes,
    slippedTasks,
    slippedMinutes,
    futurePendingTasks,
    futurePendingMinutes,
    totalRemainingMinutes,
    remainingCapacityMinutes,
    capacityDeficitMinutes,
    isFeasible,
    rescheduleCandidates,
    goalSummaries,
  };
}
