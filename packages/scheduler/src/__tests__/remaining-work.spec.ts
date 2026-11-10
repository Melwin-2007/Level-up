import { describe, expect, it } from 'vitest';
import { calculateRemainingWork } from '../remaining-work';
import type { DayAvailability, RemainingWorkInput, TaskExecutionItem } from '../types';

describe('Remaining Work Calculator (P50)', () => {
  const sampleAvailability: DayAvailability[] = [
    { date: '2026-11-08', availableMinutes: 240, slots: [{ startMinute: 540, endMinute: 780 }] },
    { date: '2026-11-09', availableMinutes: 240, slots: [{ startMinute: 540, endMinute: 780 }] },
    { date: '2026-11-10', availableMinutes: 240, slots: [{ startMinute: 540, endMinute: 780 }] }, // today
    { date: '2026-11-11', availableMinutes: 180, slots: [{ startMinute: 540, endMinute: 720 }] },
    { date: '2026-11-12', availableMinutes: 180, slots: [{ startMinute: 540, endMinute: 720 }] },
    { date: '2026-11-13', availableMinutes: 120, slots: [{ startMinute: 540, endMinute: 660 }] },
  ];

  const sampleTasks: TaskExecutionItem[] = [
    {
      id: 'task-1',
      goalId: 'goal-a',
      title: 'Past Completed Task',
      status: 'completed',
      scheduledDate: '2026-11-08',
      estimatedMinutes: 60,
      actualMinutes: 75,
      completedAt: '2026-11-08T16:00:00Z',
      priority: 3,
    },
    {
      id: 'task-2',
      goalId: 'goal-a',
      title: 'Past Slipped Task',
      status: 'pending',
      scheduledDate: '2026-11-08',
      estimatedMinutes: 90,
      priority: 3,
      deadline: '2026-11-13',
    },
    {
      id: 'task-3',
      goalId: 'goal-b',
      title: 'Yesterday Slipped Task (Paused)',
      status: 'paused',
      scheduledDate: '2026-11-09',
      estimatedMinutes: 45,
      priority: 2,
      deadline: '2026-11-12',
    },
    {
      id: 'task-4',
      goalId: 'goal-b',
      title: 'Today Pending Task',
      status: 'pending',
      scheduledDate: '2026-11-10',
      estimatedMinutes: 60,
      priority: 4,
      deadline: '2026-11-13',
    },
    {
      id: 'task-5',
      goalId: 'goal-b',
      title: 'Future Pending Task',
      status: 'pending',
      scheduledDate: '2026-11-12',
      estimatedMinutes: 120,
      priority: 3,
      deadline: '2026-11-13',
    },
    {
      id: 'task-6',
      goalId: 'goal-a',
      title: 'Cancelled Task',
      status: 'cancelled',
      scheduledDate: '2026-11-09',
      estimatedMinutes: 60,
      priority: 1,
    },
  ];

  it('separates completed work and preserves actual completed minutes without modification', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.completedTasks).toHaveLength(1);
    expect(result.completedTasks[0]?.id).toBe('task-1');
    expect(result.completedMinutes).toBe(75); // uses actualMinutes over estimatedMinutes
  });

  it('accurately identifies slipped tasks and computes days overdue', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.slippedTasks).toHaveLength(2);

    const task2Slip = result.slippedTasks.find((s) => s.task.id === 'task-2');
    expect(task2Slip).toBeDefined();
    expect(task2Slip?.daysOverdue).toBe(2); // Nov 8 to Nov 10
    expect(task2Slip?.originalScheduledDate).toBe('2026-11-08');

    const task3Slip = result.slippedTasks.find((s) => s.task.id === 'task-3');
    expect(task3Slip).toBeDefined();
    expect(task3Slip?.daysOverdue).toBe(1); // Nov 9 to Nov 10

    expect(result.slippedMinutes).toBe(90 + 45); // 135 minutes
  });

  it('identifies future and today pending tasks', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.futurePendingTasks).toHaveLength(2);
    expect(result.futurePendingTasks.map((t) => t.id)).toEqual(['task-4', 'task-5']);
    expect(result.futurePendingMinutes).toBe(60 + 120); // 180 minutes
    expect(result.totalRemainingMinutes).toBe(135 + 180); // 315 minutes
  });

  it('omits cancelled tasks from remaining work and reschedule candidates', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    const candidateIds = result.rescheduleCandidates.map((c) => c.id);
    expect(candidateIds).not.toContain('task-6');
    expect(result.slippedTasks.map((s) => s.task.id)).not.toContain('task-6');
    expect(result.futurePendingTasks.map((t) => t.id)).not.toContain('task-6');
    expect(result.completedTasks.map((t) => t.id)).not.toContain('task-6');
  });

  it('generates reschedule candidates with elevated priority for slipped tasks', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    // 2 slipped + 2 future pending = 4 candidates
    expect(result.rescheduleCandidates).toHaveLength(4);

    const cand2 = result.rescheduleCandidates.find((c) => c.id === 'task-2');
    expect(cand2?.priority).toBe(4); // original priority 3 + 1 boost

    const cand3 = result.rescheduleCandidates.find((c) => c.id === 'task-3');
    expect(cand3?.priority).toBe(3); // original priority 2 + 1 boost

    const cand4 = result.rescheduleCandidates.find((c) => c.id === 'task-4');
    expect(cand4?.priority).toBe(4); // preserved priority 4 for today task
  });

  it('computes remaining capacity from today through cycle end date', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-13',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    // Availability for Nov 10 (240), Nov 11 (180), Nov 12 (180), Nov 13 (120) = 720 mins
    // Nov 8 (240) and Nov 9 (240) are past and excluded
    expect(result.remainingCapacityMinutes).toBe(720);
    expect(result.totalRemainingMinutes).toBe(315);
    expect(result.capacityDeficitMinutes).toBe(0);
    expect(result.isFeasible).toBe(true);
  });

  it('detects capacity deficit and infeasibility when remaining work exceeds capacity', () => {
    const constrainedAvailability: DayAvailability[] = [
      { date: '2026-11-10', availableMinutes: 60, slots: [] },
      { date: '2026-11-11', availableMinutes: 60, slots: [] },
    ];

    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-11',
      availability: constrainedAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.remainingCapacityMinutes).toBe(120);
    expect(result.totalRemainingMinutes).toBe(315);
    expect(result.capacityDeficitMinutes).toBe(195); // 315 - 120
    expect(result.isFeasible).toBe(false);
  });

  it('correctly aggregates goal work summaries', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    const goalASummary = result.goalSummaries.find((g) => g.goalId === 'goal-a');
    expect(goalASummary).toBeDefined();
    expect(goalASummary?.totalTasks).toBe(3); // task-1 (completed), task-2 (slipped), task-6 (cancelled)
    expect(goalASummary?.completedTasks).toBe(1);
    expect(goalASummary?.slippedTasks).toBe(1);
    expect(goalASummary?.completedMinutes).toBe(75);
    expect(goalASummary?.remainingMinutes).toBe(90);

    const goalBSummary = result.goalSummaries.find((g) => g.goalId === 'goal-b');
    expect(goalBSummary).toBeDefined();
    expect(goalBSummary?.totalTasks).toBe(3); // task-3 (slipped), task-4 (pending), task-5 (future)
    expect(goalBSummary?.completedTasks).toBe(0);
    expect(goalBSummary?.slippedTasks).toBe(1);
    expect(goalBSummary?.futurePendingTasks).toBe(2);
    expect(goalBSummary?.remainingMinutes).toBe(45 + 60 + 120);
  });

  it('handles edge case: today is cycle start date (0 slipped, all pending)', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-08',
      cycleStartDate: '2026-11-08',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.slippedTasks).toHaveLength(0);
    expect(result.slippedMinutes).toBe(0);
    // Tasks 2, 3, 4, 5 are all scheduled >= 2026-11-08
    expect(result.futurePendingTasks).toHaveLength(4);
  });

  it('handles edge case: all tasks completed', () => {
    const allCompletedTasks: TaskExecutionItem[] = [
      {
        id: 'task-1',
        title: 'Task 1',
        status: 'completed',
        scheduledDate: '2026-11-08',
        estimatedMinutes: 60,
      },
      {
        id: 'task-2',
        title: 'Task 2',
        status: 'completed',
        scheduledDate: '2026-11-09',
        estimatedMinutes: 90,
      },
    ];

    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: allCompletedTasks,
    };

    const result = calculateRemainingWork(input);

    expect(result.completedTasks).toHaveLength(2);
    expect(result.slippedTasks).toHaveLength(0);
    expect(result.futurePendingTasks).toHaveLength(0);
    expect(result.totalRemainingMinutes).toBe(0);
    expect(result.capacityDeficitMinutes).toBe(0);
    expect(result.isFeasible).toBe(true);
    expect(result.rescheduleCandidates).toHaveLength(0);
  });

  it('handles edge case: empty task list', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: [],
    };

    const result = calculateRemainingWork(input);

    expect(result.completedTasks).toHaveLength(0);
    expect(result.slippedTasks).toHaveLength(0);
    expect(result.futurePendingTasks).toHaveLength(0);
    expect(result.totalRemainingMinutes).toBe(0);
    expect(result.isFeasible).toBe(true);
  });

  it('respects maxDailyMinutes capacity clamp on remaining availability', () => {
    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-13',
      availability: sampleAvailability, // 240, 180, 180, 120
      currentTasks: sampleTasks,
      maxDailyMinutes: 120, // clamp each day to max 120 mins
    };

    const result = calculateRemainingWork(input);

    // 4 days * 120 mins = 480 mins
    expect(result.remainingCapacityMinutes).toBe(480);
  });

  it('maintains strict immutability of input tasks', () => {
    const originalSnapshot = JSON.stringify(sampleTasks);
    Object.freeze(sampleTasks);

    const input: RemainingWorkInput = {
      today: '2026-11-10',
      cycleStartDate: '2026-11-01',
      cycleEndDate: '2026-11-30',
      availability: sampleAvailability,
      currentTasks: sampleTasks,
    };

    const result = calculateRemainingWork(input);

    expect(JSON.stringify(sampleTasks)).toBe(originalSnapshot);
    expect(result.rescheduleCandidates).not.toBe(sampleTasks);
  });
});
