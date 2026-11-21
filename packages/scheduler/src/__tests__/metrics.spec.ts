import { describe, it, expect } from 'vitest';
import {
  calculateGoalAchievement,
  calculateWeightedAchievement,
  calculateTaskExecutionCounts,
  calculateEstimateAccuracy,
  calculateConsistency,
  calculatePlanComparison,
  calculateCycleMetrics,
} from '../metrics';
import type {
  GoalMetricInput,
  TaskExecutionItem,
  TaskLogItem,
  PlanItemSnapshot,
  WeekConsistencyItem,
} from '../types';

describe('Metrics Calculator (@mp/scheduler - P60)', () => {
  describe('calculateGoalAchievement', () => {
    it('should calculate partial credit for checklist criteria', () => {
      const goal: GoalMetricInput = {
        goalId: 'goal-1',
        title: 'Launch Blog',
        priority: 4,
        successCriteria: {
          type: 'checklist',
          items: ['Draft post', 'Review draft', 'Create graphics', 'Publish'],
        },
        progress: {
          type: 'checklist',
          completedItems: ['Draft post', 'Review draft'],
        },
      };

      const result = calculateGoalAchievement(goal, []);
      expect(result.rawScore).toBe(0.5);
      expect(result.weight).toBe(4);
      expect(result.weightedScore).toBe(2);
      expect(result.criteriaType).toBe('checklist');
      expect(result.calculationDetails).toContain('2/4 checklist items completed');
    });

    it('should ignore invalid items not in checklist definition', () => {
      const goal: GoalMetricInput = {
        goalId: 'goal-1',
        title: 'Launch Blog',
        priority: 3,
        successCriteria: {
          type: 'checklist',
          items: ['Item A', 'Item B'],
        },
        progress: {
          type: 'checklist',
          completedItems: ['Item A', 'Item X (unknown)'],
        },
      };

      const result = calculateGoalAchievement(goal, []);
      expect(result.rawScore).toBe(0.5);
      expect(result.calculationDetails).toContain('1/2 checklist items completed');
    });

    it('should calculate partial credit for metric criteria', () => {
      const goal: GoalMetricInput = {
        goalId: 'goal-2',
        title: 'Run 100km',
        priority: 5,
        successCriteria: {
          type: 'metric',
          target: 100,
          unit: 'km',
        },
        progress: {
          type: 'metric',
          currentValue: 75,
        },
      };

      const result = calculateGoalAchievement(goal, []);
      expect(result.rawScore).toBe(0.75);
      expect(result.weight).toBe(5);
      expect(result.weightedScore).toBe(3.75);
      expect(result.criteriaType).toBe('metric');
      expect(result.calculationDetails).toContain('75/100 km achieved');
    });

    it('should cap metric score at 1.0 when target is exceeded', () => {
      const goal: GoalMetricInput = {
        goalId: 'goal-2',
        title: 'Run 100km',
        priority: 5,
        successCriteria: {
          type: 'metric',
          target: 100,
          unit: 'km',
        },
        progress: {
          type: 'metric',
          currentValue: 150,
        },
      };

      const result = calculateGoalAchievement(goal, []);
      expect(result.rawScore).toBe(1.0);
    });

    it('should evaluate binary success criteria accurately', () => {
      const passedGoal: GoalMetricInput = {
        goalId: 'goal-3',
        title: 'Pass Certification Exam',
        priority: 3,
        successCriteria: { type: 'binary' },
        progress: { type: 'binary', completed: true },
      };

      const failedGoal: GoalMetricInput = {
        goalId: 'goal-4',
        title: 'File Patent',
        priority: 2,
        successCriteria: { type: 'binary' },
        progress: { type: 'binary', completed: false },
      };

      expect(calculateGoalAchievement(passedGoal, []).rawScore).toBe(1.0);
      expect(calculateGoalAchievement(failedGoal, []).rawScore).toBe(0.0);
    });

    it('should fallback to associated tasks when no success criteria is defined', () => {
      const goal: GoalMetricInput = {
        goalId: 'goal-5',
        title: 'Refactor Auth Module',
        priority: 4,
      };

      const tasks: TaskExecutionItem[] = [
        { id: 't-1', goalId: 'goal-5', title: 'Task 1', status: 'completed', estimatedMinutes: 60 },
        { id: 't-2', goalId: 'goal-5', title: 'Task 2', status: 'completed', estimatedMinutes: 60 },
        { id: 't-3', goalId: 'goal-5', title: 'Task 3', status: 'completed', estimatedMinutes: 60 },
        { id: 't-4', goalId: 'goal-5', title: 'Task 4', status: 'pending', estimatedMinutes: 60 },
      ];

      const result = calculateGoalAchievement(goal, tasks);
      expect(result.rawScore).toBe(0.75);
      expect(result.criteriaType).toBe('tasks_fallback');
      expect(result.calculationDetails).toContain('3/4 associated tasks completed');
    });

    it('should fallback to goal status when no criteria and no tasks exist', () => {
      const completedGoal: GoalMetricInput = {
        goalId: 'g-comp',
        title: 'Simple Goal',
        priority: 2,
        status: 'completed',
      };
      const pendingGoal: GoalMetricInput = {
        goalId: 'g-pend',
        title: 'Simple Goal 2',
        priority: 2,
        status: 'pending',
      };

      expect(calculateGoalAchievement(completedGoal, []).rawScore).toBe(1.0);
      expect(calculateGoalAchievement(pendingGoal, []).rawScore).toBe(0.0);
    });
  });

  describe('calculateWeightedAchievement', () => {
    it('should compute priority-weighted achievement rate correctly', () => {
      const goals: GoalMetricInput[] = [
        {
          goalId: 'g-1',
          title: 'High Priority Goal',
          priority: 5,
          successCriteria: { type: 'binary' },
          progress: { type: 'binary', completed: true }, // score = 1.0, weighted = 5
        },
        {
          goalId: 'g-2',
          title: 'Low Priority Goal',
          priority: 1,
          successCriteria: { type: 'binary' },
          progress: { type: 'binary', completed: false }, // score = 0.0, weighted = 0
        },
      ];

      // Total weight = 5 + 1 = 6
      // Total weighted score = 5.0
      // Expected score = (5 / 6) * 100 = 83.333% -> 83.3%
      const result = calculateWeightedAchievement(goals, []);
      expect(result.value.score).toBe(83.3);
      expect(result.value.totalWeight).toBe(6);
      expect(result.value.totalWeightedScore).toBe(5);
      expect(result.displayValue).toBe('83.3%');
      expect(result.inputs.totalGoals).toBe(2);
    });

    it('should return 0% when goals list is empty', () => {
      const result = calculateWeightedAchievement([], []);
      expect(result.value.score).toBe(0);
      expect(result.value.totalWeight).toBe(0);
      expect(result.displayValue).toBe('0%');
    });
  });

  describe('calculateTaskExecutionCounts', () => {
    it('should aggregate task status counts and compute completion rate', () => {
      const tasks: TaskExecutionItem[] = [
        { id: '1', title: 'T1', status: 'completed', estimatedMinutes: 60, actualMinutes: 50 },
        { id: '2', title: 'T2', status: 'completed', estimatedMinutes: 90, actualMinutes: 90 },
        { id: '3', title: 'T3', status: 'in_progress', estimatedMinutes: 60, actualMinutes: 20 },
        { id: '4', title: 'T4', status: 'pending', estimatedMinutes: 45 },
        { id: '5', title: 'T5', status: 'postponed', estimatedMinutes: 30 },
        { id: '6', title: 'T6', status: 'cancelled', estimatedMinutes: 60 },
      ];

      const logs: TaskLogItem[] = [
        { id: 'l1', taskId: '4', action: 'postpone', durationMinutes: 0, loggedAt: '2026-11-15' },
      ];

      const result = calculateTaskExecutionCounts(tasks, logs);
      expect(result.value.totalTasks).toBe(6);
      expect(result.value.completedTasks).toBe(2);
      expect(result.value.inProgressTasks).toBe(1);
      expect(result.value.pendingTasks).toBe(1);
      expect(result.value.cancelledTasks).toBe(1);
      // Both task 5 (status postponed) and task 4 (postpone log) counted
      expect(result.value.postponedTasks).toBe(2);
      expect(result.value.completionRate).toBe(33.3); // 2 / 6 = 33.3%
      expect(result.value.totalEstimatedMinutes).toBe(345);
      expect(result.value.totalActualMinutes).toBe(160);
      expect(result.displayValue).toBe('2/6 tasks (33.3%)');
    });

    it('should handle zero tasks cleanly', () => {
      const result = calculateTaskExecutionCounts([], []);
      expect(result.value.totalTasks).toBe(0);
      expect(result.value.completionRate).toBe(0);
    });
  });

  describe('calculateEstimateAccuracy', () => {
    it('should compute estimate accuracy and variance on completed tasks', () => {
      const tasks: TaskExecutionItem[] = [
        { id: '1', title: 'Task A', status: 'completed', estimatedMinutes: 60, actualMinutes: 70 },
        {
          id: '2',
          title: 'Task B',
          status: 'completed',
          estimatedMinutes: 120,
          actualMinutes: 110,
        },
        { id: '3', title: 'Task C', status: 'pending', estimatedMinutes: 60, actualMinutes: 0 },
      ];

      // Completed tasks total: estimated = 180, actual = 180, variance = 0
      const result = calculateEstimateAccuracy(tasks);
      expect(result.value.completedTasksCount).toBe(2);
      expect(result.value.totalEstimatedMinutes).toBe(180);
      expect(result.value.totalActualMinutes).toBe(180);
      expect(result.value.varianceMinutes).toBe(0);
      expect(result.value.accuracyRatio).toBe(100);
      expect(result.displayValue).toContain('100% accuracy');
    });

    it('should calculate accuracy degradation when variance exists', () => {
      const tasks: TaskExecutionItem[] = [
        {
          id: '1',
          title: 'Task A',
          status: 'completed',
          estimatedMinutes: 100,
          actualMinutes: 130,
        },
      ];

      // Error = 30 / 100 = 0.3 -> Accuracy = (1 - 0.3) * 100 = 70%
      const result = calculateEstimateAccuracy(tasks);
      expect(result.value.varianceMinutes).toBe(30);
      expect(result.value.accuracyRatio).toBe(70);
      expect(result.displayValue).toContain('+30m variance');
    });

    it('should handle zero completed tasks with 100% default accuracy', () => {
      const result = calculateEstimateAccuracy([]);
      expect(result.value.completedTasksCount).toBe(0);
      expect(result.value.accuracyRatio).toBe(100);
    });
  });

  describe('calculateConsistency', () => {
    it('should compute active calendar days and weekly breakdown', () => {
      const tasks: TaskExecutionItem[] = [
        {
          id: '1',
          title: 'T1',
          status: 'completed',
          scheduledDate: '2026-11-03',
          completedAt: '2026-11-03T18:00:00Z',
          estimatedMinutes: 60,
        },
        {
          id: '2',
          title: 'T2',
          status: 'completed',
          scheduledDate: '2026-11-10',
          completedAt: '2026-11-10T19:00:00Z',
          estimatedMinutes: 60,
        },
        {
          id: '3',
          title: 'T3',
          status: 'pending',
          scheduledDate: '2026-11-17',
          estimatedMinutes: 60,
        },
      ];

      const logs: TaskLogItem[] = [
        {
          id: 'l1',
          taskId: '3',
          action: 'start',
          durationMinutes: 15,
          loggedAt: '2026-11-16T10:00:00Z',
        },
      ];

      // Active days: 2026-11-03, 2026-11-10, 2026-11-16 (3 distinct active days)
      // Cycle: 2026-11-01 to 2026-11-30 = 30 days
      const result = calculateConsistency(tasks, logs, '2026-11-01', '2026-11-30');
      expect(result.value.activeDays).toBe(3);
      expect(result.value.totalCycleDays).toBe(30);
      expect(result.value.activeDaysRatio).toBe(10); // 3 / 30 = 10%

      // Weekly completion:
      // Week 1 (days 1..7): Task 1 scheduled and completed (1/1 = 100%)
      // Week 2 (days 8..14): Task 2 scheduled and completed (1/1 = 100%)
      // Week 3 (days 15..21): Task 3 scheduled and pending (0/1 = 0%)
      const week1 = result.value.weeklyCompletion.find(
        (w: WeekConsistencyItem) => w.weekNumber === 1
      );
      const week2 = result.value.weeklyCompletion.find(
        (w: WeekConsistencyItem) => w.weekNumber === 2
      );
      const week3 = result.value.weeklyCompletion.find(
        (w: WeekConsistencyItem) => w.weekNumber === 3
      );

      expect(week1?.completionRate).toBe(100);
      expect(week2?.completionRate).toBe(100);
      expect(week3?.completionRate).toBe(0);
    });
  });

  describe('calculatePlanComparison', () => {
    it('should compare baseline plan against current reoptimized plan and actual tasks', () => {
      const baselineItems: PlanItemSnapshot[] = [
        {
          id: 'p-1',
          itemType: 'daily_task',
          title: 'Task 1',
          plannedDate: '2026-11-05',
          estimatedMinutes: 60,
        },
        {
          id: 'p-2',
          itemType: 'daily_task',
          title: 'Task 2',
          plannedDate: '2026-11-10',
          estimatedMinutes: 90,
        },
        {
          id: 'p-3',
          itemType: 'daily_task',
          title: 'Task 3 (dropped)',
          plannedDate: '2026-11-20',
          estimatedMinutes: 60,
        },
      ];

      const currentItems: PlanItemSnapshot[] = [
        {
          id: 'p-1',
          itemType: 'daily_task',
          title: 'Task 1',
          plannedDate: '2026-11-05',
          estimatedMinutes: 60,
        },
        {
          id: 'p-2',
          itemType: 'daily_task',
          title: 'Task 2',
          plannedDate: '2026-11-12',
          estimatedMinutes: 90,
        }, // rescheduled
        {
          id: 'p-4',
          itemType: 'daily_task',
          title: 'Task 4 (new)',
          plannedDate: '2026-11-25',
          estimatedMinutes: 45,
        }, // added
      ];

      const tasks: TaskExecutionItem[] = [
        {
          id: 't-1',
          planItemId: 'p-1',
          title: 'Task 1',
          status: 'completed',
          actualMinutes: 55,
          estimatedMinutes: 60,
        },
        {
          id: 't-2',
          planItemId: 'p-2',
          title: 'Task 2',
          status: 'completed',
          actualMinutes: 90,
          estimatedMinutes: 90,
        },
      ];

      const result = calculatePlanComparison(baselineItems, currentItems, tasks);

      // Baseline: 3 planned, 2 completed (66.7%)
      expect(result.value.baseline.plannedTasks).toBe(3);
      expect(result.value.baseline.completedTasks).toBe(2);
      expect(result.value.baseline.completionRate).toBe(66.7);

      // Current Plan: 3 planned, 2 completed (66.7%)
      expect(result.value.currentPlan.plannedTasks).toBe(3);
      expect(result.value.currentPlan.completedTasks).toBe(2);
      expect(result.value.currentPlan.completionRate).toBe(66.7);

      // Scope variance:
      // added: p-4 (1)
      // removed: p-3 (1)
      // rescheduled: p-2 (1)
      expect(result.value.scopeVariance.addedTasks).toBe(1);
      expect(result.value.scopeVariance.removedTasks).toBe(1);
      expect(result.value.scopeVariance.rescheduledTasks).toBe(1);
    });
  });

  describe('calculateCycleMetrics', () => {
    it('should compute full composite cycle metrics object', () => {
      const goals: GoalMetricInput[] = [
        {
          goalId: 'g-1',
          title: 'Goal 1',
          priority: 5,
          successCriteria: { type: 'binary' },
          progress: { type: 'binary', completed: true },
        },
      ];

      const tasks: TaskExecutionItem[] = [
        {
          id: 't-1',
          goalId: 'g-1',
          title: 'Task 1',
          status: 'completed',
          scheduledDate: '2026-11-05',
          completedAt: '2026-11-05T12:00:00Z',
          estimatedMinutes: 60,
          actualMinutes: 65,
        },
      ];

      const cycleMetrics = calculateCycleMetrics({
        goals,
        tasks,
        cycleStartDate: '2026-11-01',
        cycleEndDate: '2026-11-30',
      });

      expect(cycleMetrics.weightedAchievement.value.score).toBe(100);
      expect(cycleMetrics.taskExecution.value.completionRate).toBe(100);
      expect(cycleMetrics.estimateAccuracy.value.varianceMinutes).toBe(5);
      expect(cycleMetrics.consistency.value.activeDays).toBe(1);
      expect(cycleMetrics.planComparison).toBeDefined();
    });
  });
});
