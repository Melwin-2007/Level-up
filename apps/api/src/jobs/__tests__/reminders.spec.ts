import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateNextReminderDelay,
  buildDailyTaskSummaryNotification,
  buildDeadlineReminderNotification,
} from '../reminders.utils';
import { RemindersWorker } from '../reminders.worker';
import { JobsService } from '../jobs.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Clock } from '../../common/clock/clock';

describe('Reminders & Notifications (P43)', () => {
  describe('calculateNextReminderDelay', () => {
    it('should schedule for today when current time is before reminder time', () => {
      // 06:00 UTC = 06:00 in UTC timezone. Reminder is 09:00 UTC.
      const now = new Date('2026-11-06T06:00:00.000Z');
      const delay = calculateNextReminderDelay(now, 'UTC', '09:00');

      // 3 hours difference = 3 * 3600 * 1000 = 10,800,000 ms
      expect(delay).toBe(10800000);
    });

    it('should schedule for tomorrow when current time has passed reminder time today', () => {
      // 10:00 UTC in UTC timezone. Reminder is 09:00.
      const now = new Date('2026-11-06T10:00:00.000Z');
      const delay = calculateNextReminderDelay(now, 'UTC', '09:00');

      // 23 hours difference = 23 * 3600 * 1000 = 82,800,000 ms
      expect(delay).toBe(82800000);
    });

    it('should compute delay accurately for non-UTC timezone (e.g. America/New_York)', () => {
      // 13:00 UTC = 08:00 EST in America/New_York (UTC-5).
      // Target reminder is 09:00 EST = 14:00 UTC.
      const now = new Date('2026-11-06T13:00:00.000Z');
      const delay = calculateNextReminderDelay(now, 'America/New_York', '09:00');

      // 1 hour difference = 3,600,000 ms
      expect(delay).toBe(3600000);
    });
  });

  describe('Notification Content Privacy', () => {
    it('should format generic daily task notification without private goal details', () => {
      const emptyNotif = buildDailyTaskSummaryNotification(0);
      expect(emptyNotif.title).toBe('Daily Tasks');
      expect(emptyNotif.body).toBe('No tasks scheduled for today.');

      const activeNotif = buildDailyTaskSummaryNotification(4);
      expect(activeNotif.title).toBe('Daily Tasks');
      expect(activeNotif.body).toBe('You have 4 tasks scheduled today.');

      // Invariant: no private goal text in notifications
      expect(activeNotif.body).not.toContain('goal');
      expect(activeNotif.body).not.toContain('secret');
    });

    it('should format generic deadline countdown without private details', () => {
      const submissionNotif = buildDeadlineReminderNotification('submission', 12);
      expect(submissionNotif.title).toBe('Goal submission Deadline');
      expect(submissionNotif.body).toBe(
        'Goal submission closes in 12 hours. Check your cycle to stay on track.'
      );

      const reviewNotif = buildDeadlineReminderNotification('review', 6);
      expect(reviewNotif.title).toBe('Group review Deadline');
      expect(reviewNotif.body).toBe(
        'Group review closes in 6 hours. Check your cycle to stay on track.'
      );
    });
  });

  describe('RemindersWorker execution', () => {
    let worker: RemindersWorker;
    let jobsService: JobsService;
    let mockPrisma: { task: { count: ReturnType<typeof vi.fn> } };
    let mockClock: Clock;

    const fixedNow = new Date('2026-11-06T08:00:00.000Z');

    beforeEach(() => {
      jobsService = new JobsService(null);
      mockPrisma = {
        task: {
          count: vi.fn(),
        },
      };
      mockClock = {
        now: vi.fn(() => fixedNow),
      };

      worker = new RemindersWorker(jobsService, mockPrisma as unknown as PrismaService, mockClock);
      worker.onModuleInit();
    });

    it('should process daily summary and record generic notification', async () => {
      mockPrisma.task.count.mockResolvedValue(3);

      await worker.processJob({
        type: 'daily_summary',
        userId: 'user-abc',
        date: '2026-11-06',
        timeZone: 'UTC',
      });

      const sent = worker.getSentNotifications();
      expect(sent).toHaveLength(1);
      const first = sent[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.to).toBe('user-user-abc');
        expect(first.title).toBe('Daily Tasks');
        expect(first.body).toBe('You have 3 tasks scheduled today.');
      }
    });

    it('should process deadline reminder and record notification', async () => {
      await worker.processJob({
        type: 'deadline',
        cycleId: 'cycle-123',
        deadlineType: 'submission',
        deadline: '2026-11-06T14:00:00.000Z',
      });

      const sent = worker.getSentNotifications();
      expect(sent).toHaveLength(1);
      const first = sent[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.to).toBe('cycle-cycle-123');
        expect(first.body).toContain('Goal submission closes in 6 hours.');
      }
    });
  });
});
