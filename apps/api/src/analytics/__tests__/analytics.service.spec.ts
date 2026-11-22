import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CycleReportMetrics } from '@mp/shared';

function createMockMetrics(
  score: number,
  completionRate: number,
  accuracyRatio: number,
  activeDaysRatio: number,
  goals: Array<{ goalId: string; rawScore: number }> = []
): CycleReportMetrics {
  return {
    weightedAchievement: {
      value: {
        score,
        totalWeight: 5,
        totalWeightedScore: score * 0.05,
        goals: goals.map((g) => ({
          goalId: g.goalId,
          title: 'Goal title',
          weight: 1,
          rawScore: g.rawScore,
          weightedScore: g.rawScore * 0.2,
          criteriaType: 'binary',
          calculationDetails: 'test',
        })),
      },
      displayValue: `${score}%`,
      formula: 'sum(weight * score)',
      inputs: {},
    },
    taskExecution: {
      value: {
        totalTasks: 10,
        completedTasks: 8,
        inProgressTasks: 1,
        pendingTasks: 1,
        postponedTasks: 0,
        cancelledTasks: 0,
        completionRate,
        totalEstimatedMinutes: 500,
        totalActualMinutes: 480,
      },
      displayValue: `${completionRate}%`,
      formula: 'completed / total',
      inputs: {},
    },
    estimateAccuracy: {
      value: {
        completedTasksCount: 8,
        totalEstimatedMinutes: 500,
        totalActualMinutes: 480,
        varianceMinutes: -20,
        accuracyRatio,
        taskBreakdown: [],
      },
      displayValue: `${accuracyRatio}%`,
      formula: 'accuracy',
      inputs: {},
    },
    consistency: {
      value: {
        activeDays: 20,
        totalCycleDays: 30,
        activeDaysRatio,
        weeklyCompletion: [],
      },
      displayValue: `${activeDaysRatio}%`,
      formula: 'consistency',
      inputs: {},
    },
    planComparison: {
      value: {
        baseline: {
          plannedTasks: 10,
          completedTasks: 8,
          completionRate,
          plannedMinutes: 500,
          actualMinutes: 480,
        },
        currentPlan: {
          plannedTasks: 10,
          completedTasks: 8,
          completionRate,
          plannedMinutes: 500,
          actualMinutes: 480,
        },
        scopeVariance: { addedTasks: 0, removedTasks: 0, rescheduledTasks: 0 },
      },
      displayValue: 'Baseline match',
      formula: 'comparison',
      inputs: {},
    },
  };
}

describe('AnalyticsService (P90)', () => {
  let analyticsService: AnalyticsService;
  let mockPrisma: {
    monthlyReport: { findMany: ReturnType<typeof vi.fn> };
    goal: { findMany: ReturnType<typeof vi.fn> };
  };

  const userId = 'user-uuid-1';
  const cycleId1 = '11111111-1111-1111-1111-111111111111';
  const cycleId2 = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    mockPrisma = {
      monthlyReport: {
        findMany: vi.fn(),
      },
      goal: {
        findMany: vi.fn(),
      },
    };

    analyticsService = new AnalyticsService(mockPrisma as unknown as PrismaService);
  });

  it('should return insufficient_data when user has fewer than 2 completed cycle reports', async () => {
    mockPrisma.monthlyReport.findMany.mockResolvedValueOnce([
      {
        id: 'report-1',
        cycleId: cycleId1,
        userId,
        reportType: 'individual',
        metrics: createMockMetrics(70, 75, 80, 65),
        cycle: { id: cycleId1, year: 2026, month: 10, status: 'completed' },
      },
    ]);

    const res = await analyticsService.getMonthOverMonthAnalytics(userId);

    expect(res.status).toBe('insufficient_data');
    expect(res.completedCyclesCount).toBe(1);
    expect(res.requiredCyclesCount).toBe(2);
    expect(res.summary).toBeNull();
  });

  it('should return trends and category breakdown when user has 2 completed cycle reports', async () => {
    mockPrisma.monthlyReport.findMany.mockResolvedValueOnce([
      {
        id: 'report-1',
        cycleId: cycleId1,
        userId,
        reportType: 'individual',
        metrics: createMockMetrics(70, 75, 80, 65, [{ goalId: 'goal-1', rawScore: 0.8 }]),
        cycle: { id: cycleId1, year: 2026, month: 10, status: 'completed' },
      },
      {
        id: 'report-2',
        cycleId: cycleId2,
        userId,
        reportType: 'individual',
        metrics: createMockMetrics(85, 90, 88, 75, [{ goalId: 'goal-2', rawScore: 0.9 }]),
        cycle: { id: cycleId2, year: 2026, month: 11, status: 'completed' },
      },
    ]);

    mockPrisma.goal.findMany.mockResolvedValueOnce([
      { id: 'goal-1', cycleId: cycleId1, title: 'Learn Go', category: 'Engineering' },
      { id: 'goal-2', cycleId: cycleId2, title: 'Build App', category: 'Engineering' },
    ]);

    const res = await analyticsService.getMonthOverMonthAnalytics(userId);

    expect(res.status).toBe('sufficient_data');
    expect(res.completedCyclesCount).toBe(2);
    expect(res.cycleTrends).toHaveLength(2);
    expect(res.cycleTrends[0]?.label).toBe('Oct 2026');
    expect(res.cycleTrends[1]?.label).toBe('Nov 2026');

    expect(res.summary?.achievementProgression).toBe(15);
    expect(res.summary?.accuracyProgression).toBe(8);
    expect(res.summary?.averageAchievement).toBe(77.5);

    expect(res.categoryBreakdown).toHaveLength(1);
    expect(res.categoryBreakdown[0]?.category).toBe('Engineering');
    expect(res.categoryBreakdown[0]?.totalGoals).toBe(2);
    expect(res.categoryBreakdown[0]?.averageScore).toBe(85); // (80 + 90) / 2
  });
});
