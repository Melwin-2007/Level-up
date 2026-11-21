import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateStreak,
  evaluateAchievements,
  type AchievementEvaluationContext,
} from '@mp/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Clock } from '../../common/clock/clock';
import { AchievementsService } from '../achievements.service';
import type { XpService } from '../xp.service';

interface MockPrisma {
  profile: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  task: {
    findMany: ReturnType<typeof vi.fn>;
  };
  xpTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

describe('Streaks & Achievements System (P71)', () => {
  describe('Pure Streak Calculation', () => {
    const today = '2026-11-21';

    it('should return 0 streak for empty completions', () => {
      const res = calculateStreak([], today);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(0);
      expect(res.activeToday).toBe(false);
      expect(res.lastActiveDate).toBeNull();
    });

    it('should compute streak when active today', () => {
      const dates = ['2026-11-19', '2026-11-20', '2026-11-21'];
      const res = calculateStreak(dates, today);
      expect(res.currentStreak).toBe(3);
      expect(res.longestStreak).toBe(3);
      expect(res.activeToday).toBe(true);
      expect(res.lastActiveDate).toBe('2026-11-21');
    });

    it('should keep streak alive if active yesterday but not yet today', () => {
      const dates = ['2026-11-19', '2026-11-20'];
      const res = calculateStreak(dates, today);
      expect(res.currentStreak).toBe(2);
      expect(res.longestStreak).toBe(2);
      expect(res.activeToday).toBe(false);
      expect(res.lastActiveDate).toBe('2026-11-20');
    });

    it('should reset current streak to 0 if a day was skipped', () => {
      const dates = ['2026-11-17', '2026-11-18', '2026-11-19']; // Missed Nov 20 and Nov 21
      const res = calculateStreak(dates, today);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(3);
      expect(res.activeToday).toBe(false);
      expect(res.lastActiveDate).toBe('2026-11-19');
    });

    it('should correctly preserve historical longest streak even after current streak resets', () => {
      const dates = [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05', // 5-day streak
        '2026-11-10', // gap
        '2026-11-20',
        '2026-11-21', // 2-day current streak
      ];
      const res = calculateStreak(dates, today);
      expect(res.currentStreak).toBe(2);
      expect(res.longestStreak).toBe(5);
    });
  });

  describe('Pure Achievement Evaluator', () => {
    it('should evaluate newly unlocked achievements vs already awarded ones', () => {
      const ctx: AchievementEvaluationContext = {
        completedTasksCount: 12,
        longestStreak: 4,
        accurateTasksCount: 6,
        awardedAchievementIds: ['first_step'], // already in ledger
      };

      const res = evaluateAchievements(ctx);
      const firstStep = res.find((a) => a.id === 'first_step');
      const momentum = res.find((a) => a.id === 'momentum');
      const decathlete = res.find((a) => a.id === 'decathlete');
      const weekUnbroken = res.find((a) => a.id === 'week_unbroken');

      // First step was already awarded -> unlocked but not newly unlocked
      expect(firstStep?.isUnlocked).toBe(true);
      expect(firstStep?.isNewlyUnlocked).toBe(false);

      // Momentum (target 3 streak, current 4) -> unlocked and newly unlocked
      expect(momentum?.isUnlocked).toBe(true);
      expect(momentum?.isNewlyUnlocked).toBe(true);

      // Decathlete (target 10 tasks, current 12) -> unlocked and newly unlocked
      expect(decathlete?.isUnlocked).toBe(true);
      expect(decathlete?.isNewlyUnlocked).toBe(true);

      // Week unbroken (target 7 streak, current 4) -> locked
      expect(weekUnbroken?.isUnlocked).toBe(false);
      expect(weekUnbroken?.isNewlyUnlocked).toBe(false);
      expect(weekUnbroken?.currentProgress).toBe(4);
    });
  });

  describe('AchievementsService Integration', () => {
    let service: AchievementsService;
    let mockPrisma: MockPrisma;
    let mockClock: Clock;
    let mockXpService: { getUserXpSummary: ReturnType<typeof vi.fn> };
    const userId = 'user-uuid-1';
    const fixedNow = new Date('2026-11-21T15:00:00.000Z');

    beforeEach(() => {
      mockPrisma = {
        profile: {
          findUnique: vi.fn(),
        },
        task: {
          findMany: vi.fn(),
        },
        xpTransaction: {
          findMany: vi.fn(),
          create: vi.fn(),
        },
      };

      mockClock = {
        now: vi.fn(() => fixedNow),
      };

      mockXpService = {
        getUserXpSummary: vi.fn().mockResolvedValue({
          level: 2,
          totalXp: 180,
          currentLevelBaseXp: 100,
          nextLevelBaseXp: 300,
          xpIntoCurrentLevel: 80,
          xpNeededForNextLevel: 200,
          progressRatio: 0.4,
          transactionsCount: 5,
        }),
      };

      service = new AchievementsService(
        mockPrisma as unknown as PrismaService,
        mockClock,
        mockXpService as unknown as XpService
      );
    });

    it('should evaluate achievements, create ledger entries for new unlocks, and return overview', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ timezone: 'UTC' });

      // User has 1 completed task on 2026-11-21
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          completedAt: new Date('2026-11-21T10:00:00.000Z'),
          scheduledDate: new Date('2026-11-21T00:00:00.000Z'),
          estimatedMinutes: 30,
          actualMinutes: 30,
        },
      ]);

      // No achievements awarded yet
      mockPrisma.xpTransaction.findMany.mockResolvedValue([]);
      mockPrisma.xpTransaction.create.mockResolvedValue({ id: 'tx-ach-1' });

      const overview = await service.getGamificationOverview(userId);

      expect(overview.streak.currentStreak).toBe(1);
      expect(overview.streak.activeToday).toBe(true);

      // 'first_step' unlocked (1 task completed >= target 1)
      const firstStep = overview.achievements.find((a) => a.id === 'first_step');
      expect(firstStep?.isUnlocked).toBe(true);

      // Must have created an immutable XP transaction for the newly unlocked achievement
      expect(mockPrisma.xpTransaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          amount: 50,
          reason: 'achievement_unlocked',
          idempotencyKey: 'achievement:first_step:1',
          metadata: {
            achievementId: 'first_step',
            title: 'First Step',
          },
        },
      });
    });
  });
});
