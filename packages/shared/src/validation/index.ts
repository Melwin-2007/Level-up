import { z } from 'zod';
import { CYCLE_STATUSES, GROUP_ROLES, SUBMISSION_STATUSES } from '../status.js';

export * from './me.js';
export * from './groups.js';
export * from './cycles.js';
export * from './submissions.js';
export * from './reviews.js';
export * from './planner.js';
export * from './tasks.js';

export const cycleStatusSchema = z.enum(CYCLE_STATUSES);
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export const groupRoleSchema = z.enum(GROUP_ROLES);
