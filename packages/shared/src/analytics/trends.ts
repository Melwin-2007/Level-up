import type { CycleReportMetrics } from '../validation/reports.js';
import type {
  MonthOverMonthTrendItem,
  OverallTrendMetrics,
  CategorySuccessRate,
  AnalyticsObservation,
  MonthOverMonthResponse,
} from './schemas.js';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface GoalCategoryInput {
  goalId: string;
  title: string;
  category?: string | null;
  score: number; // 0 to 100 percentage
}

export interface StoredReportData {
  cycleId: string;
  year: number;
  month: number;
  metrics: CycleReportMetrics;
  goals?: GoalCategoryInput[];
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function calculateMonthOverMonthTrends(reports: StoredReportData[]): MonthOverMonthResponse {
  if (!reports || reports.length < 2) {
    return {
      status: 'insufficient_data',
      completedCyclesCount: reports?.length ?? 0,
      requiredCyclesCount: 2,
      cycleTrends: [],
      summary: null,
      categoryBreakdown: [],
      observations: [],
    };
  }

  // 1. Sort chronologically
  const sorted = [...reports].sort((a, b) => {
    const aOrder = a.year * 12 + a.month;
    const bOrder = b.year * 12 + b.month;
    return aOrder - bOrder;
  });

  // 2. Map trend items
  const cycleTrends: MonthOverMonthTrendItem[] = sorted.map((r) => {
    const monthName = MONTH_NAMES[(r.month - 1) % 12] ?? `M${r.month}`;
    const label = `${monthName} ${r.year}`;

    return {
      cycleId: r.cycleId,
      year: r.year,
      month: r.month,
      label,
      weightedAchievement: round1(r.metrics.weightedAchievement.value.score),
      taskCompletionRate: round1(r.metrics.taskExecution.value.completionRate),
      estimateAccuracy: round1(r.metrics.estimateAccuracy.value.accuracyRatio),
      consistency: round1(r.metrics.consistency.value.activeDaysRatio),
      totalTasksCompleted: r.metrics.taskExecution.value.completedTasks,
    };
  });

  const earliest = cycleTrends[0]!;
  const latest = cycleTrends[cycleTrends.length - 1]!;

  // 3. Overall progression & averages
  const count = cycleTrends.length;
  const avgAchievement = cycleTrends.reduce((sum, c) => sum + c.weightedAchievement, 0) / count;
  const avgAccuracy = cycleTrends.reduce((sum, c) => sum + c.estimateAccuracy, 0) / count;
  const avgConsistency = cycleTrends.reduce((sum, c) => sum + c.consistency, 0) / count;

  const summary: OverallTrendMetrics = {
    achievementProgression: round1(latest.weightedAchievement - earliest.weightedAchievement),
    accuracyProgression: round1(latest.estimateAccuracy - earliest.estimateAccuracy),
    consistencyProgression: round1(latest.consistency - earliest.consistency),
    averageAchievement: round1(avgAchievement),
    averageAccuracy: round1(avgAccuracy),
    averageConsistency: round1(avgConsistency),
    totalCyclesAnalyzed: count,
  };

  // 4. Goal category success breakdown
  const categoryMap = new Map<string, { total: number; sumScore: number; passed: number }>();

  for (const r of sorted) {
    const goals = r.goals ?? [];
    for (const g of goals) {
      const cat = g.category && g.category.trim() ? g.category.trim() : 'General';
      const existing = categoryMap.get(cat) ?? { total: 0, sumScore: 0, passed: 0 };
      existing.total += 1;
      existing.sumScore += g.score;
      if (g.score >= 70) {
        existing.passed += 1;
      }
      categoryMap.set(cat, existing);
    }
  }

  const categoryBreakdown: CategorySuccessRate[] = Array.from(categoryMap.entries()).map(
    ([category, stats]) => ({
      category,
      totalGoals: stats.total,
      averageScore: round1(stats.total > 0 ? stats.sumScore / stats.total : 0),
      successRate: round1(stats.total > 0 ? (stats.passed / stats.total) * 100 : 0),
    })
  );

  // 5. Evidence-backed observations citing metric keys
  const observations: AnalyticsObservation[] = [];

  // Achievement observation
  const achDelta = summary.achievementProgression;
  const achDirection = achDelta > 0 ? `+${achDelta}%` : `${achDelta}%`;
  observations.push({
    id: 'obs-achievement',
    metricKey: 'achievement_trend',
    text: `Achievement rate progressed by ${achDirection} from ${earliest.label} (${earliest.weightedAchievement}%) to ${latest.label} (${latest.weightedAchievement}%).`,
  });

  // Accuracy observation
  const accDelta = summary.accuracyProgression;
  const accDirection = accDelta >= 0 ? `+${accDelta}%` : `${accDelta}%`;
  observations.push({
    id: 'obs-accuracy',
    metricKey: 'accuracy_trend',
    text: `Estimation accuracy changed by ${accDirection} over ${count} cycles, averaging ${summary.averageAccuracy}%.`,
  });

  // Consistency observation
  const consDelta = summary.consistencyProgression;
  const consDirection = consDelta >= 0 ? `+${consDelta}%` : `${consDelta}%`;
  observations.push({
    id: 'obs-consistency',
    metricKey: 'consistency_trend',
    text: `Execution consistency shifted by ${consDirection}, with an average active-day ratio of ${summary.averageConsistency}%.`,
  });

  // Category observation if available
  if (categoryBreakdown.length > 0) {
    const topCategory = [...categoryBreakdown].sort((a, b) => b.averageScore - a.averageScore)[0];
    if (topCategory) {
      observations.push({
        id: 'obs-category',
        metricKey: 'category_breakdown',
        text: `Top performing category is "${topCategory.category}" with an average achievement score of ${topCategory.averageScore}%.`,
      });
    }
  }

  return {
    status: 'sufficient_data',
    completedCyclesCount: count,
    requiredCyclesCount: 2,
    cycleTrends,
    summary,
    categoryBreakdown,
    observations,
  };
}
