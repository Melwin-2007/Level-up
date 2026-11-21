import { z } from 'zod';
import { successCriteriaSchema } from './submissions.js';

export const successCriteriaProgressSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('checklist'),
    completedItems: z.array(z.string()),
  }),
  z.object({
    type: z.literal('metric'),
    currentValue: z.number(),
  }),
  z.object({
    type: z.literal('binary'),
    completed: z.boolean(),
  }),
]);

export type SuccessCriteriaProgress = z.infer<typeof successCriteriaProgressSchema>;

export const goalMetricInputSchema = z.object({
  goalId: z.string(),
  title: z.string(),
  priority: z.number().int().min(1).max(5).default(1),
  estimatedHours: z.number().optional(),
  status: z.string().optional(),
  successCriteria: successCriteriaSchema.optional(),
  progress: successCriteriaProgressSchema.optional(),
});

export type GoalMetricInput = z.infer<typeof goalMetricInputSchema>;

export const goalAchievementDetailSchema = z.object({
  goalId: z.string(),
  title: z.string(),
  weight: z.number(),
  rawScore: z.number(), // 0.0 to 1.0
  weightedScore: z.number(),
  criteriaType: z.enum(['checklist', 'metric', 'binary', 'tasks_fallback', 'none']),
  calculationDetails: z.string(),
});

export type GoalAchievementDetail = z.infer<typeof goalAchievementDetailSchema>;

export const weightedAchievementMetricSchema = z.object({
  score: z.number(), // 0 to 100 percentage
  totalWeight: z.number(),
  totalWeightedScore: z.number(),
  goals: z.array(goalAchievementDetailSchema),
});

export type WeightedAchievementMetric = z.infer<typeof weightedAchievementMetricSchema>;

export const taskExecutionMetricSchema = z.object({
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  inProgressTasks: z.number().int().min(0),
  pendingTasks: z.number().int().min(0),
  postponedTasks: z.number().int().min(0),
  cancelledTasks: z.number().int().min(0),
  completionRate: z.number(), // 0 to 100 percentage
  totalEstimatedMinutes: z.number().int().min(0),
  totalActualMinutes: z.number().int().min(0),
});

export type TaskExecutionMetric = z.infer<typeof taskExecutionMetricSchema>;

export const taskAccuracyItemSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int().min(0),
  actualMinutes: z.number().int().min(0),
  varianceMinutes: z.number().int(),
});

export type TaskAccuracyItem = z.infer<typeof taskAccuracyItemSchema>;

export const estimateAccuracyMetricSchema = z.object({
  completedTasksCount: z.number().int().min(0),
  totalEstimatedMinutes: z.number().int().min(0),
  totalActualMinutes: z.number().int().min(0),
  varianceMinutes: z.number().int(),
  accuracyRatio: z.number(), // 0 to 100 percentage
  taskBreakdown: z.array(taskAccuracyItemSchema),
});

export type EstimateAccuracyMetric = z.infer<typeof estimateAccuracyMetricSchema>;

export const weekConsistencyItemSchema = z.object({
  weekNumber: z.number().int().min(1).max(5),
  scheduledTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  completionRate: z.number(), // 0 to 100 percentage
});

export type WeekConsistencyItem = z.infer<typeof weekConsistencyItemSchema>;

export const consistencyMetricSchema = z.object({
  activeDays: z.number().int().min(0),
  totalCycleDays: z.number().int().min(1),
  activeDaysRatio: z.number(), // 0 to 100 percentage
  weeklyCompletion: z.array(weekConsistencyItemSchema),
});

export type ConsistencyMetric = z.infer<typeof consistencyMetricSchema>;

export const planPerformanceRecordSchema = z.object({
  plannedTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  completionRate: z.number(), // 0 to 100 percentage
  plannedMinutes: z.number().int().min(0),
  actualMinutes: z.number().int().min(0),
});

