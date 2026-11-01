import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GroupReviewDetailResponse,
  ReviewCommentsResponse,
  CompleteReviewResponse,
  ReviewCommentResponse,
} from '@mp/shared';
import { api, ApiError } from '@/services/api';

export function useGroupReview(
  cycleId: string | undefined,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: ['review', cycleId],
    queryFn: async (): Promise<GroupReviewDetailResponse | null> => {
      if (!cycleId) return null;
      try {
        return await api.get<GroupReviewDetailResponse>(`/cycles/${cycleId}/review`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: options?.enabled ?? Boolean(cycleId),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateReviewMutation(cycleId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<GroupReviewDetailResponse> => {
      if (!cycleId) throw new Error('cycleId is required');
      return api.post<GroupReviewDetailResponse>(`/cycles/${cycleId}/reviews`);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['review', cycleId], data);
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}

export function useReviewComments(
  reviewId: string | undefined,
  submissionGoalId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: ['review-comments', reviewId, submissionGoalId],
    queryFn: async (): Promise<ReviewCommentsResponse> => {
      if (!reviewId) return { items: [] };
      const queryParam = submissionGoalId
        ? `?submissionGoalId=${encodeURIComponent(submissionGoalId)}`
        : '';
      return api.get<ReviewCommentsResponse>(`/reviews/${reviewId}/comments${queryParam}`);
    },
    enabled: options?.enabled ?? Boolean(reviewId),
    refetchInterval: options?.refetchInterval,
  });
}

export function useAddCommentMutation(reviewId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionGoalId,
      comment,
    }: {
      submissionGoalId: string;
      comment: string;
    }): Promise<ReviewCommentResponse> => {
      if (!reviewId) throw new Error('reviewId is required');
      return api.post<ReviewCommentResponse>(`/reviews/${reviewId}/comments`, {
        submissionGoalId,
        comment,
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['review-comments', reviewId, variables.submissionGoalId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['review-comments', reviewId],
      });
    },
  });
}

export function useCompleteReviewMutation(
  reviewId: string | undefined,
  cycleId: string | undefined
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<CompleteReviewResponse> => {
      if (!reviewId) throw new Error('reviewId is required');
      return api.post<CompleteReviewResponse>(`/reviews/${reviewId}/complete`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycle', cycleId] });
      void queryClient.invalidateQueries({ queryKey: ['cycles'] });
    },
  });
}
