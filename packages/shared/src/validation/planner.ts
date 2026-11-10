import { z } from 'zod';

export const goalVerdictStatusSchema = z.enum(['achievable', 'at_risk', 'unrealistic']);
export type GoalVerdictStatus = z.infer<typeof goalVerdictStatusSchema>;

export const goalVerdictSchema = z.object({
  goalId: z.string().uuid(),
  status: goalVerdictStatusSchema,
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});
export type GoalVerdict = z.infer<typeof goalVerdictSchema>;

export const conflictTypeSchema = z.enum(['capacity', 'deadline', 'dependency']);
export type ConflictType = z.infer<typeof conflictTypeSchema>;

export const planConflictSchema = z.object({
  type: conflictTypeSchema,
  description: z.string().min(1),
  goalIds: z.array(z.string().uuid()).min(1),
});
export type PlanConflict = z.infer<typeof planConflictSchema>;

export const planMilestoneSchema = z.object({
  id: z.string().uuid().optional(),
  goalId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  targetWeek: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().min(15).max(6000),
  dependencies: z.array(z.string()).default([]),
});
export type PlanMilestone = z.infer<typeof planMilestoneSchema>;

export const feasibilityVerdictSchema = z.enum(['feasible', 'tight', 'infeasible']);
export type FeasibilityVerdict = z.infer<typeof feasibilityVerdictSchema>;

export const feasibilityReportSchema = z.object({
  verdict: feasibilityVerdictSchema,
  totalEstimatedHours: z.number().min(0),
  totalAvailableHours: z.number().min(0),
  capacityRatio: z.number().min(0),
  goalVerdicts: z.array(goalVerdictSchema),
  conflicts: z.array(planConflictSchema).default([]),
  rationale: z.string().min(1),
});
export type FeasibilityReport = z.infer<typeof feasibilityReportSchema>;

export const schedulerTradeoffSchema = z.object({
  taskId: z.string(),
  goalId: z.string(),
  explanation: z.string(),
});
export type SchedulerTradeoff = z.infer<typeof schedulerTradeoffSchema>;

export const movedTaskDiffSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
});
export type MovedTaskDiff = z.infer<typeof movedTaskDiffSchema>;

export const addedTaskDiffSchema = z.object({
  title: z.string(),
  goalId: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int(),
});
export type AddedTaskDiff = z.infer<typeof addedTaskDiffSchema>;

export const removedTaskDiffSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  originalDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int(),
});
export type RemovedTaskDiff = z.infer<typeof removedTaskDiffSchema>;

export const planDiffSchema = z.object({
  movedTasks: z.array(movedTaskDiffSchema).default([]),
  addedTasks: z.array(addedTaskDiffSchema).default([]),
  removedTasks: z.array(removedTaskDiffSchema).default([]),
  summary: z.string(),
});
export type PlanDiff = z.infer<typeof planDiffSchema>;

export const planDecompositionSchema = z.object({
  feasibility: feasibilityReportSchema,
  milestones: z.array(planMilestoneSchema).min(1),
  pacingSummary: z.string().min(1),
  tradeoffs: z.array(schedulerTradeoffSchema).default([]).optional(),
  diff: planDiffSchema.optional(),
});
export type PlanDecomposition = z.infer<typeof planDecompositionSchema>;

export const generatePlanInputSchema = z.object({
  adjustmentsNote: z
    .string()
    .trim()
    .max(1000, 'Adjustments note cannot exceed 1000 characters')
    .optional(),
});
export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;

export const approvePlanInputSchema = z.object({
  planVersionId: z.string().uuid(),
});
export type ApprovePlanInput = z.infer<typeof approvePlanInputSchema>;

export const reoptimizePlanSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  adjustmentsNote: z
    .string()
    .trim()
    .max(1000, 'Adjustments note cannot exceed 1000 characters')
    .optional(),
});
export type ReoptimizePlanInput = z.infer<typeof reoptimizePlanSchema>;
