import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from '../sync.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TasksService } from '../../tasks/tasks.service';
import type { XpService } from '../../xp/xp.service';
import type { Clock } from '../../common/clock/clock';
import type { SyncPushRequest, TaskResponse } from '@mp/shared';

describe('SyncService (P81)', () => {
  let syncService: SyncService;
  let mockPrisma: {
    groupMember: { findMany: ReturnType<typeof vi.fn> };
    monthlyCycle: { findFirst: ReturnType<typeof vi.fn> };
    task: { findMany: ReturnType<typeof vi.fn> };
  };
  let mockTasksService: { logTaskAction: ReturnType<typeof vi.fn> };
  let mockXpService: { getUserXpSummary: ReturnType<typeof vi.fn> };
  let clock: Clock;

  const mockDate = new Date('2026-11-21T12:00:00.000Z');
  const userId = 'user-uuid-1';
  const taskId1 = '11111111-1111-1111-1111-111111111111';
  const taskId2 = '22222222-2222-2222-2222-222222222222';

  const baseTask1: TaskResponse = {
    id: taskId1,
    cycleId: 'cycle-uuid-1',
    userId,
    goalId: 'goal-uuid-1',
    planItemId: 'item-uuid-1',
    title: 'Offline task 1',
    description: 'First test task',
    status: 'completed',
    scheduledDate: '2026-11-21',
    estimatedMinutes: 60,
    actualMinutes: 60,
    completedAt: mockDate.toISOString(),
    createdAt: mockDate.toISOString(),
    updatedAt: mockDate.toISOString(),
  };

  const baseTask2: TaskResponse = {
    id: taskId2,
    cycleId: 'cycle-uuid-1',
    userId,
    goalId: 'goal-uuid-1',
    planItemId: 'item-uuid-2',
    title: 'Offline task 2',
    description: 'Second test task',
    status: 'postponed',
    scheduledDate: '2026-11-22',
    estimatedMinutes: 30,
    actualMinutes: 0,
    completedAt: null,
    createdAt: mockDate.toISOString(),
    updatedAt: mockDate.toISOString(),
  };

  beforeEach(() => {
    clock = { now: () => mockDate };

    mockPrisma = {
      groupMember: {
        findMany: vi.fn().mockResolvedValue([{ groupId: 'group-uuid-1' }]),
      },
      monthlyCycle: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cycle-uuid-1',
          status: 'execution',
          year: 2026,
          month: 11,
        }),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: taskId1,
            cycleId: 'cycle-uuid-1',
            userId,
            goalId: 'goal-uuid-1',
            planItemId: 'item-uuid-1',
            title: 'Offline task 1',
            description: 'First test task',
            status: 'completed',
            scheduledDate: new Date('2026-11-21'),
            estimatedMinutes: 60,
            actualMinutes: 60,
            completedAt: mockDate,
            createdAt: mockDate,
            updatedAt: mockDate,
          },
        ]),
      },
    };

    mockTasksService = {
      logTaskAction: vi.fn().mockImplementation((uId, tId, input, _idempKey) => {
        if (tId === taskId1) {
          return Promise.resolve({
            task: baseTask1,
            log: {
              id: 'log-1',
              taskId: taskId1,
              userId: uId,
              action: input.action,
              durationMinutes: input.durationMinutes,
              note: input.note,
              loggedAt: mockDate.toISOString(),
            },
          });
        }
        if (tId === taskId2) {
          return Promise.resolve({
            task: baseTask2,
            log: {
              id: 'log-2',
              taskId: taskId2,
              userId: uId,
              action: input.action,
              durationMinutes: input.durationMinutes,
              note: input.note,
              loggedAt: mockDate.toISOString(),
            },
          });
        }
        throw new Error('Task not found');
      }),
    };

    mockXpService = {
      getUserXpSummary: vi.fn().mockResolvedValue({
        totalXp: 350,
        level: 3,
        transactionsCount: 8,
      }),
    };

    syncService = new SyncService(
      mockPrisma as unknown as PrismaService,
      mockTasksService as unknown as TasksService,
      mockXpService as unknown as XpService,
      clock
    );
  });

  describe('pushActions', () => {
    it('should process batch actions and return per-item success results', async () => {
      const pushRequest: SyncPushRequest = {
        clientTimestamp: mockDate.toISOString(),
        actions: [
          {
            idempotencyKey: 'task1:complete:uuid-a',
            taskId: taskId1,
            action: 'complete',
            payload: { durationMinutes: 60, note: 'Done offline' },
          },
          {
            idempotencyKey: 'task2:postpone:uuid-b',
            taskId: taskId2,
            action: 'postpone',
            payload: { durationMinutes: 0, postponedToDate: '2026-11-22' },
          },
        ],
      };

      const res = await syncService.pushActions(userId, pushRequest);

      expect(res.processed).toBe(2);
      expect(res.results).toHaveLength(2);
      expect(res.results[0]).toEqual({
        idempotencyKey: 'task1:complete:uuid-a',
        taskId: taskId1,
        status: 'success',
        xpAwarded: 37, // 25 base + 12 bonus (60 min / 5)
      });
      expect(res.results[1]).toEqual({
        idempotencyKey: 'task2:postpone:uuid-b',
        taskId: taskId2,
        status: 'success',
        xpAwarded: 0,
      });
      expect(res.updatedTasks).toHaveLength(2);
      expect(mockTasksService.logTaskAction).toHaveBeenCalledTimes(2);
    });

    it('should handle idempotency replay safely and return successful confirmation', async () => {
      const pushRequest: SyncPushRequest = {
        clientTimestamp: mockDate.toISOString(),
        actions: [
          {
            idempotencyKey: 'task1:complete:uuid-a',
            taskId: taskId1,
            action: 'complete',
            payload: { durationMinutes: 60 },
          },
        ],
      };

      // First call
      const res1 = await syncService.pushActions(userId, pushRequest);
      expect(res1.results[0]?.status).toBe('success');

      // Second replay call
      const res2 = await syncService.pushActions(userId, pushRequest);
      expect(res2.results[0]?.status).toBe('success');
      expect(res2.results[0]?.xpAwarded).toBe(37);
      expect(res2.updatedTasks[0]?.id).toBe(taskId1);
    });

    it('should report individual item error when a task action fails without crashing batch', async () => {
      const pushRequest: SyncPushRequest = {
        clientTimestamp: mockDate.toISOString(),
        actions: [
          {
            idempotencyKey: 'invalid:complete:uuid',
            taskId: '99999999-9999-9999-9999-999999999999',
            action: 'complete',
            payload: { durationMinutes: 10 },
          },
          {
            idempotencyKey: 'task2:postpone:uuid-b',
            taskId: taskId2,
            action: 'postpone',
            payload: { durationMinutes: 0, postponedToDate: '2026-11-22' },
          },
        ],
      };

      const res = await syncService.pushActions(userId, pushRequest);

      expect(res.processed).toBe(2);
      expect(res.results[0]?.status).toBe('error');
      expect(res.results[0]?.error).toContain('Task not found');
      expect(res.results[1]?.status).toBe('success');
      expect(res.updatedTasks).toHaveLength(1);
    });
  });

  describe('pullDelta', () => {
    it('should return active cycle, tasks, and user xp summary', async () => {
      const res = await syncService.pullDelta(userId);

      expect(res.syncedAt).toBe(mockDate.toISOString());
      expect(res.activeCycle).toEqual({
        id: 'cycle-uuid-1',
        status: 'execution',
        year: 2026,
        month: 11,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });
      expect(res.tasks).toHaveLength(1);
      expect(res.tasks[0]?.id).toBe(taskId1);
      expect(res.xp).toEqual({
        totalXp: 350,
        currentLevel: 3,
      });
    });

    it('should pass since filter to Prisma query when timestamp is provided', async () => {
      const sinceTimestamp = '2026-11-21T10:00:00.000Z';
      await syncService.pullDelta(userId, sinceTimestamp);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          updatedAt: { gt: new Date(sinceTimestamp) },
        },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });
});
