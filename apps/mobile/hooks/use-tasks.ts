import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskResponse, TaskStatus, LogTaskActionInput, TaskLogResponse } from '@mp/shared';
import { api } from '@/services/api';

export interface UseTasksParams {
  date?: string;
  cycleId?: string;
  status?: TaskStatus;
}

export function useTasks(params: UseTasksParams = {}) {
  const queryParams = new URLSearchParams();
  if (params.date) queryParams.set('date', params.date);
  if (params.cycleId) queryParams.set('cycleId', params.cycleId);
  if (params.status) queryParams.set('status', params.status);
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';

  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async (): Promise<TaskResponse[]> => {
      const res = await api.get<{ tasks: TaskResponse[] }>(endpoint);
      return res.tasks;
    },
  });
}

export function useTaskDetail(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async (): Promise<TaskResponse | null> => {
      if (!taskId) return null;
      const res = await api.get<{ task: TaskResponse }>(`/tasks/${taskId}`);
      return res.task;
    },
    enabled: Boolean(taskId),
  });
}

export function useLogTaskActionMutation(taskId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: LogTaskActionInput
    ): Promise<{ task: TaskResponse; log: TaskLogResponse }> => {
      if (!taskId) throw new Error('taskId is required');
      const idempotencyKey = `${taskId}-${input.action}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return api.post<{ task: TaskResponse; log: TaskLogResponse }>(`/tasks/${taskId}/log`, input, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (taskId) {
        void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      }
    },
  });
}
