import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdvanceCycleInput,
  CreateCycleInput,
  CycleDetailResponse,
  CycleStatus,
} from '@mp/shared';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { GroupsService } from '../groups/groups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CycleStateService } from './cycle-state.service.js';
import { SUBMISSIONS_STATUS_PORT, type SubmissionsStatusPort } from './submissions-status.port.js';

@Injectable()
export class CyclesService {
  private readonly logger = new Logger(CyclesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    @Inject(CycleStateService) private readonly cycleStateService: CycleStateService,
    @Inject(SUBMISSIONS_STATUS_PORT)
    private readonly submissionsStatusPort: SubmissionsStatusPort,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async createCycle(
    groupId: string,
    userId: string,
    dto: CreateCycleInput
  ): Promise<CycleDetailResponse> {
    // 1. Require admin or owner role in the group
    await this.groupsService.requireAdmin(groupId, userId);

    const now = this.clock.now();
    const currentYear = now.getFullYear();

    // 2. Validate year (-1 to +1 relative to clock)
    if (dto.year < currentYear - 1 || dto.year > currentYear + 1) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Cycle year must be between ${currentYear - 1} and ${currentYear + 1}`,
      });
    }

    // 3. Validate month (1 to 12)
    if (dto.month < 1 || dto.month > 12) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Cycle month must be between 1 and 12',
      });
    }

    // 4. Validate deadlines
    const subDeadline = new Date(dto.submissionDeadline);
    const revDeadline = new Date(dto.reviewDeadline);

    if (Number.isNaN(subDeadline.getTime()) || Number.isNaN(revDeadline.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Deadlines must be valid ISO date strings',
      });
    }

    if (subDeadline <= now || revDeadline <= now) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Deadlines must be in the future',
      });
    }

    if (subDeadline >= revDeadline) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'submissionDeadline must be earlier than reviewDeadline',
      });
    }

    // 5. Check duplicate (groupId, year, month)
    const existing = await this.prisma.monthlyCycle.findUnique({
      where: {
        groupId_year_month: {
          groupId,
          year: dto.year,
          month: dto.month,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'CYCLE_EXISTS',
        message: 'A cycle for this month already exists in this group',
      });
    }

    const cycle = await this.prisma.monthlyCycle.create({
      data: {
        groupId,
        year: dto.year,
        month: dto.month,
        submissionDeadline: subDeadline,
        reviewDeadline: revDeadline,
        status: 'submission_open',
      },
    });

    return this.getCycleById(cycle.id, userId);
  }

  async getCycleById(cycleId: string, userId: string): Promise<CycleDetailResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    // DECISION 20: Non-members always receive 404, not 403
    const isMember = cycle.group.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    const memberUserIds = cycle.group.members.map((m) => m.userId);
    const statuses = await this.submissionsStatusPort.getMemberSubmissionStatuses(
      cycle.id,
      memberUserIds
    );

    return {
      id: cycle.id,
      groupId: cycle.groupId,
      year: cycle.year,
      month: cycle.month,
      status: cycle.status as CycleStatus,
      submissionDeadline: cycle.submissionDeadline.toISOString(),
      reviewDeadline: cycle.reviewDeadline.toISOString(),
      createdAt: cycle.createdAt.toISOString(),
      members: cycle.group.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        submissionStatus: statuses.get(m.userId) ?? 'none',
      })),
    };
  }

  async getCurrentCycle(groupId: string, userId: string): Promise<CycleDetailResponse> {
    // Check group membership
    await this.groupsService.requireMembership(groupId, userId);

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    const timezone = profile?.timezone ?? 'Asia/Kolkata';

    const now = this.clock.now();
    let currentYear: number;
    let currentMonth: number;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
      });
      const parts = formatter.formatToParts(now);
      currentYear = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
      currentMonth = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
    } catch {
      currentYear = now.getUTCFullYear();
      currentMonth = now.getUTCMonth() + 1;
    }

    // 1. Look for matching cycle in this month
    const matchingCycle = await this.prisma.monthlyCycle.findUnique({
      where: {
        groupId_year_month: {
          groupId,
          year: currentYear,
          month: currentMonth,
        },
      },
    });

    if (matchingCycle) {
      return this.getCycleById(matchingCycle.id, userId);
    }

    // 2. Fall back to most recent cycle for that group
    const latestCycle = await this.prisma.monthlyCycle.findFirst({
      where: { groupId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    if (latestCycle) {
      return this.getCycleById(latestCycle.id, userId);
    }

    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'No cycle found for this group',
    });
  }

  async advanceCycle(
    cycleId: string,
    userId: string,
    dto?: AdvanceCycleInput
  ): Promise<CycleDetailResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      });
    }

    const member = await this.groupsService.requireMembership(cycle.groupId, userId);
    const isOwner = member.role === 'owner';
    const isAdmin = member.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Admin or owner role required to advance cycle',
      });
    }

    // Assert that current status allows advance
    this.cycleStateService.assertAllows(cycle, 'advance');

    let nextStatus: CycleStatus;
    if (cycle.status === 'submission_open') {
      nextStatus = 'group_review';
    } else if (cycle.status === 'group_review') {
      nextStatus = 'planning';
    } else {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: 'Transitions beyond group_review are not available in Milestone 1.',
        details: { phase: cycle.status },
      });
    }

    if (dto?.force) {
      if (!isOwner) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_ROLE',
          message: 'Only the group owner can force advance a cycle',
        });
      }
      this.logger.log({
        action: 'FORCED_CYCLE_ADVANCE',
        userId,
        cycleId: cycle.id,
        fromStatus: cycle.status,
        toStatus: nextStatus,
      });
    } else {
      const result = await this.cycleStateService.canAdvance(cycleId);
      if (!result.ok) {
        throw new ConflictException({
          code: 'CYCLE_STATE_INVALID',
          message: result.reason,
          details: { phase: cycle.status },
        });
      }
    }

    const updated = await this.prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: { status: nextStatus },
    });

    return this.getCycleById(updated.id, userId);
  }
}
