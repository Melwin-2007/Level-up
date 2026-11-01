import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AvailabilityInput,
  ConstraintsInput,
  OthersSubmissionsResponse,
  OwnSubmissionResponse,
  PatchSubmissionInput,
  SubmissionInput,
  SubmissionStatus,
  SuccessCriteria,
} from '@mp/shared';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { CycleStateService } from '../cycles/cycle-state.service.js';
import { GroupsService } from '../groups/groups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    @Inject(CycleStateService) private readonly cycleStateService: CycleStateService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  private validateGoalDeadlines(
    goals: { deadline?: string }[],
    cycle: { year: number; month: number }
  ) {
    for (const g of goals) {
      if (g.deadline) {
        const [y, m] = g.deadline.split('-').map(Number);
        if (y !== cycle.year || m !== cycle.month) {
          throw new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: `Goal deadline (${g.deadline}) must be within the cycle month (${cycle.year}-${String(cycle.month).padStart(2, '0')})`,
          });
        }
      }
    }
  }

  async createSubmission(
    cycleId: string,
    userId: string,
    dto: SubmissionInput
  ): Promise<OwnSubmissionResponse> {
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
    this.cycleStateService.assertAllows(cycle, 'submission.write');

    this.validateGoalDeadlines(dto.goals, cycle);

    const existing = await this.prisma.monthlySubmission.findUnique({
      where: {
        cycleId_userId: {
          cycleId,
          userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'A submission already exists for this cycle. Use PATCH to update it.',
      });
    }

    const status: SubmissionStatus = dto.submit ? 'submitted' : 'draft';
    const submittedAt = dto.submit ? this.clock.now() : null;

    await this.prisma.$transaction(async (tx) => {
      const sub = await tx.monthlySubmission.create({
        data: {
          cycleId,
          userId,
          status,
          availability: dto.availability as unknown as Prisma.InputJsonValue,
          constraints: dto.constraints as unknown as Prisma.InputJsonValue,
          submittedAt,
        },
      });

      for (const [i, g] of dto.goals.entries()) {
        await tx.submissionGoal.create({
          data: {
            submissionId: sub.id,
            position: i,
            title: g.title,
            description: g.description,
            category: g.category,
            priority: g.priority,
            estimatedHours: g.estimatedHours,
            deadline: g.deadline ? new Date(`${g.deadline}T00:00:00.000Z`) : null,
            successCriteria: g.successCriteria as unknown as Prisma.InputJsonValue,
            dependencies: g.dependencies as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    return this.getOwnSubmission(cycleId, userId);
  }

  async getOwnSubmission(cycleId: string, userId: string): Promise<OwnSubmissionResponse> {
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

    const sub = await this.prisma.monthlySubmission.findUnique({
      where: {
        cycleId_userId: {
          cycleId,
          userId,
        },
      },
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!sub) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Submission not found for this cycle',
      });
    }

    return {
      id: sub.id,
      cycleId: sub.cycleId,
      userId: sub.userId,
      status: sub.status as SubmissionStatus,
      submittedAt: sub.submittedAt?.toISOString(),
      lockedAt: sub.lockedAt?.toISOString(),
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
      availability: sub.availability as unknown as AvailabilityInput,
      constraints: sub.constraints as unknown as ConstraintsInput,
      goals: sub.goals.map((g) => ({
        id: g.id,
        position: g.position,
        title: g.title,
        description: g.description ?? undefined,
        category: g.category ?? undefined,
        priority: g.priority,
        estimatedHours: g.estimatedHours ?? undefined,
        deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
        successCriteria: (g.successCriteria as SuccessCriteria | null) ?? undefined,
        dependencies: (g.dependencies as number[] | null) ?? [],
        createdAt: g.createdAt.toISOString(),
      })),
    };
  }

  async patchSubmission(
    cycleId: string,
    userId: string,
    dto: PatchSubmissionInput
  ): Promise<OwnSubmissionResponse> {
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
    this.cycleStateService.assertAllows(cycle, 'submission.write');

    const sub = await this.prisma.monthlySubmission.findUnique({
      where: {
        cycleId_userId: {
          cycleId,
          userId,
        },
      },
    });

    if (!sub) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Submission not found',
      });
    }

    if (sub.status === 'locked') {
      throw new ConflictException({
        code: 'SUBMISSION_LOCKED',
        message: 'This submission is locked and cannot be edited.',
      });
    }

    if (dto.goals) {
      this.validateGoalDeadlines(dto.goals, cycle);
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.MonthlySubmissionUpdateInput = {};

      if (dto.availability !== undefined) {
        updateData.availability = dto.availability as unknown as Prisma.InputJsonValue;
      }
      if (dto.constraints !== undefined) {
        updateData.constraints = dto.constraints as unknown as Prisma.InputJsonValue;
      }
      if (dto.submit === true && sub.status === 'draft') {
        updateData.status = 'submitted';
        updateData.submittedAt = this.clock.now();
      } else if (dto.submit === false && sub.status === 'submitted') {
        updateData.status = 'draft';
        updateData.submittedAt = null;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.monthlySubmission.update({
          where: { id: sub.id },
          data: updateData,
        });
      }

      if (dto.goals !== undefined) {
        await tx.submissionGoal.deleteMany({
          where: { submissionId: sub.id },
        });

        for (const [i, g] of dto.goals.entries()) {
          await tx.submissionGoal.create({
            data: {
              submissionId: sub.id,
              position: i,
              title: g.title,
              description: g.description,
              category: g.category,
              priority: g.priority,
              estimatedHours: g.estimatedHours,
              deadline: g.deadline ? new Date(`${g.deadline}T00:00:00.000Z`) : null,
              successCriteria: g.successCriteria as unknown as Prisma.InputJsonValue,
              dependencies: g.dependencies as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    });

    return this.getOwnSubmission(cycleId, userId);
  }

  async lockSubmission(cycleId: string, userId: string): Promise<OwnSubmissionResponse> {
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

    const sub = await this.prisma.monthlySubmission.findUnique({
      where: {
        cycleId_userId: {
          cycleId,
          userId,
        },
      },
    });

    if (!sub) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Submission not found',
      });
    }

    if (sub.status === 'locked') {
      throw new ConflictException({
        code: 'SUBMISSION_LOCKED',
        message: 'This submission is already locked.',
      });
    }

    if (sub.status !== 'submitted') {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'Only submitted submissions can be locked.',
      });
    }

    await this.prisma.monthlySubmission.update({
      where: { id: sub.id },
      data: {
        status: 'locked',
        lockedAt: this.clock.now(),
      },
    });

    return this.getOwnSubmission(cycleId, userId);
  }

  async getOthersSubmissions(cycleId: string, userId: string): Promise<OthersSubmissionsResponse> {
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
    this.cycleStateService.assertAllows(cycle, 'others.read');

    // Only submitted/locked submissions, excluding drafts
    const submissions = await this.prisma.monthlySubmission.findMany({
      where: {
        cycleId,
        status: { in: ['submitted', 'locked'] },
      },
      include: {
        user: true,
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      items: submissions.map((s) => ({
        id: s.id,
        userId: s.userId,
        displayName: s.user.displayName,
        status: s.status as SubmissionStatus,
        goals: s.goals.map((g) => ({
          id: g.id,
          position: g.position,
          title: g.title,
          description: g.description ?? undefined,
          category: g.category ?? undefined,
          priority: g.priority,
          estimatedHours: g.estimatedHours ?? undefined,
          deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
          successCriteria: (g.successCriteria as SuccessCriteria | null) ?? undefined,
          dependencies: (g.dependencies as number[] | null) ?? [],
        })),
      })),
    };
  }
}
