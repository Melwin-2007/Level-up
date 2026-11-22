import { describe, it, expect } from 'vitest';
import { calculateMonthOverMonthTrends, type StoredReportData } from '../trends.js';
import type { CycleReportMetrics } from '../../validation/reports.js';

function createMockMetrics(
  score: number,
  completionRate: number,
  accuracyRatio: number,
  activeDaysRatio: number,
  completedTasks = 10
): CycleReportMetrics {
  return {
    weightedAchievement: {
      value: {
        score,
        totalWeight: 5,
        totalWeightedScore: score * 0.05,
        goals: [],
      },
      displayValue: `${score}%`,
      formula: 'sum(weight * score) / sum(weight)',
      inputs: {},
    },
    taskExecution: {
      value: {
        totalTasks: 12,
        completedTasks,
        inProgressTasks: 1,
        pendingTasks: 1,
        postponedTasks: 0,
        cancelledTasks: 0,
        completionRate,
        totalEstimatedMinutes: 600,
        totalActualMinutes: 550,
      },
      displayValue: `${completionRate}%`,
      formula: 'completedTasks / totalTasks',
      inputs: {},
    },
    estimateAccuracy: {
      value: {
        completedTasksCount: completedTasks,
        totalEstimatedMinutes: 600,
        totalActualMinutes: 550,
        varianceMinutes: -50,
        accuracyRatio,
        taskBreakdown: [],
      },
      displayValue: `${accuracyRatio}%`,
      formula: '1 - abs(variance / estimated)',
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
      formula: 'activeDays / totalCycleDays',
      inputs: {},
    },
    planComparison: {
      value: {
        baseline: {
          plannedTasks: 12,
          completedTasks,
          completionRate,
          plannedMinutes: 600,
          actualMinutes: 550,
        },
        currentPlan: {
          plannedTasks: 12,
          completedTasks,
          completionRate,
          plannedMinutes: 600,
          actualMinutes: 550,
        },
        scopeVariance: { addedTasks: 0, removedTasks: 0, rescheduledTasks: 0 },
      },
      displayValue: 'Baseline match',
      formula: 'baseline vs current',
      inputs: {},
    },
  };
}

describe('MonthOverMonth Analytics Trends (P90)', () => {
  it('should return insufficient_data when fewer than 2 cycles are provided', () => {
    const emptyRes = calculateMonthOverMonthTrends([]);
    expect(emptyRes.status).toBe('insufficient_data');
    expect(emptyRes.completedCyclesCount).toBe(0);
    expect(emptyRes.summary).toBeNull();

    const singleReport: StoredReportData = {
      cycleId: '11111111-1111-1111-1111-111111111111',
      year: 2026,
      month: 10,
      metrics: createMockMetrics(70, 80, 85, 75),
    };

    const singleRes = calculateMonthOverMonthTrends([singleReport]);
    expect(singleRes.status).toBe('insufficient_data');
    expect(singleRes.completedCyclesCount).toBe(1);
    expect(singleRes.summary).toBeNull();
  });

  it('should calculate progression and averages across 2 completed cycles', () => {
    const report1: StoredReportData = {
      cycleId: '11111111-1111-1111-1111-111111111111',
      year: 2026,
      month: 10, // Oct 2026
      metrics: createMockMetrics(70, 75, 80, 60, 15),
      goals: [
        { goalId: 'g1', title: 'Learn Rust', category: 'Engineering', score: 80 },
        { goalId: 'g2', title: 'Run 50km', category: 'Health', score: 60 },
      ],
    };

    const report2: StoredReportData = {
      cycleId: '22222222-2222-2222-2222-222222222222',
      year: 2026,
      month: 11, // Nov 2026
      metrics: createMockMetrics(85, 90, 88, 75, 18),
      goals: [
        { goalId: 'g3', title: 'Ship v1.0', category: 'Engineering', score: 90 },
        { goalId: 'g4', title: 'Marathon prep', category: 'Health', score: 80 },
      ],
    };

    const result = calculateMonthOverMonthTrends([report1, report2]);

    expect(result.status).toBe('sufficient_data');
    expect(result.completedCyclesCount).toBe(2);
    expect(result.cycleTrends).toHaveLength(2);

    expect(result.cycleTrends[0]?.label).toBe('Oct 2026');
    expect(result.cycleTrends[0]?.weightedAchievement).toBe(70);

    expect(result.cycleTrends[1]?.label).toBe('Nov 2026');
    expect(result.cycleTrends[1]?.weightedAchievement).toBe(85);

    // Summary calculations
    expect(result.summary).toBeDefined();
    expect(result.summary?.achievementProgression).toBe(15); // 85 - 70
    expect(result.summary?.accuracyProgression).toBe(8); // 88 - 80
    expect(result.summary?.consistencyProgression).toBe(15); // 75 - 60
    expect(result.summary?.averageAchievement).toBe(77.5); // (70 + 85) / 2
    expect(result.summary?.averageAccuracy).toBe(84); // (80 + 88) / 2

    // Category breakdown
    expect(result.categoryBreakdown).toHaveLength(2);
    const eng = result.categoryBreakdown.find((c) => c.category === 'Engineering');
    expect(eng?.totalGoals).toBe(2);
    expect(eng?.averageScore).toBe(85); // (80 + 90) / 2
    expect(eng?.successRate).toBe(100); // both >= 70

    const health = result.categoryBreakdown.find((c) => c.category === 'Health');
    expect(health?.totalGoals).toBe(2);
    expect(health?.averageScore).toBe(70); // (60 + 80) / 2
    expect(health?.successRate).toBe(50); // 1 of 2 >= 70

    // Observations
    expect(result.observations).toHaveLength(4);
    expect(result.observations.map((o) => o.metricKey)).toContain('achievement_trend');
    expect(result.observations.map((o) => o.metricKey)).toContain('accuracy_trend');
    expect(result.observations.map((o) => o.metricKey)).toContain('consistency_trend');
    expect(result.observations.map((o) => o.metricKey)).toContain('category_breakdown');
  });

  it('should sort reports chronologically regardless of input order', () => {
    const reportNov: StoredReportData = {
      cycleId: '22222222-2222-2222-2222-222222222222',
      year: 2026,
      month: 11,
      metrics: createMockMetrics(85, 90, 88, 75),
    };

    const reportOct: StoredReportData = {
      cycleId: '11111111-1111-1111-1111-111111111111',
      year: 2026,
      month: 10,
      metrics: createMockMetrics(70, 75, 80, 60),
    };

    // Passed in reverse order: Nov then Oct
    const result = calculateMonthOverMonthTrends([reportNov, reportOct]);

    expect(result.cycleTrends[0]?.label).toBe('Oct 2026');
    expect(result.cycleTrends[1]?.label).toBe('Nov 2026');
    expect(result.summary?.achievementProgression).toBe(15);
  });
});
