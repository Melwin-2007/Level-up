import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CycleOperation, CycleStatus } from '@mp/shared';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const STATE_MATRIX: Readonly<
  Record<CycleOperation, Readonly<Record<CycleStatus, boolean>>>
> = {
  'submission.write': {
    submission_open: true,
    group_review: false,
    planning: false,
    execution: false,
    completed: false,
    cancelled: false,
  },
  'others.read': {
    submission_open: false,
    group_review: true,
    planning: true,
    execution: true,
    completed: true,
    cancelled: false,
  },
  'review.create': {
    submission_open: false,
    group_review: true,
    planning: false,
    execution: false,
    completed: false,
    cancelled: false,
  },
  'comment.add': {
    submission_open: false,
    group_review: true,
    planning: false,
    execution: false,
    completed: false,
    cancelled: false,
  },
  'review.complete': {
    submission_open: false,
    group_review: true,
    planning: false,
    execution: false,
    completed: false,
    cancelled: false,
  },
  'plan.generate': {
    submission_open: false,
    group_review: false,
    planning: true,
    execution: false,
    completed: false,
    cancelled: false,
  },
  'plan.approve': {
    submission_open: false,
    group_review: false,
    planning: true,
    execution: true,
    completed: false,
    cancelled: false,
  },
  'plan.reoptimize': {
    submission_open: false,
    group_review: false,
    planning: false,
    execution: true,
    completed: false,
    cancelled: false,
  },
  advance: {
    submission_open: true,
    group_review: true,
    planning: true,
    execution: true,
    completed: false,
    cancelled: false,
  },
};

export interface CanAdvanceResult {
  ok: boolean;
  reason: string;
  nextStatus?: CycleStatus;
}

@Injectable()
export class CycleStateService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  assertAllows(cycle: { status: string }, operation: CycleOperation): void {
    const status = cycle.status as CycleStatus;
    const allowed = STATE_MATRIX[operation]?.[status] ?? false;

    if (!allowed) {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: `Operation '${operation}' is not allowed in cycle phase '${status}'.`,
        details: { phase: status, operation },
      });
    }
  }

  async canAdvance(cycleId: string): Promise<CanAdvanceResult> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
      include: {
        group: {
          include: {
            members: true,
          },
        },
        submissions: true,
        review: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    const currentStatus = cycle.status as CycleStatus;
    const now = this.clock.now();

    if (currentStatus === 'submission_open') {
      if (now >= cycle.submissionDeadline) {
        return {
          ok: true,
          reason: 'Submission deadline has passed.',
          nextStatus: 'group_review',
        };
      }

      const submittedUserIds = new Set(
        cycle.submissions
          .filter((s) => s.status === 'submitted' || s.status === 'locked')
          .map((s) => s.userId)
      );

      const allMembersSubmitted =
        cycle.group.members.length > 0 &&
        cycle.group.members.every((m) => submittedUserIds.has(m.userId));

      if (allMembersSubmitted) {
        return {
          ok: true,
          reason: 'All members have submitted their plans.',
          nextStatus: 'group_review',
        };
      }

      return {
        ok: false,
        reason: 'Submission deadline has not passed and not all members have submitted.',
        nextStatus: 'group_review',
      };
    }

    if (currentStatus === 'group_review') {
      if (cycle.review?.completedAt != null) {
        return {
          ok: true,
          reason: 'Group review has been completed.',
          nextStatus: 'planning',
        };
      }

      if (now >= cycle.reviewDeadline) {
        return {
          ok: true,
          reason: 'Review deadline has passed.',
          nextStatus: 'planning',
        };
      }

      return {
        ok: false,
        reason: 'Review deadline has not passed and review is not completed.',
        nextStatus: 'planning',
      };
    }

    return {
      ok: false,
      reason: 'Transitions beyond group_review are not available in Milestone 1.',
    };
  }
}
