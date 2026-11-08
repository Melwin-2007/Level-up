import { z } from 'zod';
import { TASK_STATUSES, TASK_ACTIONS } from '../status.js';

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskActionSchema = z.enum(TASK_ACTIONS);

export const logTaskActionSchema = z
  .object({
    action: taskActionSchema,
    durationMinutes: z.number().int().min(0).default(0),
    note: z.string().max(1000).optional().nullable(),
    postponedToDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in format YYYY-MM-DD')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.action === 'postpone' && !data.postponedToDate) {
        return false;
      }
      return true;
    },
    {
      message: 'postponedToDate is required when action is postpone',
      path: ['postponedToDate'],
    }
  );

export type LogTaskActionInput = z.infer<typeof logTaskActionSchema>;

export const queryTasksSchema = z.object({
  cycleId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in format YYYY-MM-DD')
    .optional(),
  status: taskStatusSchema.optional(),
});

export type QueryTasksInput = z.infer<typeof queryTasksSchema>;

export interface TaskLogResponse {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  durationMinutes: number;
  note: string | null;
  loggedAt: string;
}

export interface TaskResponse {
  id: string;
  cycleId: string;
  userId: string;
  goalId: string | null;
  planItemId: string | null;
  title: string;
  description: string | null;
  status: string;
  scheduledDate: string | null;
  estimatedMinutes: number;
  actualMinutes: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: TaskLogResponse[];
}
