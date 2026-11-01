import { z } from 'zod';

export const createReviewCommentSchema = z.object({
  submissionGoalId: z.string().uuid('submissionGoalId must be a valid UUID'),
  comment: z
    .string({ required_error: 'Comment cannot be empty' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
});

export type CreateReviewCommentInput = z.infer<typeof createReviewCommentSchema>;

export interface ReviewCommentResponse {
  id: string;
  submissionGoalId: string;
  authorId: string;
  authorName: string;
  comment: string;
  createdAt: string;
}

export interface ReviewCommentsResponse {
  items: ReviewCommentResponse[];
}

export interface GroupReviewDetailResponse {
  id: string;
  cycleId: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  commentCount: number;
}

export interface CompleteReviewResponse {
  id: string;
  cycleId: string;
  completedAt: string;
  lockedCount: number;
  draftCount: number;
}
