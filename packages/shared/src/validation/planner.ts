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

export const planDecompositionSchema = z.object({
  feasibility: feasibilityReportSchema,
  milestones: z.array(planMilestoneSchema).min(1),
  pacingSummary: z.string().min(1),
});
export type PlanDecomposition = z.infer<typeof planDecompositionSchema>;
