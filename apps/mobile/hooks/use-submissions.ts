import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OwnSubmissionResponse, OthersSubmissionsResponse, SubmissionInput } from '@mp/shared';
import { api, ApiError } from '@/services/api';

export function useOwnSubmission(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['submission', cycleId],
    queryFn: async (): Promise<OwnSubmissionResponse | null> => {
      if (!cycleId) return null;
      try {
        return await api.get<OwnSubmissionResponse>(`/cycles/${cycleId}/submission`);
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

export function useSaveSubmissionMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payload,
      isExisting,
    }: {
      payload: SubmissionInput;
      isExisting: boolean;
    }): Promise<OwnSubmissionResponse> => {
      if (!cycleId) throw new Error('cycleId is required');

      if (isExisting) {
        return api.patch<OwnSubmissionResponse>(`/cycles/${cycleId}/submission`, payload);
      }
      return api.post<OwnSubmissionResponse>(`/cycles/${cycleId}/submission`, payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['submission', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useLockSubmissionMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<OwnSubmissionResponse> => {
      if (!cycleId) throw new Error('cycleId is required');
      return api.post<OwnSubmissionResponse>(`/cycles/${cycleId}/lock-submission`);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['submission', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useOthersSubmissions(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['others-submissions', cycleId],
    queryFn: async (): Promise<OthersSubmissionsResponse> => {
      if (!cycleId) return { items: [] };
      return api.get<OthersSubmissionsResponse>(`/cycles/${cycleId}/submissions`);
    },
    enabled: Boolean(cycleId),
  });
}
