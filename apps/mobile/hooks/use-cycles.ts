import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdvanceCycleInput, CreateCycleInput, CycleDetailResponse } from '@mp/shared';
import { api } from '@/services/api';

export function useCurrentCycle(groupId: string | undefined) {
  return useQuery<CycleDetailResponse | null>({
    queryKey: ['cycles', 'current', groupId],
    queryFn: async () => {
      try {
        return await api.get<CycleDetailResponse>(`/cycles/current?groupId=${groupId}`);
      } catch {
        // If 404, no active cycle exists
        return null;
      }
    },
    enabled: Boolean(groupId),
  });
}

export function useCycle(id: string | undefined) {
  return useQuery<CycleDetailResponse>({
    queryKey: ['cycles', id],
    queryFn: () => api.get<CycleDetailResponse>(`/cycles/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCycle(groupId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCycleInput) =>
      api.post<CycleDetailResponse>(`/groups/${groupId}/cycles`, data),
    onSuccess: (newCycle) => {
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.setQueryData(['cycles', newCycle.id], newCycle);
      queryClient.setQueryData(['cycles', 'current', groupId], newCycle);
    },
  });
}

export function useAdvanceCycle(cycleId: string | undefined, groupId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdvanceCycleInput = {}) =>
      api.post<CycleDetailResponse>(`/cycles/${cycleId}/advance`, data),
    onSuccess: (updatedCycle) => {
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.setQueryData(['cycles', updatedCycle.id], updatedCycle);
      if (groupId) {
        queryClient.setQueryData(['cycles', 'current', groupId], updatedCycle);
      }
    },
  });
}
