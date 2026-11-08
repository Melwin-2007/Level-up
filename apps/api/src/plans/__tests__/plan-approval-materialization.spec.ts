import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlansService } from '../plans.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CycleStateService } from '../../cycles/cycle-state.service';
import type { Clock } from '../../common/clock/clock';
import type { AiService } from '../../ai/ai.service';

interface MockPrisma {
  monthlyCycle: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  groupMember: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  planVersion: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  task: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('Plan Approval & Task Materialization (P41)', () => {
  let plansService: PlansService;
  let mockPrisma: MockPrisma;
  let mockCycleStateService: Partial<CycleStateService>;
  let mockClock: Clock;
  let mockAiService: Partial<AiService>;

  const fixedNow = new Date('2026-11-05T12:00:00.000Z');

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
        update: vi.fn(),
      },
      groupMember: {
        findUnique: vi.fn(),
      },
      planVersion: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      monthlySubmission: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    plansService = new PlansService(
      mockPrisma as unknown as PrismaService,
      mockCycleStateService as unknown as CycleStateService,
      mockAiService as unknown as AiService,
      mockClock
    );
  });

  it('should materialize tasks from daily_task plan items when approving baseline plan', async () => {
    const cycleId = 'cycle-uuid-1';
    const userId = 'user-uuid-1';
    const planVersionId = 'plan-uuid-1';
    const goalId = 'goal-uuid-1';
    const dailyItemId = 'item-daily-1';
    const milestoneItemId = 'item-milestone-1';

    const plannedDate = new Date('2026-11-06T00:00:00.000Z');

    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId: 'group-uuid-1',
      status: 'planning',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId: 'group-uuid-1',
      userId,
    });

    const pendingPlanVersion = {
      id: planVersionId,
      cycleId,
      userId,
      approvalStatus: 'pending',
      versionNumber: 1,
      versionType: 'initial',
      isBaseline: false,
      planSnapshot: {},
      createdAt: fixedNow,
      planItems: [
        {
          id: milestoneItemId,
          planVersionId,
          goalId,
          itemType: 'milestone',
          title: 'Week 1 Milestone',
          description: null,
          plannedDate: null,
          estimatedMinutes: 600,
          orderIndex: 0,
          createdAt: fixedNow,
        },
        {
          id: dailyItemId,
          planVersionId,
          goalId,
          itemType: 'daily_task',
          title: 'Implement feature X',
          description: 'Detailed instructions',
          plannedDate,
          estimatedMinutes: 90,
          orderIndex: 1,
          createdAt: fixedNow,
        },
      ],
    };

    mockPrisma.planVersion.findUnique.mockResolvedValue(pendingPlanVersion);
    mockPrisma.planVersion.findFirst.mockResolvedValue(null); // No existing baseline

    mockPrisma.planVersion.update.mockResolvedValue({
      ...pendingPlanVersion,
      approvalStatus: 'approved',
      approvedAt: fixedNow,
      isBaseline: true,
    });

    mockPrisma.task.findMany.mockResolvedValue([]); // No existing tasks
    mockPrisma.monthlySubmission.findMany.mockResolvedValue([{ userId }]);
    mockPrisma.planVersion.count.mockResolvedValue(1);

    const result = await plansService.approvePlan(cycleId, userId, { planVersionId });

    expect(result.approvalStatus).toBe('approved');
    expect(result.isBaseline).toBe(true);

    // Verify task materialization
    expect(mockPrisma.task.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.task.createMany).toHaveBeenCalledWith({
      data: [
        {
          cycleId,
          userId,
          goalId,
          planItemId: dailyItemId,
          title: 'Implement feature X',
          description: 'Detailed instructions',
          status: 'pending',
          scheduledDate: plannedDate,
          estimatedMinutes: 90,
        },
      ],
    });
  });

  it('should not recreate tasks if they were already materialized (idempotent)', async () => {
    const cycleId = 'cycle-uuid-1';
    const userId = 'user-uuid-1';
    const planVersionId = 'plan-uuid-1';
    const dailyItemId = 'item-daily-1';

    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId: 'group-uuid-1',
      status: 'planning',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId: 'group-uuid-1',
      userId,
    });

    const pendingPlanVersion = {
      id: planVersionId,
      cycleId,
      userId,
      approvalStatus: 'pending',
      versionNumber: 1,
      versionType: 'initial',
      isBaseline: false,
      planSnapshot: {},
      createdAt: fixedNow,
      planItems: [
        {
          id: dailyItemId,
          planVersionId,
          goalId: null,
          itemType: 'daily_task',
          title: 'Task 1',
          description: null,
          plannedDate: null,
          estimatedMinutes: 60,
          orderIndex: 0,
          createdAt: fixedNow,
        },
      ],
    };

    mockPrisma.planVersion.findUnique.mockResolvedValue(pendingPlanVersion);
    mockPrisma.planVersion.findFirst.mockResolvedValue(null);
    mockPrisma.planVersion.update.mockResolvedValue({
      ...pendingPlanVersion,
      approvalStatus: 'approved',
      approvedAt: fixedNow,
      isBaseline: true,
    });

    // Already exists in tasks table
    mockPrisma.task.findMany.mockResolvedValue([{ planItemId: dailyItemId }]);
    mockPrisma.monthlySubmission.findMany.mockResolvedValue([{ userId }]);
    mockPrisma.planVersion.count.mockResolvedValue(1);

    await plansService.approvePlan(cycleId, userId, { planVersionId });

    expect(mockPrisma.task.createMany).not.toHaveBeenCalled();
  });
});
