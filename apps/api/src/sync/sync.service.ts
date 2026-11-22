import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { XpService } from '../xp/xp.service';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import {
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncPullResponse,
  type SyncPushResultItem,
  type TaskResponse,
  calculateTaskCompletionXp,
} from '@mp/shared';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TasksService) private readonly tasksService: TasksService,
    @Inject(XpService) private readonly xpService: XpService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async pushActions(userId: string, input: SyncPushRequest): Promise<SyncPushResponse> {
    const now = this.clock.now();
    const results: SyncPushResultItem[] = [];
    const updatedTasksMap = new Map<string, TaskResponse>();

    for (const actionItem of input.actions) {
      try {
        const { task } = await this.tasksService.logTaskAction(
          userId,
          actionItem.taskId,
          {
            action: actionItem.action,
            durationMinutes: actionItem.payload?.durationMinutes ?? 0,
            note: actionItem.payload?.note ?? null,
            postponedToDate: actionItem.payload?.postponedToDate ?? null,
          },
          actionItem.idempotencyKey
        );

        updatedTasksMap.set(task.id, task);

        let xpAwarded = 0;
        if (actionItem.action === 'complete' && task.status === 'completed') {
          xpAwarded = calculateTaskCompletionXp(task.estimatedMinutes).amount;
        }

        results.push({
          idempotencyKey: actionItem.idempotencyKey,
          taskId: actionItem.taskId,
          status: 'success',
          xpAwarded,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to process action';
        this.logger.warn(
          `Failed sync action ${actionItem.action} for task ${actionItem.taskId}: ${message}`
        );

        results.push({
          idempotencyKey: actionItem.idempotencyKey,
          taskId: actionItem.taskId,
          status: 'error',
          xpAwarded: 0,
          error: message,
        });
      }
    }

    return {
      syncedAt: now.toISOString(),
      processed: results.length,
      results,
      updatedTasks: Array.from(updatedTasksMap.values()),
    };
  }

  async pullDelta(userId: string, since?: string): Promise<SyncPullResponse> {
    const now = this.clock.now();
    const sinceDate = since ? new Date(since) : null;

    // 1. Resolve active cycle for user's groups
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);

    let activeCycle: SyncPullResponse['activeCycle'] = null;
    if (groupIds.length > 0) {
      const cycle = await this.prisma.monthlyCycle.findFirst({
        where: {
          groupId: { in: groupIds },
          status: { notIn: ['completed'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (cycle) {
        const monthStr = String(cycle.month).padStart(2, '0');
        const lastDay = new Date(Date.UTC(cycle.year, cycle.month, 0)).getUTCDate();
        activeCycle = {
          id: cycle.id,
          status: cycle.status,
          year: cycle.year,
          month: cycle.month,
          startDate: `${cycle.year}-${monthStr}-01`,
          endDate: `${cycle.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
        };
      }
    }

    // 2. Fetch tasks for user, optionally filtered by delta timestamp
    const where: { userId: string; updatedAt?: { gt: Date } } = { userId };
    if (sinceDate && !isNaN(sinceDate.getTime())) {
      where.updatedAt = { gt: sinceDate };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    });

    const mappedTasks: TaskResponse[] = tasks.map((t) => ({
      id: t.id,
      cycleId: t.cycleId,
      userId: t.userId,
      goalId: t.goalId,
      planItemId: t.planItemId,
      title: t.title,
      description: t.description,
      status: t.status,
      scheduledDate: t.scheduledDate ? t.scheduledDate.toISOString().slice(0, 10) : null,
      estimatedMinutes: t.estimatedMinutes,
      actualMinutes: t.actualMinutes,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    // 3. Current XP summary
    const xpSummary = await this.xpService.getUserXpSummary(userId);

    return {
      syncedAt: now.toISOString(),
      activeCycle,
      tasks: mappedTasks,
      xp: {
        totalXp: xpSummary.totalXp,
        currentLevel: xpSummary.level,
      },
    };
  }
}
