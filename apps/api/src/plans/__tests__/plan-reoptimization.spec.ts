import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { PlansService } from '../plans.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CycleStateService } from '../../cycles/cycle-state.service';
import type { Clock } from '../../common/clock/clock';
import type { AiService } from '../../ai/ai.service';

interface MockPrisma {
  monthlyCycle: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  groupMember: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  planVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  planItem: {
    create: ReturnType<typeof vi.fn>;
  };
  task: {
    findMany: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  profile: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('Plan Reoptimization Endpoint (P51)', () => {
  let plansService: PlansService;
  let mockPrisma: MockPrisma;
  let mockCycleStateService: Partial<CycleStateService>;
  let mockClock: Clock;
  let mockAiService: Partial<AiService>;

  const fixedNow = new Date('2026-11-15T12:00:00.000Z'); // mid-month Nov 15
  const cycleId = 'cycle-uuid-1';
  const userId = 'user-uuid-1';
  const groupId = 'group-uuid-1';

  beforeEach(() => {
    mockClock = {
      now: vi.fn(() => fixedNow),
    };

    mockCycleStateService = {
      assertAllows: vi.fn(),
    };

    mockAiService = {
      generateStructured: vi.fn(),
    };

    mockPrisma = {
      monthlyCycle: {
        findUnique: vi.fn(),
      },
      groupMember: {
        findUnique: vi.fn(),
      },
      planVersion: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      planItem: {
        create: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
      },
      monthlySubmission: {
        findUnique: vi.fn(),
      },
      profile: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: MockPrisma) => unknown) => cb(mockPrisma)),
    };

    plansService = new PlansService(
      mockPrisma as unknown as PrismaService,
      mockCycleStateService as unknown as CycleStateService,
      mockAiService as unknown as AiService,
      mockClock
    );
  });

