import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { schedule } from '../scheduler';
import type { DayAvailability, SchedulerInput, TaskCandidate } from '../types';

describe('Pure Scheduler Engine (P30)', () => {
  const standardDay: DayAvailability = {
    date: '2026-11-02',
    availableMinutes: 480,
    slots: [{ startMinute: 540, endMinute: 1020 }], // 09:00 - 17:00 (480 mins)
  };

  it('handles empty input gracefully', () => {
    const result = schedule({
      tasks: [],
      availability: [],
    });

    expect(result.scheduled).toEqual([]);
    expect(result.unscheduled).toEqual([]);
    expect(result.violations).toEqual([]);
    expect(result.tradeoffs).toEqual([]);
  });

  it('schedules a single task into available day slot', () => {
    const task: TaskCandidate = {
      id: 'task-1',
      goalId: 'goal-1',
      title: 'Setup repository',
      estimatedMinutes: 120,
      priority: 5,
      deadline: '2026-11-05',
    };

    const result = schedule({
      tasks: [task],
      availability: [standardDay],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(0);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]).toEqual({
      taskId: 'task-1',
      goalId: 'goal-1',
      date: '2026-11-02',
      startMinute: 540,
      endMinute: 660,
      durationMinutes: 120,
    });
  });

  it('schedules multiple tasks sequentially without overlapping on the same day', () => {
    const tasks: TaskCandidate[] = [
      {
        id: 'task-1',
        goalId: 'goal-1',
        title: 'Task 1',
        estimatedMinutes: 60,
        priority: 4,
        deadline: '2026-11-05',
      },
      {
        id: 'task-2',
        goalId: 'goal-1',
        title: 'Task 2',
        estimatedMinutes: 90,
        priority: 3,
        deadline: '2026-11-05',
      },
    ];

    const result = schedule({
      tasks,
      availability: [standardDay],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(0);
    expect(result.scheduled).toHaveLength(2);

    const first = result.scheduled.find((t) => t.taskId === 'task-1')!;
    const second = result.scheduled.find((t) => t.taskId === 'task-2')!;

    expect(first.date).toBe('2026-11-02');
    expect(first.startMinute).toBe(540);
    expect(first.endMinute).toBe(600);

    expect(second.date).toBe('2026-11-02');
    expect(second.startMinute).toBe(600);
    expect(second.endMinute).toBe(690);
  });

  it('respects task dependency ordering across and within days', () => {
    const tasks: TaskCandidate[] = [
      {
        id: 'task-child',
        goalId: 'goal-1',
        title: 'Run Integration Tests',
        estimatedMinutes: 60,
        priority: 5,
        deadline: '2026-11-05',
        dependencies: ['task-parent'],
      },
      {
        id: 'task-parent',
        goalId: 'goal-1',
        title: 'Build API Scaffold',
        estimatedMinutes: 120,
        priority: 2, // lower priority than child, but must execute first
        deadline: '2026-11-05',
      },
    ];

    const result = schedule({
      tasks,
      availability: [standardDay],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(0);

    const parent = result.scheduled.find((t) => t.taskId === 'task-parent')!;
    const child = result.scheduled.find((t) => t.taskId === 'task-child')!;

    expect(parent.endMinute).toBeLessThanOrEqual(child.startMinute);
  });

  it('detects cyclic dependencies and marks tasks as unscheduled', () => {
    const tasks: TaskCandidate[] = [
      {
        id: 'task-a',
        goalId: 'goal-1',
        title: 'Task A',
        estimatedMinutes: 60,
        priority: 3,
        deadline: '2026-11-05',
        dependencies: ['task-b'],
      },
      {
        id: 'task-b',
        goalId: 'goal-1',
        title: 'Task B',
        estimatedMinutes: 60,
        priority: 3,
        deadline: '2026-11-05',
        dependencies: ['task-a'],
      },
    ];

    const result = schedule({
      tasks,
      availability: [standardDay],
    });

    expect(result.scheduled).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(2);
    expect(result.unscheduled.every((u) => u.reason === 'unmet_dependency')).toBe(true);
    expect(result.tradeoffs).toHaveLength(2);
  });

  it('flags missing dependencies as unscheduled', () => {
    const tasks: TaskCandidate[] = [
      {
        id: 'task-1',
        goalId: 'goal-1',
        title: 'Deploy to Prod',
        estimatedMinutes: 60,
        priority: 5,
        deadline: '2026-11-05',
        dependencies: ['ghost-task'],
      },
    ];

    const result = schedule({
      tasks,
      availability: [standardDay],
    });

    expect(result.scheduled).toHaveLength(0);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0]?.reason).toBe('unmet_dependency');
    expect(result.unscheduled[0]?.details).toContain(
      'Prerequisite task "ghost-task" does not exist.'
    );
  });

  it('prioritizes higher priority task when daily capacity is constrained', () => {
    const limitedDay: DayAvailability = {
      date: '2026-11-02',
      availableMinutes: 120,
      slots: [{ startMinute: 540, endMinute: 660 }], // 2 hours only
    };

    const tasks: TaskCandidate[] = [
      {
        id: 'task-low',
        goalId: 'goal-1',
        title: 'Optional Refactoring',
        estimatedMinutes: 90,
        priority: 1,
        deadline: '2026-11-02',
      },
      {
        id: 'task-high',
        goalId: 'goal-1',
        title: 'Critical Bugfix',
        estimatedMinutes: 90,
        priority: 5,
        deadline: '2026-11-02',
      },
    ];

    const result = schedule({
      tasks,
      availability: [limitedDay],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]?.taskId).toBe('task-high');

    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0]?.taskId).toBe('task-low');
    expect(result.tradeoffs[0]?.explanation).toContain('Optional Refactoring');
  });

  it('schedules task in fixedSlot when available and rejects on collision', () => {
    const fixedTask: TaskCandidate = {
      id: 'task-meeting',
      goalId: 'goal-1',
      title: 'Sprint Planning Meeting',
      estimatedMinutes: 60,
      priority: 5,
      deadline: '2026-11-02',
      fixedSlot: {
        date: '2026-11-02',
        startMinute: 600, // 10:00
        endMinute: 660, // 11:00
      },
    };

    const collidingFixedTask: TaskCandidate = {
      id: 'task-overlap',
      goalId: 'goal-1',
      title: 'Conflicting Call',
      estimatedMinutes: 60,
      priority: 4,
      deadline: '2026-11-02',
      fixedSlot: {
        date: '2026-11-02',
        startMinute: 600,
        endMinute: 660,
      },
    };

    const result = schedule({
      tasks: [fixedTask, collidingFixedTask],
      availability: [standardDay],
    });

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]?.taskId).toBe('task-meeting');

    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0]?.taskId).toBe('task-overlap');
    expect(result.unscheduled[0]?.reason).toBe('conflict');
  });

  it('respects preferred time of day when slot is available', () => {
    const morningTask: TaskCandidate = {
      id: 'task-morning',
      goalId: 'goal-1',
      title: 'Morning Deep Work',
      estimatedMinutes: 60,
      priority: 3,
      deadline: '2026-11-02',
      preferredTimeOfDay: 'morning',
    };

    const afternoonTask: TaskCandidate = {
      id: 'task-afternoon',
      goalId: 'goal-1',
      title: 'Afternoon Reviews',
      estimatedMinutes: 60,
      priority: 3,
      deadline: '2026-11-02',
      preferredTimeOfDay: 'afternoon',
    };

    const result = schedule({
      tasks: [morningTask, afternoonTask],
      availability: [
        {
          date: '2026-11-02',
          availableMinutes: 600,
          slots: [{ startMinute: 480, endMinute: 1080 }], // 08:00 - 18:00
        },
      ],
    });

    expect(result.scheduled).toHaveLength(2);
    const m = result.scheduled.find((s) => s.taskId === 'task-morning')!;
    const a = result.scheduled.find((s) => s.taskId === 'task-afternoon')!;

    // Morning is 360 - 720 (06:00 - 12:00)
    expect(m.startMinute).toBeGreaterThanOrEqual(480);
    expect(m.endMinute).toBeLessThanOrEqual(720);

    // Afternoon is 720 - 1020 (12:00 - 17:00)
    expect(a.startMinute).toBeGreaterThanOrEqual(720);
    expect(a.endMinute).toBeLessThanOrEqual(1020);
  });

  it('respects maxDailyMinutes global limit across days', () => {
    const tasks: TaskCandidate[] = [
      {
        id: 'task-1',
        goalId: 'goal-1',
        title: 'Task 1',
        estimatedMinutes: 120,
        priority: 4,
        deadline: '2026-11-05',
      },
      {
        id: 'task-2',
        goalId: 'goal-1',
        title: 'Task 2',
        estimatedMinutes: 120,
        priority: 3,
        deadline: '2026-11-05',
      },
    ];

    const result = schedule({
      tasks,
      availability: [
        {
          date: '2026-11-02',
          availableMinutes: 480,
          slots: [{ startMinute: 540, endMinute: 1020 }],
        },
        {
          date: '2026-11-03',
          availableMinutes: 480,
          slots: [{ startMinute: 540, endMinute: 1020 }],
        },
      ],
      maxDailyMinutes: 120, // cap each day at 2 hours
    });

    expect(result.scheduled).toHaveLength(2);
    const s1 = result.scheduled.find((s) => s.taskId === 'task-1')!;
    const s2 = result.scheduled.find((s) => s.taskId === 'task-2')!;

    // One task scheduled on day 1, second task pushed to day 2
    expect(s1.date).toBe('2026-11-02');
    expect(s2.date).toBe('2026-11-03');
  });

  describe('Property-Based Invariants (fast-check)', () => {
    // Arbitrary for TaskCandidate
    const taskCandidateArbitrary = fc.record({
      id: fc.uuid(),
      goalId: fc.uuid(),
      title: fc.string({ minLength: 3, maxLength: 20 }),
      estimatedMinutes: fc.integer({ min: 15, max: 240 }),
      priority: fc.integer({ min: 1, max: 5 }),
      deadline: fc.constantFrom('2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'),
    });

    // Arbitrary for DayAvailability
    const dayAvailabilityArbitrary = fc.record({
      date: fc.constantFrom('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'),
      availableMinutes: fc.integer({ min: 60, max: 480 }),
      slots: fc.constant([
        { startMinute: 540, endMinute: 720 }, // 09:00 - 12:00
        { startMinute: 780, endMinute: 1020 }, // 13:00 - 17:00
      ]),
    });

    const schedulerInputArbitrary: fc.Arbitrary<SchedulerInput> = fc.record({
      tasks: fc.uniqueArray(taskCandidateArbitrary, { selector: (t) => t.id, maxLength: 10 }),
      availability: fc.uniqueArray(dayAvailabilityArbitrary, {
        selector: (d) => d.date,
        maxLength: 4,
      }),
      maxDailyMinutes: fc.option(fc.integer({ min: 60, max: 480 }), { nil: undefined }),
    });

    it('Invariant 1 & 2 & 3: Never produces overlaps, never exceeds capacity, never passes deadline', () => {
      fc.assert(
        fc.property(schedulerInputArbitrary, (input) => {
          const result = schedule(input);

          // Invariant: Zero defensive constraint violations
          expect(result.violations).toHaveLength(0);

          // Invariant 1: No overlaps on any day
          const tasksByDate = new Map<string, typeof result.scheduled>();
          for (const s of result.scheduled) {
            const arr = tasksByDate.get(s.date) ?? [];
            arr.push(s);
            tasksByDate.set(s.date, arr);
          }

          for (const [, dayTasks] of tasksByDate) {
            dayTasks.sort((a, b) => a.startMinute - b.startMinute);
            for (let i = 1; i < dayTasks.length; i++) {
              const prev = dayTasks[i - 1]!;
              const curr = dayTasks[i]!;
              expect(curr.startMinute).toBeGreaterThanOrEqual(prev.endMinute);
            }
          }

          // Invariant 2: Total scheduled minutes on any day <= available minutes
          const dayLimitMap = new Map<string, number>();
          for (const d of input.availability) {
            const limit = Math.min(d.availableMinutes, input.maxDailyMinutes ?? d.availableMinutes);
            dayLimitMap.set(d.date, limit);
          }

          for (const [date, dayTasks] of tasksByDate) {
            const totalMinutes = dayTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
            const limit = dayLimitMap.get(date) ?? 0;
            expect(totalMinutes).toBeLessThanOrEqual(limit);
          }

          // Invariant 3: Scheduled date <= task deadline
          const taskMap = new Map(input.tasks.map((t) => [t.id, t]));
          for (const s of result.scheduled) {
            const original = taskMap.get(s.taskId);
            if (original) {
              expect(s.date <= original.deadline).toBe(true);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Invariant 5: Work is never silently dropped (candidates.length === scheduled.length + unscheduled.length)', () => {
      fc.assert(
        fc.property(schedulerInputArbitrary, (input) => {
          const result = schedule(input);
          expect(result.scheduled.length + result.unscheduled.length).toBe(input.tasks.length);
          expect(result.tradeoffs.length).toBe(result.unscheduled.length);
        }),
        { numRuns: 100 }
      );
    });

    it('Invariant 6: Scheduler is 100% deterministic (calling twice yields identical results)', () => {
      fc.assert(
        fc.property(schedulerInputArbitrary, (input) => {
          const result1 = schedule(input);
          const result2 = schedule(input);
          expect(result1).toEqual(result2);
        }),
        { numRuns: 50 }
      );
    });
  });
});
