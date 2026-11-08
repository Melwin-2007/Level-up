import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from '../tasks.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Clock } from '../../common/clock/clock';

interface MockPrisma {
  task: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  taskLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('TasksService (P42)', () => {
  let service: TasksService;
  let mockPrisma: MockPrisma;
  let mockClock: Clock;

  const fixedNow = new Date('2026-11-06T14:30:00.000Z');
  const userId = 'user-uuid-1';
  const taskId = 'task-uuid-1';
  const cycleId = 'cycle-uuid-1';

  beforeEach(() => {
    mockClock = {
      now: vi.fn(() => fixedNow),
    };

    mockPrisma = {
      task: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      taskLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    service = new TasksService(mockPrisma as unknown as PrismaService, mockClock);
  });

  describe('getTasks', () => {
    it('should query tasks scoped to user and map dates to strings', async () => {
      const scheduledDate = new Date('2026-11-06T00:00:00.000Z');
      const createdAt = new Date('2026-11-01T10:00:00.000Z');

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: taskId,
          cycleId,
          userId,
          goalId: null,
          planItemId: null,
          title: 'Morning review',
          description: null,
          status: 'pending',
          scheduledDate,
          estimatedMinutes: 30,
          actualMinutes: 0,
          completedAt: null,
          createdAt,
          updatedAt: createdAt,
        },
      ]);

      const result = await service.getTasks(userId, { date: '2026-11-06' });

      expect(result).toHaveLength(1);
      const first = result[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.id).toBe(taskId);
        expect(first.scheduledDate).toBe('2026-11-06');
        expect(first.status).toBe('pending');
      }

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          scheduledDate: new Date('2026-11-06'),
        },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('getTask', () => {
    it('should throw NotFoundException if task does not belong to user', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: taskId,
        userId: 'other-user',
      });

      await expect(service.getTask(userId, taskId)).rejects.toThrow(NotFoundException);
    });

    it('should return task details with logs for task owner', async () => {
      const scheduledDate = new Date('2026-11-06T00:00:00.000Z');
      const createdAt = new Date('2026-11-01T10:00:00.000Z');
      const loggedAt = new Date('2026-11-06T12:00:00.000Z');

      mockPrisma.task.findUnique.mockResolvedValue({
        id: taskId,
        cycleId,
        userId,
        goalId: null,
        planItemId: null,
        title: 'Task with logs',
        description: null,
        status: 'in_progress',
        scheduledDate,
        estimatedMinutes: 60,
        actualMinutes: 25,
        completedAt: null,
        createdAt,
        updatedAt: createdAt,
        logs: [
          {
            id: 'log-1',
            taskId,
            userId,
            action: 'start',
            durationMinutes: 25,
            note: 'First sprint',
            loggedAt,
          },
        ],
      });

      const result = await service.getTask(userId, taskId);
      expect(result.id).toBe(taskId);
      expect(result.logs).toHaveLength(1);
      const firstLog = result.logs?.[0];
      expect(firstLog?.action).toBe('start');
      expect(firstLog?.durationMinutes).toBe(25);
    });
  });

  describe('logTaskAction', () => {
    const baseTask = {
      id: taskId,
      cycleId,
      userId,
      goalId: null,
      planItemId: null,
      title: 'Task 1',
      description: null,
      status: 'pending',
      scheduledDate: new Date('2026-11-06T00:00:00.000Z'),
      estimatedMinutes: 60,
      actualMinutes: 0,
      completedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      logs: [],
    };

    it('should transition to in_progress on start action', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(baseTask);
      mockPrisma.task.update.mockResolvedValue({
        ...baseTask,
        status: 'in_progress',
      });
      mockPrisma.taskLog.create.mockResolvedValue({
        id: 'log-uuid-1',
        taskId,
        userId,
        action: 'start',
        durationMinutes: 0,
        note: null,
        metadata: {},
        loggedAt: fixedNow,
      });

      const res = await service.logTaskAction(userId, taskId, {
        action: 'start',
        durationMinutes: 0,
      });

      expect(res.task.status).toBe('in_progress');
      expect(res.log.action).toBe('start');
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: expect.objectContaining({ status: 'in_progress' }),
      });
    });

    it('should transition to completed and set completedAt on complete action', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        ...baseTask,
        status: 'in_progress',
        actualMinutes: 30,
      });

      mockPrisma.task.update.mockResolvedValue({
        ...baseTask,
        status: 'completed',
        completedAt: fixedNow,
        actualMinutes: 50,
      });

      mockPrisma.taskLog.create.mockResolvedValue({
        id: 'log-uuid-2',
        taskId,
        userId,
        action: 'complete',
        durationMinutes: 20,
        note: 'Finished!',
        metadata: {},
        loggedAt: fixedNow,
      });

      const res = await service.logTaskAction(userId, taskId, {
        action: 'complete',
        durationMinutes: 20,
        note: 'Finished!',
      });

      expect(res.task.status).toBe('completed');
      expect(res.task.completedAt).toBe(fixedNow.toISOString());
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: fixedNow,
          actualMinutes: 50,
        }),
      });
    });

    it('should update scheduledDate on postpone action', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(baseTask);
      const postponedDate = new Date('2026-11-08T00:00:00.000Z');

      mockPrisma.task.update.mockResolvedValue({
        ...baseTask,
        status: 'postponed',
        scheduledDate: postponedDate,
      });

      mockPrisma.taskLog.create.mockResolvedValue({
        id: 'log-uuid-3',
        taskId,
        userId,
        action: 'postpone',
        durationMinutes: 0,
        note: 'Need more prep',
        metadata: {},
        loggedAt: fixedNow,
      });

      const res = await service.logTaskAction(userId, taskId, {
        action: 'postpone',
        durationMinutes: 0,
        postponedToDate: '2026-11-08',
      });

      expect(res.task.status).toBe('postponed');
      expect(res.task.scheduledDate).toBe('2026-11-08');
    });

    it('should be idempotent when provided an Idempotency-Key', async () => {
      const existingLog = {
        id: 'log-existing',
        taskId,
        userId,
        action: 'start',
        durationMinutes: 0,
        note: null,
        metadata: { idempotencyKey: 'idemp-1234' },
        loggedAt: fixedNow,
      };

      mockPrisma.task.findUnique.mockResolvedValue({
        ...baseTask,
        status: 'in_progress',
        logs: [existingLog],
      });

      const res = await service.logTaskAction(
        userId,
        taskId,
        { action: 'start', durationMinutes: 0 },
        'idemp-1234'
      );

      expect(res.log.id).toBe('log-existing');
      // Should not call update or create on Prisma
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
      expect(mockPrisma.taskLog.create).not.toHaveBeenCalled();
    });
  });
});
