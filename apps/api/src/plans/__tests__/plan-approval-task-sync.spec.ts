import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
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
  planItem: {
    create: ReturnType<typeof vi.fn>;
  };
  task: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('Reoptimized Plan Approval & Task Sync (P52)', () => {
  let plansService: PlansService;
  let mockPrisma: MockPrisma;
  let mockCycleStateService: Partial<CycleStateService>;
  let mockClock: Clock;
  let mockAiService: Partial<AiService>;

  const fixedNow = new Date('2026-11-15T12:00:00.000Z');
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
      planItem: {
        create: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
      },
      monthlySubmission: {
        findMany: vi.fn(),
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

  it('approves a reoptimized plan in execution, keeping isBaseline: false and syncing future tasks', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      status: 'execution',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId,
      userId,
      role: 'member',
    });

    const reoptimizedVersion = {
      id: 'plan-v2-uuid',
      cycleId,
      userId,
      versionNumber: 2,
      versionType: 'reoptimized',
      approvalStatus: 'pending',
      isBaseline: false,
      planSnapshot: {},
      createdAt: new Date('2026-11-15T10:00:00Z'),
    };

    // findUnique before transaction and inside transaction
    mockPrisma.planVersion.findUnique.mockResolvedValue(reoptimizedVersion);

    const reoptimizedWithItems = {
      ...reoptimizedVersion,
      approvalStatus: 'approved',
      approvedAt: fixedNow,
      isBaseline: false,
      planItems: [
        {
          id: 'new-item-1',
          planVersionId: 'plan-v2-uuid',
          goalId: 'goal-1',
          itemType: 'daily_task',
          title: 'Rescheduled Task',
          plannedDate: new Date('2026-11-17T00:00:00Z'),
          estimatedMinutes: 90,
          orderIndex: 0,
          createdAt: fixedNow,
        },
        {
          id: 'new-item-2',
          planVersionId: 'plan-v2-uuid',
          goalId: 'goal-1',
          itemType: 'daily_task',
          title: 'Brand New Task',
          plannedDate: new Date('2026-11-18T00:00:00Z'),
          estimatedMinutes: 60,
          orderIndex: 1,
          createdAt: fixedNow,
        },
      ],
    };

    mockPrisma.planVersion.update.mockResolvedValue(reoptimizedWithItems);

    // Existing tasks in database:
    // - Task A: Completed (Nov 5) -> MUST NOT BE TOUCHED
    // - Task B: Pending (was Nov 10, now rescheduled in plan to Nov 17) -> MUST BE RESCHEDULED
    // - Task C: Pending (was Nov 20, dropped from plan) -> MUST BE CANCELLED
    const existingTasks = [
      {
        id: 'task-a',
        cycleId,
        userId,
        goalId: 'goal-1',
        title: 'Completed Early Task',
        status: 'completed',
        scheduledDate: new Date('2026-11-05T00:00:00Z'),
        estimatedMinutes: 60,
        actualMinutes: 70,
        completedAt: new Date('2026-11-05T16:00:00Z'),
      },
      {
        id: 'task-b',
        cycleId,
        userId,
        goalId: 'goal-1',
        title: 'Rescheduled Task',
        status: 'pending',
        scheduledDate: new Date('2026-11-10T00:00:00Z'),
        estimatedMinutes: 90,
      },
      {
        id: 'task-c',
        cycleId,
        userId,
        goalId: 'goal-1',
        title: 'Dropped Task',
        status: 'pending',
        scheduledDate: new Date('2026-11-20T00:00:00Z'),
        estimatedMinutes: 45,
      },
    ];

    mockPrisma.task.findMany.mockResolvedValue(existingTasks);

    const result = await plansService.approvePlan(cycleId, userId, {
      planVersionId: 'plan-v2-uuid',
    });

    expect(result.approvalStatus).toBe('approved');
    expect(result.isBaseline).toBe(false);

    // 1. Verify planVersion updated with isBaseline: false
    expect(mockPrisma.planVersion.update).toHaveBeenCalledWith({
      where: { id: 'plan-v2-uuid' },
      data: {
        approvalStatus: 'approved',
        approvedAt: fixedNow,
        isBaseline: false,
      },
      include: expect.anything(),
    });

    // 2. Task B (Rescheduled Task) updated with new date
    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-b' },
      data: expect.objectContaining({
        scheduledDate: new Date('2026-11-17T00:00:00Z'),
        planItemId: 'new-item-1',
      }),
    });

    // 3. Task C (Dropped Task) marked cancelled
    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-c' },
      data: {
        status: 'cancelled',
      },
    });

    // 4. Task A (Completed Task) was NEVER passed to task.update
    const taskUpdateCalls = mockPrisma.task.update.mock.calls;
    const taskIdsUpdated = taskUpdateCalls.map(
      (call: unknown[]) => (call[0] as { where: { id: string } }).where.id
    );
    expect(taskIdsUpdated).not.toContain('task-a');

    // 5. Newly added daily task created
    expect(mockPrisma.task.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          cycleId,
          userId,
          goalId: 'goal-1',
          planItemId: 'new-item-2',
          title: 'Brand New Task',
          status: 'pending',
          scheduledDate: new Date('2026-11-18T00:00:00Z'),
          estimatedMinutes: 60,
        }),
      ],
    });
  });

  it('rejects approving a plan that is already approved', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValue({
      id: cycleId,
      groupId,
      status: 'execution',
    });

    mockPrisma.groupMember.findUnique.mockResolvedValue({
      groupId,
      userId,
      role: 'member',
    });

    mockPrisma.planVersion.findUnique.mockResolvedValue({
      id: 'plan-v2-uuid',
      cycleId,
      userId,
      approvalStatus: 'approved', // Already approved
    });

    await expect(
      plansService.approvePlan(cycleId, userId, { planVersionId: 'plan-v2-uuid' })
    ).rejects.toThrow(ConflictException);
  });
});
