import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  createReviewCommentSchema,
  type CompleteReviewResponse,
  type CreateReviewCommentInput,
  type GroupReviewDetailResponse,
  type ReviewCommentResponse,
  type ReviewCommentsResponse,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReviewsService } from './reviews.service.js';

@Controller('cycles/:id')
export class CycleReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  async createReview(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<GroupReviewDetailResponse> {
    return this.reviewsService.createReview(cycleId, user.userId);
  }

  @Get('review')
  async getReview(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<GroupReviewDetailResponse> {
    return this.reviewsService.getReviewByCycleId(cycleId, user.userId);
  }
}

@Controller('reviews/:id')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Post('comments')
  async addComment(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) reviewId: string,
    @Body(new ZodValidationPipe(createReviewCommentSchema)) body: CreateReviewCommentInput
  ): Promise<ReviewCommentResponse> {
    return this.reviewsService.addComment(reviewId, user.userId, body);
  }

  @Get('comments')
  async getComments(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) reviewId: string,
    @Query('submissionGoalId') submissionGoalId?: string
  ): Promise<ReviewCommentsResponse> {
    return this.reviewsService.getComments(reviewId, user.userId, submissionGoalId);
  }

  @Post('complete')
  async completeReview(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) reviewId: string
  ): Promise<CompleteReviewResponse> {
    return this.reviewsService.completeReview(reviewId, user.userId);
  }
}
