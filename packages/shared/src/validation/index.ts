import { z } from 'zod';
import { CYCLE_STATUSES, GROUP_ROLES, SUBMISSION_STATUSES } from '../status.js';

export * from './me.js';

export const cycleStatusSchema = z.enum(CYCLE_STATUSES);
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export const groupRoleSchema = z.enum(GROUP_ROLES);

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().length(8),
});

export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
