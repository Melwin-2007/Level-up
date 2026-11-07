import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanVersionResponse, GeneratePlanInput, ApprovePlanInput } from '@mp/shared';
import { api, ApiError } from '@/services/api';

export function usePlan(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['plan', cycleId],
    queryFn: async (): Promise<PlanVersionResponse | null> => {
      if (!cycleId) return null;
      try {
        const res = await api.get<{ planVersion: PlanVersionResponse }>(`/cycles/${cycleId}/plan`);
        return res.planVersion;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: Boolean(cycleId),
  });
}

export function useGeneratePlanMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: GeneratePlanInput): Promise<PlanVersionResponse> => {
      if (!cycleId) throw new Error('cycleId is required');
      const res = await api.post<{ planVersion: PlanVersionResponse }>(
        `/cycles/${cycleId}/generate-plan`,
        input ?? {}
      );
      return res.planVersion;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['plan', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['plan', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
    },
  });
}

export function useApprovePlanMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApprovePlanInput): Promise<PlanVersionResponse> => {
      if (!cycleId) throw new Error('cycleId is required');
      const res = await api.post<{ planVersion: PlanVersionResponse }>(
        `/cycles/${cycleId}/approve-plan`,
        input
      );
      return res.planVersion;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['plan', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['plan', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}
