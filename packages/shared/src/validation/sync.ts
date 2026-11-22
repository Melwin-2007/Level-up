import { z } from 'zod';
import { TASK_ACTIONS } from '../status.js';
import type { TaskResponse } from './tasks.js';

export const syncActionTypeSchema = z.enum(TASK_ACTIONS);
export type SyncActionType = z.infer<typeof syncActionTypeSchema>;

export const syncActionPayloadSchema = z.object({
  durationMinutes: z.number().int().min(0).default(0),
  note: z.string().max(1000).optional().nullable(),
  postponedToDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in format YYYY-MM-DD')
    .optional()
    .nullable(),
});
export type SyncActionPayload = z.infer<typeof syncActionPayloadSchema>;

export const syncActionItemSchema = z.object({
  idempotencyKey: z.string().min(1),
  taskId: z.string().uuid(),
  action: syncActionTypeSchema,
  payload: syncActionPayloadSchema.default({ durationMinutes: 0 }),
  clientCreatedAt: z.string().datetime().optional(),
});
export type SyncActionItem = z.infer<typeof syncActionItemSchema>;

export const syncPushRequestSchema = z.object({
  clientTimestamp: z.string().datetime().optional(),
  actions: z.array(syncActionItemSchema).max(100),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPushResultItemSchema = z.object({
  idempotencyKey: z.string(),
  taskId: z.string().uuid(),
  status: z.enum(['success', 'error']),
  xpAwarded: z.number().int().min(0).default(0),
  error: z.string().optional(),
});
export type SyncPushResultItem = z.infer<typeof syncPushResultItemSchema>;

export const syncPushResponseSchema = z.object({
  syncedAt: z.string().datetime(),
  processed: z.number().int().min(0),
  results: z.array(syncPushResultItemSchema),
  updatedTasks: z.array(z.custom<TaskResponse>()),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncPullResponseSchema = z.object({
  syncedAt: z.string().datetime(),
  activeCycle: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      year: z.number().int().optional(),
      month: z.number().int().optional(),
      startDate: z.string(),
      endDate: z.string(),
    })
    .nullable()
    .optional(),
  tasks: z.array(z.custom<TaskResponse>()),
  xp: z
    .object({
      totalXp: z.number().int(),
      currentLevel: z.number().int(),
    })
    .optional(),
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