  it('rejects reoptimization when cycle is not in execution phase', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      year: 2026,
      month: 11,
      status: 'planning', // not execution
    });

    mockCycleStateService.assertAllows = vi.fn().mockImplementation(() => {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: "Operation 'plan.reoptimize' not allowed in phase 'planning'",
      });
    });

    await expect(
      plansService.reoptimizePlan(cycleId, userId, {
        reason: 'Slipped on daily schedule due to illness',
      })
    ).rejects.toThrow(ConflictException);

    expect(mockCycleStateService.assertAllows).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'planning' }),
      'plan.reoptimize'
    );
  });

  it('rejects reoptimization when user is not a member of the group', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      year: 2026,
      month: 11,
      status: 'execution',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    await expect(
      plansService.reoptimizePlan(cycleId, userId, {
        reason: 'Need to recover missed milestone tasks',
      })
    ).rejects.toThrow(HttpException);
  });

  it('rejects reoptimization when no approved plan exists', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      year: 2026,
      month: 11,
      status: 'execution',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId,
      userId,
      role: 'member',
    });

    mockPrisma.planVersion.findFirst.mockResolvedValue(null); // No approved plan

    await expect(
      plansService.reoptimizePlan(cycleId, userId, {
        reason: 'Adjusting my schedule for the rest of month',
      })
    ).rejects.toThrow(NotFoundException);
  });

  it('successfully computes remaining work, schedules candidates, and creates reoptimized plan version without mutating baseline or tasks', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      year: 2026,
      month: 11,
      status: 'execution',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId,
      userId,
      role: 'member',
    });

    const baselinePlan = {
      id: 'plan-v1-uuid',
      cycleId,
      userId,
      versionNumber: 1,
      versionType: 'initial',
      approvalStatus: 'approved',
      isBaseline: true,
      planSnapshot: {
        feasibility: { verdict: 'feasible', capacityRatio: 0.8 },
        milestones: [
          {
            goalId: 'goal-uuid-1',
            title: 'Core Milestone',
            targetWeek: 2,
            estimatedMinutes: 240,
          },
        ],
      },
      planItems: [
        {
          id: 'item-1',
          itemType: 'daily_task',
          title: 'Completed Task',
          plannedDate: new Date('2026-11-05T00:00:00Z'),
          estimatedMinutes: 60,
          orderIndex: 0,
        },
        {
          id: 'item-2',
          itemType: 'daily_task',
          title: 'Slipped Task',
          plannedDate: new Date('2026-11-10T00:00:00Z'),
          estimatedMinutes: 90,
          orderIndex: 1,
        },
        {
          id: 'item-3',
          itemType: 'daily_task',
          title: 'Future Task',
          plannedDate: new Date('2026-11-20T00:00:00Z'),
          estimatedMinutes: 120,
          orderIndex: 2,
        },
      ],
    };

    mockPrisma.planVersion.findFirst.mockResolvedValue(baselinePlan);

    // Existing tasks
    const existingTasks = [
      {
        id: 'task-1',
        cycleId,
        userId,
        goalId: 'goal-uuid-1',
        planItemId: 'item-1',
        title: 'Completed Task',
        status: 'completed',
        scheduledDate: new Date('2026-11-05T00:00:00Z'),
        estimatedMinutes: 60,
        actualMinutes: 60,
        completedAt: new Date('2026-11-05T15:00:00Z'),
      },
      {
        id: 'task-2',
        cycleId,
        userId,
        goalId: 'goal-uuid-1',
        planItemId: 'item-2',
        title: 'Slipped Task',
        status: 'pending', // slipped because scheduled Nov 10 < today Nov 15
        scheduledDate: new Date('2026-11-10T00:00:00Z'),
        estimatedMinutes: 90,
        actualMinutes: 0,
        completedAt: null,
      },
      {
        id: 'task-3',
        cycleId,
        userId,
        goalId: 'goal-uuid-1',
        planItemId: 'item-3',
        title: 'Future Task',
        status: 'pending', // scheduled Nov 20 >= today Nov 15
        scheduledDate: new Date('2026-11-20T00:00:00Z'),
        estimatedMinutes: 120,
        actualMinutes: 0,
        completedAt: null,
      },
    ];

    mockPrisma.task.findMany.mockResolvedValue(existingTasks);

    mockPrisma.monthlySubmission.findUnique.mockResolvedValue({
      cycleId,
      userId,
      availability: {
        weeklyHours: { monday: 4, tuesday: 4, wednesday: 4, thursday: 4, friday: 4 },
      },
    });

    mockPrisma.profile.findUnique.mockResolvedValue({
      id: userId,
      timezone: 'UTC',
    });

    const createdPlanVersionRecord = {
      id: 'plan-v2-uuid',
      cycleId,
      userId,
      versionNumber: 2,
      versionType: 'reoptimized',
      approvalStatus: 'pending',
      isBaseline: false,
      planSnapshot: {},
      approvedAt: null,
      createdAt: fixedNow,
      planItems: [
        {
          id: 'new-item-1',
          planVersionId: 'plan-v2-uuid',
          goalId: 'goal-uuid-1',
          itemType: 'milestone',
          title: 'Core Milestone',
          description: null,
          plannedDate: null,
          weekNumber: 2,
          estimatedMinutes: 240,
          orderIndex: 0,
          createdAt: fixedNow,
        },
        {
          id: 'new-item-2',
          planVersionId: 'plan-v2-uuid',
          goalId: 'goal-uuid-1',
          itemType: 'daily_task',
          title: 'Slipped Task',
          description: 'Scheduled: 09:00 - 10:30',
          plannedDate: new Date('2026-11-16T00:00:00Z'), // Rescheduled to date >= Nov 15
          weekNumber: 3,
          estimatedMinutes: 90,
          orderIndex: 1,
          createdAt: fixedNow,
        },
      ],
    };

    mockPrisma.planVersion.create.mockResolvedValue(createdPlanVersionRecord);
    mockPrisma.planVersion.findUniqueOrThrow.mockResolvedValue(createdPlanVersionRecord);

    const result = await plansService.reoptimizePlan(cycleId, userId, {
      reason: 'Slipped behind schedule due to illness, rescheduling remaining tasks',
    });

    expect(result.versionNumber).toBe(2);
    expect(result.versionType).toBe('reoptimized');
    expect(result.approvalStatus).toBe('pending');
    expect(result.isBaseline).toBe(false);

    // Verify planVersion creation data
    expect(mockPrisma.planVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cycleId,
        userId,
        versionNumber: 2,
        versionType: 'reoptimized',
        approvalStatus: 'pending',
        isBaseline: false,
        planSnapshot: expect.objectContaining({
          diff: expect.objectContaining({
            movedTasks: expect.arrayContaining([
              expect.objectContaining({
                taskId: 'task-2',
                fromDate: '2026-11-10',
              }),
            ]),
          }),
        }),
      }),
    });

    // Verify baseline was NOT modified
    expect(baselinePlan.isBaseline).toBe(true);
    expect(baselinePlan.versionNumber).toBe(1);

    // Verify tasks table was NOT mutated (sync happens only upon approval in P52)
    expect(mockPrisma.task.findMany).toHaveBeenCalledTimes(1);
  });
});
