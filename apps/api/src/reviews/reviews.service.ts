import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CompleteReviewResponse,
  CreateReviewCommentInput,
  GroupReviewDetailResponse,
  ReviewCommentResponse,
  ReviewCommentsResponse,
} from '@mp/shared';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { CycleStateService } from '../cycles/cycle-state.service.js';
import { GroupsService } from '../groups/groups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    @Inject(CycleStateService) private readonly cycleStateService: CycleStateService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async createReview(cycleId: string, userId: string): Promise<GroupReviewDetailResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    await this.groupsService.requireAdmin(cycle.groupId, userId);
    this.cycleStateService.assertAllows(cycle, 'review.create');

    const existing = await this.prisma.groupReview.findUnique({
      where: { cycleId },
    });

    if (existing) {
      throw new ConflictException({
        code: 'REVIEW_EXISTS',
        message: 'A review already exists for this cycle.',
      });
    }

    const now = this.clock.now();
    await this.prisma.groupReview.create({
      data: {
        cycleId,
        startedAt: now,
      },
    });

    return this.getReviewByCycleId(cycleId, userId);
  }

  async getReviewByCycleId(cycleId: string, userId: string): Promise<GroupReviewDetailResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    await this.groupsService.requireMembership(cycle.groupId, userId);

    const review = await this.prisma.groupReview.findUnique({
      where: { cycleId },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Review not found for this cycle.',
      });
    }

    return {
      id: review.id,
      cycleId: review.cycleId,
      startedAt: review.startedAt.toISOString(),
      completedAt: review.completedAt?.toISOString(),
      createdAt: review.createdAt.toISOString(),
      commentCount: review._count.comments,
    };
  }

  async addComment(
    reviewId: string,
    userId: string,
    dto: CreateReviewCommentInput
  ): Promise<ReviewCommentResponse> {
    const review = await this.prisma.groupReview.findUnique({
      where: { id: reviewId },
      include: { cycle: true },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Review not found',
      });
    }

    await this.groupsService.requireMembership(review.cycle.groupId, userId);
    this.cycleStateService.assertAllows(review.cycle, 'comment.add');

    if (review.completedAt !== null) {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'Group review has already been completed. Comments are closed.',
      });
    }

    const goal = await this.prisma.submissionGoal.findUnique({
      where: { id: dto.submissionGoalId },
      include: {
        submission: true,
      },
    });

    if (!goal) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Goal not found',
      });
    }

    if (goal.submission.cycleId !== review.cycleId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Goal does not belong to this cycle',
      });
    }

    if (goal.submission.status !== 'submitted' && goal.submission.status !== 'locked') {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'Cannot comment on draft goals',
      });
    }

    const comment = await this.prisma.reviewComment.create({
      data: {
        reviewId,
        submissionGoalId: dto.submissionGoalId,
        authorId: userId,
        comment: dto.comment.trim(),
      },
      include: {
        author: true,
      },
    });

    return {
      id: comment.id,
      submissionGoalId: comment.submissionGoalId,
      authorId: comment.authorId,
      authorName: comment.author.displayName,
      comment: comment.comment,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async getComments(
    reviewId: string,
    userId: string,
    submissionGoalId?: string
  ): Promise<ReviewCommentsResponse> {
    const review = await this.prisma.groupReview.findUnique({
      where: { id: reviewId },
      include: { cycle: true },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Review not found',
      });
    }

    await this.groupsService.requireMembership(review.cycle.groupId, userId);

    const where: Prisma.ReviewCommentWhereInput = { reviewId };
    if (submissionGoalId) {
      where.submissionGoalId = submissionGoalId;
    }

    const comments = await this.prisma.reviewComment.findMany({
      where,
      include: {
        author: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      items: comments.map((c) => ({
        id: c.id,
        submissionGoalId: c.submissionGoalId,
        authorId: c.authorId,
        authorName: c.author.displayName,
        comment: c.comment,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async completeReview(reviewId: string, userId: string): Promise<CompleteReviewResponse> {
    const review = await this.prisma.groupReview.findUnique({
      where: { id: reviewId },
      include: { cycle: true },
    });

    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Review not found',
      });
    }

    await this.groupsService.requireAdmin(review.cycle.groupId, userId);
    this.cycleStateService.assertAllows(review.cycle, 'review.complete');

    if (review.completedAt !== null) {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'Review is already completed.',
      });
    }

    const now = this.clock.now();

    return this.prisma.$transaction(
      async (tx) => {
        await tx.groupReview.update({
          where: { id: reviewId },
          data: { completedAt: now },
        });

        const updateSubmissions = await tx.monthlySubmission.updateMany({
          where: {
            cycleId: review.cycleId,
            status: 'submitted',
          },
          data: {
            status: 'locked',
            lockedAt: now,
          },
        });

        const draftCount = await tx.monthlySubmission.count({
          where: {
            cycleId: review.cycleId,
            status: 'draft',
          },
        });

        return {
          id: review.id,
          cycleId: review.cycleId,
          completedAt: now.toISOString(),
          lockedCount: updateSubmissions.count,
          draftCount,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }
}
