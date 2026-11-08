import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Task, TaskLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import type {
  LogTaskActionInput,
  QueryTasksInput,
  TaskResponse,
  TaskLogResponse,
} from '@mp/shared';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  private mapLog(log: TaskLog): TaskLogResponse {
    return {
      id: log.id,
      taskId: log.taskId,
      userId: log.userId,
      action: log.action,
      durationMinutes: log.durationMinutes,
      note: log.note,
      loggedAt: log.loggedAt.toISOString(),
    };
  }

  private mapTask(task: Task & { logs?: TaskLog[] }): TaskResponse {
    return {
      id: task.id,
      cycleId: task.cycleId,
      userId: task.userId,
      goalId: task.goalId,
      planItemId: task.planItemId,
      title: task.title,
      description: task.description,
      status: task.status,
      scheduledDate: task.scheduledDate ? task.scheduledDate.toISOString().slice(0, 10) : null,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      logs: task.logs?.map((l) => this.mapLog(l)),
    };
  }

  async getTasks(userId: string, query: QueryTasksInput): Promise<TaskResponse[]> {
    const where: Prisma.TaskWhereInput = {
      userId,
    };

    if (query.cycleId) {
      where.cycleId = query.cycleId;
    }

    if (query.date) {
      where.scheduledDate = new Date(query.date);
    }

    if (query.status) {
      where.status = query.status;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    });

    return tasks.map((t) => this.mapTask(t));
  }

  async getTask(userId: string, taskId: string): Promise<TaskResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        logs: {
          orderBy: { loggedAt: 'asc' },
        },
      },
    });

    if (!task || task.userId !== userId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
    }

    return this.mapTask(task);
  }

  async logTaskAction(
    userId: string,
    taskId: string,
    input: LogTaskActionInput,
    idempotencyKey?: string
  ): Promise<{ task: TaskResponse; log: TaskLogResponse }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        logs: {
          orderBy: { loggedAt: 'asc' },
        },
      },
    });

    if (!task || task.userId !== userId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
    }

    // Check idempotency key to prevent double actions
    if (idempotencyKey) {
      const existingLog = task.logs?.find((l) => {
        const meta = l.metadata as Record<string, unknown> | null;
        return meta && meta['idempotencyKey'] === idempotencyKey;
      });

      if (existingLog) {
        this.logger.log(`Idempotent request for task ${taskId} with key ${idempotencyKey}`);
        return {
          task: this.mapTask(task),
          log: this.mapLog(existingLog),
        };
      }
    }

    const now = this.clock.now();

    // Derive new status and properties
    let newStatus = task.status;
    let completedAt = task.completedAt;
    let scheduledDate = task.scheduledDate;
    let actualMinutes = task.actualMinutes;

    if (input.durationMinutes > 0) {
      actualMinutes += input.durationMinutes;
    }

    switch (input.action) {
      case 'start':
        newStatus = 'in_progress';
        break;
      case 'pause':
        newStatus = 'paused';
        break;
      case 'complete':
        newStatus = 'completed';
        completedAt = now;
        break;
      case 'postpone':
        newStatus = 'postponed';
        if (input.postponedToDate) {
          scheduledDate = new Date(input.postponedToDate);
        }
        break;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          scheduledDate,
          actualMinutes,
          completedAt,
        },
      });

      const logRecord = await tx.taskLog.create({
        data: {
          taskId,
          userId,
          action: input.action,
          durationMinutes: input.durationMinutes,
          note: input.note ?? null,
          metadata: idempotencyKey ? { idempotencyKey } : {},
          loggedAt: now,
        },
      });

      return {
        task: this.mapTask(updatedTask),
        log: this.mapLog(logRecord),
      };
    });
  }
}