export type PlanPerformanceRecord = z.infer<typeof planPerformanceRecordSchema>;

export const planComparisonMetricSchema = z.object({
  baseline: planPerformanceRecordSchema,
  currentPlan: planPerformanceRecordSchema,
  scopeVariance: z.object({
    addedTasks: z.number().int().min(0),
    removedTasks: z.number().int().min(0),
    rescheduledTasks: z.number().int().min(0),
  }),
});

export type PlanComparisonMetric = z.infer<typeof planComparisonMetricSchema>;

export function metricResultSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    value: schema,
    displayValue: z.string(),
    formula: z.string(),
    inputs: z.record(z.unknown()),
  });
}

export type MetricResult<T> = {
  value: T;
  displayValue: string;
  formula: string;
  inputs: Record<string, unknown>;
};

export const cycleReportMetricsSchema = z.object({
  weightedAchievement: metricResultSchema(weightedAchievementMetricSchema),
  taskExecution: metricResultSchema(taskExecutionMetricSchema),
  estimateAccuracy: metricResultSchema(estimateAccuracyMetricSchema),
  consistency: metricResultSchema(consistencyMetricSchema),
  planComparison: metricResultSchema(planComparisonMetricSchema),
});

export type CycleReportMetrics = z.infer<typeof cycleReportMetricsSchema>;

export const reportInsightCitationSchema = z.object({
  metricId: z.enum([
    'weighted_achievement',
    'task_execution',
    'estimate_accuracy',
    'consistency',
    'plan_comparison',
  ]),
  metricValue: z.string(),
  reason: z.string(),
});

export type ReportInsightCitation = z.infer<typeof reportInsightCitationSchema>;

export const reportInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  observation: z.string(),
  recommendation: z.string(),
  citations: z
    .array(reportInsightCitationSchema)
    .min(1, 'Each insight must cite at least one metric'),
});

export type ReportInsight = z.infer<typeof reportInsightSchema>;

export const memberSharingSettingsSchema = z.object({
  shareAchievementRate: z.boolean().default(true),
  shareCompletedTasksCount: z.boolean().default(true),
  shareConsistencyScore: z.boolean().default(true),
  shareGoalTitles: z.boolean().default(false),
});

export type MemberSharingSettings = z.infer<typeof memberSharingSettingsSchema>;

export const regenerateReportSchema = z.object({
  note: z.string().trim().min(5, 'Regeneration note must be at least 5 characters').max(500),
});

export type RegenerateReportInput = z.infer<typeof regenerateReportSchema>;

export const monthlyReportResponseSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  reportType: z.enum(['individual', 'group']),
  metrics: cycleReportMetricsSchema,
  insights: z.array(reportInsightSchema).nullable().optional(),
  sharingSettings: memberSharingSettingsSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});

export type MonthlyReportResponse = z.infer<typeof monthlyReportResponseSchema>;

export const groupMemberReportSummarySchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  achievementRate: z.number().nullable(),
  tasksCompleted: z.number().nullable(),
  consistencyRate: z.number().nullable(),
  goalTitles: z.array(z.string()),
});

export type GroupMemberReportSummary = z.infer<typeof groupMemberReportSummarySchema>;

export const groupReportMetricsSchema = z.object({
  totalMembers: z.number().int().min(0),
  participatingMembers: z.number().int().min(0),
  averageAchievementRate: z.number().min(0).max(100),
  totalCompletedTasks: z.number().int().min(0),
  averageConsistency: z.number().min(0).max(100),
  memberSummaries: z.array(groupMemberReportSummarySchema),
});

export type GroupReportMetrics = z.infer<typeof groupReportMetricsSchema>;

export const groupReportResponseSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  reportType: z.literal('group'),
  metrics: groupReportMetricsSchema,
  createdAt: z.string().datetime(),
});

export type GroupReportResponse = z.infer<typeof groupReportResponseSchema>;
