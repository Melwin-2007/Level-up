import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { JobsService } from './jobs.service.js';
import {
  calculateNextReminderDelay,
  buildDailyTaskSummaryNotification,
  buildDeadlineReminderNotification,
} from './reminders.utils.js';
import type { ReminderJobData, NotificationPayload } from './reminders.types.js';

@Injectable()
export class RemindersWorker implements OnModuleInit {
  private readonly logger = new Logger(RemindersWorker.name);
  private readonly sentNotifications: NotificationPayload[] = [];

  constructor(
    @Inject(JobsService) private readonly jobsService: JobsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  onModuleInit(): void {
    this.jobsService.registerWorker<ReminderJobData>('reminders', async (job) => {
      await this.processJob(job.data);
    });
  }

  async processJob(data: ReminderJobData): Promise<void> {
    if (data.type === 'daily_summary') {
      await this.processDailySummary(data.userId, data.timeZone);
    } else if (data.type === 'deadline') {
      await this.processDeadlineReminder(data.cycleId, data.deadlineType, data.deadline);
    }
  }

  private async processDailySummary(userId: string, timeZone: string): Promise<void> {
    const now = this.clock.now();
    const today = now.toISOString().slice(0, 10);

    const pendingTasks = await this.prisma.task.count({
      where: {
        userId,
        scheduledDate: new Date(today),
        status: { notIn: ['completed', 'cancelled'] },
      },
    });

    const notification = buildDailyTaskSummaryNotification(pendingTasks);
    this.logger.log(`Daily summary for user ${userId}: "${notification.body}"`);

    this.sentNotifications.push({
      to: `user-${userId}`,
      title: notification.title,
      body: notification.body,
    });

    // Schedule next day reminder
    const delay = calculateNextReminderDelay(now, timeZone, '09:00');
    if (delay > 0) {
      await this.jobsService.addJob(
        'reminders',
        `daily-summary-${userId}`,
        {
          type: 'daily_summary',
          userId,
          date: today,
          timeZone,
        },
        { delay }
      );
    }
  }

  private async processDeadlineReminder(
    cycleId: string,
    deadlineType: 'submission' | 'review',
    deadlineIso: string
  ): Promise<void> {
    const now = this.clock.now();
    const deadline = new Date(deadlineIso);
    const msRemaining = Math.max(0, deadline.getTime() - now.getTime());
    const hoursRemaining = Math.round(msRemaining / (1000 * 60 * 60));

    const notification = buildDeadlineReminderNotification(deadlineType, hoursRemaining);
    this.logger.log(`Deadline reminder for cycle ${cycleId}: "${notification.body}"`);

    this.sentNotifications.push({
      to: `cycle-${cycleId}`,
      title: notification.title,
      body: notification.body,
    });
  }

  getSentNotifications(): NotificationPayload[] {
    return [...this.sentNotifications];
  }
}
