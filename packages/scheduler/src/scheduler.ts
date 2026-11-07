import type {
  ConstraintViolation,
  FixedSlot,
  ScheduledTask,
  SchedulerInput,
  SchedulerOutput,
  TaskCandidate,
  TimeOfDay,
  TimeSlot,
  TradeoffExplanation,
  UnscheduledReason,
  UnscheduledTask,
} from './types';

interface InternalDayState {
  date: string;
  availableMinutes: number;
  effectiveLimit: number;
  allocatedMinutes: number;
  remainingSlots: TimeSlot[];
  originalSlots: TimeSlot[];
}

const PREFERRED_WINDOWS: Record<TimeOfDay, TimeSlot> = {
  morning: { startMinute: 360, endMinute: 720 }, // 06:00 - 12:00
  afternoon: { startMinute: 720, endMinute: 1020 }, // 12:00 - 17:00
  evening: { startMinute: 1020, endMinute: 1380 }, // 17:00 - 23:00
};

/**
 * Normalizes and merges overlapping or adjacent time slots.
 */
function normalizeSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  const sorted = [...slots]
    .filter((s) => s.endMinute > s.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  if (sorted.length === 0) return [];

  const merged: TimeSlot[] = [sorted[0] as TimeSlot];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i] as TimeSlot;
    const prev = merged[merged.length - 1] as TimeSlot;

    if (current.startMinute <= prev.endMinute) {
      prev.endMinute = Math.max(prev.endMinute, current.endMinute);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Carves out [start, end] from a list of time slots.
 */
function carveInterval(intervals: TimeSlot[], start: number, end: number): TimeSlot[] {
  const result: TimeSlot[] = [];

  for (const interval of intervals) {
    if (end <= interval.startMinute || start >= interval.endMinute) {
      // No overlap
      result.push(interval);
    } else {
      // Overlap: split if remaining segments exist
      if (interval.startMinute < start) {
        result.push({ startMinute: interval.startMinute, endMinute: start });
      }
      if (interval.endMinute > end) {
        result.push({ startMinute: end, endMinute: interval.endMinute });
      }
    }
  }

  return result;
}

/**
 * Finds an available slot of durationMinutes within the day's remaining intervals.
 */
function findAvailableSlot(
  intervals: TimeSlot[],
  durationMinutes: number,
  minStartMinute: number,
  preferredTimeOfDay?: TimeOfDay
): { startMinute: number; endMinute: number } | null {
  interface PlacementOption {
    startMinute: number;
    endMinute: number;
    inPreferredRange: boolean;
  }

  const validOptions: PlacementOption[] = [];
  const prefWindow = preferredTimeOfDay ? PREFERRED_WINDOWS[preferredTimeOfDay] : null;

  for (const interval of intervals) {
    const effectiveStart = Math.max(interval.startMinute, minStartMinute);
    const availableLength = interval.endMinute - effectiveStart;

    if (availableLength >= durationMinutes) {
      // If preferred time of day is requested, check if a preferred window fits inside this interval
      if (prefWindow) {
        const prefStart = Math.max(effectiveStart, prefWindow.startMinute);
        if (prefStart + durationMinutes <= Math.min(interval.endMinute, prefWindow.endMinute)) {
          validOptions.push({
            startMinute: prefStart,
            endMinute: prefStart + durationMinutes,
            inPreferredRange: true,
          });
        }
      }

      validOptions.push({
        startMinute: effectiveStart,
        endMinute: effectiveStart + durationMinutes,
        inPreferredRange: false,
      });
    }
  }

  if (validOptions.length === 0) {
    return null;
  }

  // If there is an option in the preferred range, pick the earliest preferred option
  const preferredOption = validOptions.find((o) => o.inPreferredRange);
  if (preferredOption) {
    return {
      startMinute: preferredOption.startMinute,
      endMinute: preferredOption.endMinute,
    };
  }

  // Otherwise pick the earliest available slot
  validOptions.sort((a, b) => a.startMinute - b.startMinute);
  const earliest = validOptions[0] as PlacementOption;
  return {
    startMinute: earliest.startMinute,
    endMinute: earliest.endMinute,
  };
}

/**
 * Checks if a fixed slot fits entirely inside day's remaining intervals.
 */
function fitsFixedSlot(intervals: TimeSlot[], slot: FixedSlot): boolean {
  for (const interval of intervals) {
    if (interval.startMinute <= slot.startMinute && interval.endMinute >= slot.endMinute) {
      return true;
    }
  }
  return false;
}

/**
 * Validates the generated schedule against all hard constraints.
 */
function validateSchedule(
  scheduled: ScheduledTask[],
  taskMap: Map<string, TaskCandidate>,
  dayStates: Map<string, InternalDayState>,
  maxDailyMinutes?: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const tasksByDate = new Map<string, ScheduledTask[]>();

  for (const task of scheduled) {
    const candidate = taskMap.get(task.taskId);
    if (!candidate) continue;

    // Check duration consistency
    if (task.endMinute !== task.startMinute + task.durationMinutes) {
      violations.push({
        type: 'outside_slot',
        taskId: task.taskId,
        message: `Task ${task.taskId} end minute does not match start minute + duration.`,
      });
    }

    // Check deadline constraint
    if (task.date > candidate.deadline) {
      violations.push({
        type: 'deadline_passed',
        taskId: task.taskId,
        message: `Task ${task.taskId} scheduled on ${task.date} after deadline ${candidate.deadline}.`,
      });
    }

    // Check within original slots
    const dayState = dayStates.get(task.date);
    if (dayState) {
      const insideOriginal = dayState.originalSlots.some(
        (s) => s.startMinute <= task.startMinute && s.endMinute >= task.endMinute
      );
      if (!insideOriginal) {
        violations.push({
          type: 'outside_slot',
          taskId: task.taskId,
          message: `Task ${task.taskId} scheduled outside original availability on ${task.date}.`,
        });
      }
    }

    // Group by date for overlap and capacity check
    const existing = tasksByDate.get(task.date) ?? [];
    existing.push(task);
    tasksByDate.set(task.date, existing);
  }

  // Check overlaps and daily limits per day
  for (const [date, dayTasks] of tasksByDate.entries()) {
    const dayState = dayStates.get(date);
    let totalScheduledMinutes = 0;

    dayTasks.sort((a, b) => a.startMinute - b.startMinute);

    for (let i = 0; i < dayTasks.length; i++) {
      const current = dayTasks[i] as ScheduledTask;
      totalScheduledMinutes += current.durationMinutes;

      if (i > 0) {
        const prev = dayTasks[i - 1] as ScheduledTask;
        if (current.startMinute < prev.endMinute) {
          violations.push({
            type: 'overlap',
            taskId: current.taskId,
            message: `Task ${current.taskId} overlaps with task ${prev.taskId} on ${date}.`,
          });
        }
      }
    }

    const dailyLimit = dayState
      ? Math.min(dayState.availableMinutes, maxDailyMinutes ?? dayState.availableMinutes)
      : 0;

    if (totalScheduledMinutes > dailyLimit) {
      violations.push({
        type: 'capacity_exceeded',
        taskId: dayTasks[0]?.taskId ?? '',
        message: `Total scheduled minutes (${totalScheduledMinutes}m) exceeds daily limit (${dailyLimit}m) on ${date}.`,
      });
    }
  }

  // Check dependency ordering
  const scheduledMap = new Map<string, ScheduledTask>();
  for (const task of scheduled) {
    scheduledMap.set(task.taskId, task);
  }

  for (const task of scheduled) {
    const candidate = taskMap.get(task.taskId);
    if (!candidate || !candidate.dependencies) continue;

    for (const depId of candidate.dependencies) {
      const dep = scheduledMap.get(depId);
      if (dep) {
        const depAfter =
          dep.date > task.date || (dep.date === task.date && dep.endMinute > task.startMinute);
        if (depAfter) {
          violations.push({
            type: 'dependency_order',
            taskId: task.taskId,
            message: `Task ${task.taskId} scheduled before prerequisite task ${depId}.`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Pure deterministic constraint-based task scheduling engine.
 */
export function schedule(input: SchedulerInput): SchedulerOutput {
  const taskMap = new Map<string, TaskCandidate>();
  for (const task of input.tasks) {
    taskMap.set(task.id, task);
  }

  // Prepare and normalize day states
  const sortedAvailability = [...input.availability].sort((a, b) => a.date.localeCompare(b.date));
  const dayStates = new Map<string, InternalDayState>();

  for (const day of sortedAvailability) {
    const normalized = normalizeSlots(day.slots);
    const slotsTotal = normalized.reduce((acc, s) => acc + (s.endMinute - s.startMinute), 0);
    const effectiveLimit = Math.min(
      day.availableMinutes,
      slotsTotal,
      input.maxDailyMinutes ?? day.availableMinutes
    );

    dayStates.set(day.date, {
      date: day.date,
      availableMinutes: day.availableMinutes,
      effectiveLimit,
      allocatedMinutes: 0,
      remainingSlots: normalized.map((s) => ({ ...s })),
      originalSlots: normalized,
    });
  }

  const scheduled: ScheduledTask[] = [];
  const unscheduled: UnscheduledTask[] = [];
  const scheduledMap = new Map<string, ScheduledTask>();
  const unscheduledMap = new Map<string, UnscheduledTask>();

  const markUnscheduled = (
    task: TaskCandidate,
    reason: UnscheduledReason,
    details: string
  ): void => {
    const item: UnscheduledTask = {
      taskId: task.id,
      goalId: task.goalId,
      reason,
      details,
    };
    unscheduled.push(item);
    unscheduledMap.set(task.id, item);
  };

  // Detect cyclic or missing dependencies
  const visited = new Map<string, 'visiting' | 'visited'>();
  const cyclicIds = new Set<string>();

  function checkCycles(taskId: string): boolean {
    visited.set(taskId, 'visiting');
    const task = taskMap.get(taskId);
    if (task && task.dependencies) {
      for (const depId of task.dependencies) {
        if (!taskMap.has(depId)) {
          continue; // Missing dependency handled below
        }
        const state = visited.get(depId);
        if (state === 'visiting') {
          cyclicIds.add(taskId);
          cyclicIds.add(depId);
          return true;
        }
        if (!state && checkCycles(depId)) {
          cyclicIds.add(taskId);
          return true;
        }
      }
    }
    visited.set(taskId, 'visited');
    return false;
  }

  for (const task of input.tasks) {
    if (!visited.has(task.id)) {
      checkCycles(task.id);
    }
  }

  const pendingTasks: TaskCandidate[] = [];

  for (const task of input.tasks) {
    if (task.estimatedMinutes <= 0) {
      markUnscheduled(task, 'conflict', 'Task estimated minutes must be greater than 0.');
      continue;
    }

    if (cyclicIds.has(task.id)) {
      markUnscheduled(task, 'unmet_dependency', 'Cyclic dependency detected.');
      continue;
    }

    const missingDep = task.dependencies?.find((d) => !taskMap.has(d));
    if (missingDep) {
      markUnscheduled(
        task,
        'unmet_dependency',
        `Prerequisite task "${missingDep}" does not exist.`
      );
      continue;
    }

    pendingTasks.push(task);
  }

  // Iterative topological EDF scheduling loop
  while (pendingTasks.length > 0) {
    // Identify ready tasks (all dependencies resolved)
    const readyIndices: number[] = [];

    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i] as TaskCandidate;
      const deps = task.dependencies ?? [];
      const allDepsResolved = deps.every(
        (depId) => scheduledMap.has(depId) || unscheduledMap.has(depId)
      );
      if (allDepsResolved) {
        readyIndices.push(i);
      }
    }

    if (readyIndices.length === 0) {
      // Any remaining tasks cannot resolve dependencies
      for (const task of pendingTasks) {
        markUnscheduled(
          task,
          'unmet_dependency',
          'Unresolvable dependency prevents task from being scheduled.'
        );
      }
      break;
    }

    // Check for tasks whose dependencies failed
    const toSchedule: TaskCandidate[] = [];

    for (const index of readyIndices) {
      const task = pendingTasks[index] as TaskCandidate;
      const deps = task.dependencies ?? [];
      const failedDepId = deps.find((d) => unscheduledMap.has(d));

      if (failedDepId) {
        const failedDep = taskMap.get(failedDepId);
        markUnscheduled(
          task,
          'unmet_dependency',
          `Prerequisite task "${failedDep?.title ?? failedDepId}" could not be scheduled.`
        );
      } else {
        toSchedule.push(task);
      }
    }

    // Remove the processed ready tasks from pending
    const readySet = new Set(readyIndices.map((i) => pendingTasks[i]?.id));
    for (let i = pendingTasks.length - 1; i >= 0; i--) {
      if (readySet.has(pendingTasks[i]?.id)) {
        pendingTasks.splice(i, 1);
      }
    }

    if (toSchedule.length === 0) {
      continue;
    }

    // Sort ready candidates by:
    // 1. Deadline ASC
    // 2. Priority DESC (5 is highest)
    // 3. Estimated minutes DESC
    // 4. ID ASC (deterministic tie-breaker)
    toSchedule.sort((a, b) => {
      const deadlineCmp = a.deadline.localeCompare(b.deadline);
      if (deadlineCmp !== 0) return deadlineCmp;

      const priorityCmp = b.priority - a.priority;
      if (priorityCmp !== 0) return priorityCmp;

      const durationCmp = b.estimatedMinutes - a.estimatedMinutes;
      if (durationCmp !== 0) return durationCmp;

      return a.id.localeCompare(b.id);
    });

    // Schedule the ready tasks in order
    for (const task of toSchedule) {
      // Determine earliest allowed date based on prerequisites
      let earliestDate = '';
      let minStartMinuteOnDate = 0;

      for (const depId of task.dependencies ?? []) {
        const dep = scheduledMap.get(depId);
        if (dep) {
          if (!earliestDate || dep.date > earliestDate) {
            earliestDate = dep.date;
            minStartMinuteOnDate = dep.endMinute;
          } else if (dep.date === earliestDate) {
            minStartMinuteOnDate = Math.max(minStartMinuteOnDate, dep.endMinute);
          }
        }
      }

      // Handle fixed slot task
      if (task.fixedSlot) {
        const slot = task.fixedSlot;
        const targetDay = dayStates.get(slot.date);

        if (!targetDay) {
          markUnscheduled(
            task,
            'conflict',
            `Fixed slot date ${slot.date} is not in available schedule.`
          );
          continue;
        }

        if (slot.date > task.deadline) {
          markUnscheduled(
            task,
            'deadline_unreachable',
            `Fixed slot date ${slot.date} is after deadline ${task.deadline}.`
          );
          continue;
        }

        if (
          earliestDate &&
          (slot.date < earliestDate ||
            (slot.date === earliestDate && slot.startMinute < minStartMinuteOnDate))
        ) {
          markUnscheduled(
            task,
            'conflict',
            `Fixed slot on ${slot.date} at minute ${slot.startMinute} violates dependency completion order.`
          );
          continue;
        }

        if (slot.endMinute - slot.startMinute < task.estimatedMinutes) {
          markUnscheduled(
            task,
            'conflict',
            `Fixed slot duration (${slot.endMinute - slot.startMinute}m) is less than task duration (${task.estimatedMinutes}m).`
          );
          continue;
        }

        if (targetDay.allocatedMinutes + task.estimatedMinutes > targetDay.effectiveLimit) {
          markUnscheduled(
            task,
            'daily_limit_exceeded',
            `Fixed slot on ${slot.date} exceeds daily capacity limit.`
          );
          continue;
        }

        if (!fitsFixedSlot(targetDay.remainingSlots, slot)) {
          markUnscheduled(
            task,
            'conflict',
            `Fixed slot ${slot.startMinute}-${slot.endMinute} on ${slot.date} conflicts with already scheduled tasks or unavailable hours.`
          );
          continue;
        }

        // Schedule into fixed slot
        targetDay.remainingSlots = carveInterval(
          targetDay.remainingSlots,
          slot.startMinute,
          slot.startMinute + task.estimatedMinutes
        );
        targetDay.allocatedMinutes += task.estimatedMinutes;

        const scheduledItem: ScheduledTask = {
          taskId: task.id,
          goalId: task.goalId,
          date: slot.date,
          startMinute: slot.startMinute,
          endMinute: slot.startMinute + task.estimatedMinutes,
          durationMinutes: task.estimatedMinutes,
        };

        scheduled.push(scheduledItem);
        scheduledMap.set(task.id, scheduledItem);
        continue;
      }

      // Flexible slot task: search candidate days
      const candidateDays: InternalDayState[] = [];
      for (const day of sortedAvailability) {
        if (earliestDate && day.date < earliestDate) continue;
        if (day.date > task.deadline) break;

        const state = dayStates.get(day.date);
        if (state) {
          candidateDays.push(state);
        }
      }

      if (candidateDays.length === 0) {
        markUnscheduled(
          task,
          'deadline_unreachable',
          `No available days exist before deadline ${task.deadline} (earliest allowed: ${earliestDate || 'none'}).`
        );
        continue;
      }

      let placed = false;
      let capacityExceededCount = 0;

      for (const day of candidateDays) {
        if (day.allocatedMinutes + task.estimatedMinutes > day.effectiveLimit) {
          capacityExceededCount++;
          continue;
        }

        const minStart = day.date === earliestDate ? minStartMinuteOnDate : 0;
        const slot = findAvailableSlot(
          day.remainingSlots,
          task.estimatedMinutes,
          minStart,
          task.preferredTimeOfDay
        );

        if (slot) {
          day.remainingSlots = carveInterval(day.remainingSlots, slot.startMinute, slot.endMinute);
          day.allocatedMinutes += task.estimatedMinutes;

          const scheduledItem: ScheduledTask = {
            taskId: task.id,
            goalId: task.goalId,
            date: day.date,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
            durationMinutes: task.estimatedMinutes,
          };

          scheduled.push(scheduledItem);
          scheduledMap.set(task.id, scheduledItem);
          placed = true;
          break;
        }
      }

      if (!placed) {
        const reason: UnscheduledReason =
          capacityExceededCount === candidateDays.length
            ? 'daily_limit_exceeded'
            : 'insufficient_capacity';

        markUnscheduled(
          task,
          reason,
          `Unable to fit ${task.estimatedMinutes}m before deadline ${task.deadline}. Total remaining capacity across candidate days was insufficient.`
        );
      }
    }
  }

  // Defensive validation of hard constraints
  const violations = validateSchedule(scheduled, taskMap, dayStates, input.maxDailyMinutes);

  // Generate human-readable tradeoffs
  const tradeoffs: TradeoffExplanation[] = unscheduled.map((u) => {
    const task = taskMap.get(u.taskId);
    const title = task?.title ?? u.taskId;
    const priority = task?.priority ?? 1;
    const duration = task?.estimatedMinutes ?? 0;

    return {
      taskId: u.taskId,
      goalId: u.goalId,
      explanation: `Task "${title}" (Priority ${priority}, ${duration}m) could not be scheduled: ${u.details}`,
    };
  });

  return {
    scheduled,
    unscheduled,
    violations,
    tradeoffs,
  };
}
