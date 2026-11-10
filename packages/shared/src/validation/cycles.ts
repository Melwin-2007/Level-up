import { z } from 'zod';
import { type CycleStatus } from '../status.js';

export const CYCLE_OPERATIONS = [
  'submission.write',
  'others.read',
  'review.create',
  'comment.add',
  'review.complete',
  'plan.generate',
  'plan.approve',
  'plan.reoptimize',
  'advance',
] as const;

export type CycleOperation = (typeof CYCLE_OPERATIONS)[number];

export const createCycleSchema = z.object({
  year: z.number().int(),
  month: z
    .number()
    .int()
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12'),
  submissionDeadline: z
    .string()
    .datetime({ message: 'submissionDeadline must be a valid ISO 8601 string' }),
  reviewDeadline: z
    .string()
    .datetime({ message: 'reviewDeadline must be a valid ISO 8601 string' }),
});

export type CreateCycleInput = z.infer<typeof createCycleSchema>;

export const advanceCycleSchema = z.object({
  force: z.boolean().optional(),
});

export type AdvanceCycleInput = z.infer<typeof advanceCycleSchema>;

export type MemberSubmissionStatus = 'none' | 'draft' | 'submitted' | 'locked';

export interface CycleMemberStatus {
  userId: string;
  displayName: string;
  submissionStatus: MemberSubmissionStatus;
}

export interface CycleDetailResponse {
  id: string;
  groupId: string;
  year: number;
  month: number;
  status: CycleStatus;
  submissionDeadline: string;
  reviewDeadline: string;
  createdAt: string;
  members: CycleMemberStatus[];
}
