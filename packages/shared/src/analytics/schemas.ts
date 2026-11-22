import { z } from 'zod';

export const monthOverMonthTrendItemSchema = z.object({
  cycleId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  label: z.string(), // e.g. "Nov 2026"
  weightedAchievement: z.number().min(0).max(100),
  taskCompletionRate: z.number().min(0).max(100),
  estimateAccuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  totalTasksCompleted: z.number().int().min(0),
});
export type MonthOverMonthTrendItem = z.infer<typeof monthOverMonthTrendItemSchema>;

export const overallTrendMetricsSchema = z.object({
  achievementProgression: z.number(), // Net delta latest - earliest
  accuracyProgression: z.number(),
  consistencyProgression: z.number(),
  averageAchievement: z.number().min(0).max(100),
  averageAccuracy: z.number().min(0).max(100),
  averageConsistency: z.number().min(0).max(100),
  totalCyclesAnalyzed: z.number().int().min(2),
});
export type OverallTrendMetrics = z.infer<typeof overallTrendMetricsSchema>;

export const categorySuccessRateSchema = z.object({
  category: z.string(),
  totalGoals: z.number().int().min(0),
  averageScore: z.number().min(0).max(100),
  successRate: z.number().min(0).max(100), // Percent of goals >= 70% score
});
export type CategorySuccessRate = z.infer<typeof categorySuccessRateSchema>;

export const analyticsObservationSchema = z.object({
  id: z.string(),
  metricKey: z.enum([
    'accuracy_trend',
    'consistency_trend',
    'achievement_trend',
    'category_breakdown',
  ]),
  text: z.string(),
});
export type AnalyticsObservation = z.infer<typeof analyticsObservationSchema>;

export const monthOverMonthResponseSchema = z.object({
  status: z.enum(['sufficient_data', 'insufficient_data']),
  completedCyclesCount: z.number().int().min(0),
  requiredCyclesCount: z.literal(2),
  cycleTrends: z.array(monthOverMonthTrendItemSchema),
  summary: overallTrendMetricsSchema.nullable(),
  categoryBreakdown: z.array(categorySuccessRateSchema),
  observations: z.array(analyticsObservationSchema),
});
export type MonthOverMonthResponse = z.infer<typeof monthOverMonthResponseSchema>;
