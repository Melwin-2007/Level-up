import { useQuery } from '@tanstack/react-query';
import type { GamificationOverview } from '@mp/shared';
import { api, ApiError } from '@/services/api';

export function useGamification() {
  return useQuery({
    queryKey: ['me', 'gamification'],
    queryFn: async (): Promise<GamificationOverview | null> => {
      try {
        const res = await api.get<GamificationOverview>('/me/gamification');
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });
}
