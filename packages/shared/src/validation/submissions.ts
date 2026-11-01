import { z } from 'zod';
import type { SubmissionStatus } from '../status.js';

export const successCriteriaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('checklist'),
    items: z.array(z.string().min(1)).min(1, 'Checklist must have at least one item'),
  }),
  z.object({
    type: z.literal('metric'),
    target: z.number(),
    unit: z.string().min(1),
  }),
  z.object({
    type: z.literal('binary'),
  }),
]);

export type SuccessCriteria = z.infer<typeof successCriteriaSchema>;

export const goalInputSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(120, 'Title cannot exceed 120 characters'),
  description: z.string().trim().max(2000, 'Description cannot exceed 2000 characters').optional(),
  category: z.string().trim().max(40, 'Category cannot exceed 40 characters').optional(),
  priority: z
    .number()
    .int()
    .min(1, 'Priority must be between 1 and 5')
    .max(5, 'Priority must be between 1 and 5')
    .default(1),
  estimatedHours: z
    .number()
    .min(0.25, 'Estimated hours must be at least 0.25')
    .max(400, 'Estimated hours cannot exceed 400')
    .multipleOf(0.01, 'Estimated hours can have at most 2 decimal places')
    .optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be formatted as YYYY-MM-DD')
    .optional(),
  successCriteria: successCriteriaSchema.optional(),
  dependencies: z.array(z.number().int().min(0)).default([]),
});

export type GoalInput = z.infer<typeof goalInputSchema>;

export const weekdayHoursSchema = z.object({
  monday: z.number().min(0).max(24).default(0),
  tuesday: z.number().min(0).max(24).default(0),
  wednesday: z.number().min(0).max(24).default(0),
  thursday: z.number().min(0).max(24).default(0),
  friday: z.number().min(0).max(24).default(0),
  saturday: z.number().min(0).max(24).default(0),
  sunday: z.number().min(0).max(24).default(0),
});

export const datedExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0).max(24),
  reason: z.string().optional(),
});

export const availabilitySchema = z.object({
  weeklyHours: weekdayHoursSchema.optional(),
  exceptions: z.array(datedExceptionSchema).default([]),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const commitmentSchema = z.object({
  title: z.string().min(1),
  hoursPerWeek: z.number().min(0).max(168),
});

export const constraintsSchema = z.object({
  fixedCommitments: z.array(commitmentSchema).default([]),
  maxDailyHours: z.number().min(1).max(24).optional(),
});

export type ConstraintsInput = z.infer<typeof constraintsSchema>;

export const submissionInputSchema = z.object({
  goals: z
    .array(goalInputSchema)
    .min(1, 'At least 1 goal is required')
    .max(25, 'Cannot exceed 25 goals per submission'),
  availability: availabilitySchema.default({ exceptions: [] }),
  constraints: constraintsSchema.default({ fixedCommitments: [] }),
  submit: z.boolean().default(false),
});

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export const patchSubmissionInputSchema = z.object({
  goals: z
    .array(goalInputSchema)
    .min(1, 'At least 1 goal is required')
    .max(25, 'Cannot exceed 25 goals per submission')
    .optional(),
  availability: availabilitySchema.optional(),
  constraints: constraintsSchema.optional(),
  submit: z.boolean().optional(),
});

export type PatchSubmissionInput = z.infer<typeof patchSubmissionInputSchema>;

export interface SubmissionGoalResponse {
  id: string;
  position: number;
  title: string;
  description?: string;
  category?: string;
  priority: number;
  estimatedHours?: number;
  deadline?: string;
  successCriteria?: SuccessCriteria;
  dependencies: number[];
  createdAt: string;
}

export interface OwnSubmissionResponse {
  id: string;
  cycleId: string;
  userId: string;
  status: SubmissionStatus;
  goals: SubmissionGoalResponse[];
  availability: AvailabilityInput;
  constraints: ConstraintsInput;
  submittedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OthersSubmissionGoal {
  id: string;
  position: number;
  title: string;
  description?: string;
  category?: string;
  priority: number;
  estimatedHours?: number;
  deadline?: string;
  successCriteria?: SuccessCriteria;
  dependencies: number[];
}

export interface OthersSubmissionItem {
  id: string;
  userId: string;
  displayName: string;
  status: SubmissionStatus;
  goals: OthersSubmissionGoal[];
}

export interface OthersSubmissionsResponse {
  items: OthersSubmissionItem[];
}
