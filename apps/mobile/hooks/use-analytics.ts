import { useQuery } from '@tanstack/react-query';
import type { MonthOverMonthResponse } from '@mp/shared';
import { api } from '@/services/api';

export function useAnalytics() {
  return useQuery<MonthOverMonthResponse>({
    queryKey: ['analytics', 'trends'],
    queryFn: async () => {
      return api.get<MonthOverMonthResponse>('/me/analytics/trends');
    },
    staleTime: 5 * 60 * 1000,
  });
}
