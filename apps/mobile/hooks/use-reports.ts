import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MonthlyReportResponse,
  GroupReportResponse,
  MemberSharingSettings,
  RegenerateReportInput,
} from '@mp/shared';
import { api, ApiError } from '@/services/api';

export function useIndividualReport(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['report-me', cycleId],
    queryFn: async (): Promise<MonthlyReportResponse | null> => {
      if (!cycleId) return null;
      try {
        const res = await api.get<{ report: MonthlyReportResponse }>(
          `/cycles/${cycleId}/reports/me`
        );
        return res.report;
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

export function useGroupReport(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['report-group', cycleId],
    queryFn: async (): Promise<GroupReportResponse | null> => {
      if (!cycleId) return null;
      try {
        const res = await api.get<{ report: GroupReportResponse }>(
          `/cycles/${cycleId}/reports/group`
        );
        return res.report;
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

export function useRegenerateReportMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegenerateReportInput): Promise<MonthlyReportResponse> => {
      if (!cycleId) throw new Error('cycleId is required');
      const res = await api.post<{ report: MonthlyReportResponse }>(
        `/cycles/${cycleId}/reports/me/regenerate`,
        input
      );
      return res.report;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['report-me', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['report-me', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['report-group', cycleId] });
    },
  });
}

export function useUpdateSharingMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<MemberSharingSettings>): Promise<MemberSharingSettings> => {
      if (!cycleId) throw new Error('cycleId is required');
      const res = await api.put<{ sharingSettings: MemberSharingSettings }>(
        `/cycles/${cycleId}/reports/sharing`,
        input
      );
      return res.sharingSettings;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['report-me', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['report-group', cycleId] });
    },
  });
}
