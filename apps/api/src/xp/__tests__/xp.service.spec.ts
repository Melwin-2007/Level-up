import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateLevel,
  calculateLevelProgress,
  calculateTaskCompletionXp,
  xpThresholdForLevel,
} from '@mp/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import { XpService } from '../xp.service';
import { buildTaskXpIdempotencyKey } from '../xp.constants';

interface MockPrisma {
  xpTransaction: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
}

describe('XP Ledger & Gamification Engine (P70)', () => {
  describe('Pure Mathematical Level Progression Curves', () => {
    it('should calculate exact quadratic level thresholds', () => {
      expect(xpThresholdForLevel(1)).toBe(0);
      expect(xpThresholdForLevel(2)).toBe(100);
      expect(xpThresholdForLevel(3)).toBe(300);
      expect(xpThresholdForLevel(4)).toBe(600);
      expect(xpThresholdForLevel(5)).toBe(1000);
      expect(xpThresholdForLevel(10)).toBe(4500);
    });

    it('should derive correct level from total accumulated XP (never stored as counter)', () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);

      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(150)).toBe(2);
      expect(calculateLevel(299)).toBe(2);

      expect(calculateLevel(300)).toBe(3);
      expect(calculateLevel(599)).toBe(3);

      expect(calculateLevel(600)).toBe(4);
      expect(calculateLevel(999)).toBe(4);

      expect(calculateLevel(1000)).toBe(5);
    });

    it('should calculate exact progress ratio toward next level', () => {
      // At 0 XP (Level 1, needs 100 for Level 2)
      const p0 = calculateLevelProgress(0);
      expect(p0.level).toBe(1);
      expect(p0.xpIntoCurrentLevel).toBe(0);
      expect(p0.xpNeededForNextLevel).toBe(100);
      expect(p0.progressRatio).toBe(0);

      // At 50 XP (Level 1, 50% to Level 2)
      const p50 = calculateLevelProgress(50);
      expect(p50.level).toBe(1);
      expect(p50.xpIntoCurrentLevel).toBe(50);
      expect(p50.xpNeededForNextLevel).toBe(100);
      expect(p50.progressRatio).toBe(0.5);

      // At 100 XP (Level 2, needs 200 to reach Level 3 at 300 XP)
      const p100 = calculateLevelProgress(100);
      expect(p100.level).toBe(2);
      expect(p100.xpIntoCurrentLevel).toBe(0);
      expect(p100.xpNeededForNextLevel).toBe(200);
      expect(p100.progressRatio).toBe(0);

      // At 200 XP (Level 2, 100 into Level 2, 50% to Level 3)
      const p200 = calculateLevelProgress(200);
      expect(p200.level).toBe(2);
      expect(p200.xpIntoCurrentLevel).toBe(100);
      expect(p200.xpNeededForNextLevel).toBe(200);
      expect(p200.progressRatio).toBe(0.5);
    });

    it('should scale task completion XP with duration bonus capped at +25 XP', () => {
      // 0m or null duration -> base 25 XP
      expect(calculateTaskCompletionXp(null).amount).toBe(25);
      expect(calculateTaskCompletionXp(0).amount).toBe(25);

      // 30m -> 25 base + 6 bonus = 31 XP
      const r30 = calculateTaskCompletionXp(30);
      expect(r30.amount).toBe(31);
      expect(r30.breakdown.durationBonus).toBe(6);

      // 60m -> 25 base + 12 bonus = 37 XP
      const r60 = calculateTaskCompletionXp(60);
      expect(r60.amount).toBe(37);
      expect(r60.breakdown.durationBonus).toBe(12);

      // 120m -> 25 base + 24 bonus = 49 XP
      const r120 = calculateTaskCompletionXp(120);
      expect(r120.amount).toBe(49);
      expect(r120.breakdown.durationBonus).toBe(24);

      // 180m -> 25 base + 25 bonus (capped at max 25) = 50 XP
      const r180 = calculateTaskCompletionXp(180);
      expect(r180.amount).toBe(50);
      expect(r180.breakdown.durationBonus).toBe(25);
    });
  });

  describe('XpService Ledger Operations', () => {
    let service: XpService;
    let mockPrisma: MockPrisma;
    const userId = 'user-uuid-1';
    const taskId = 'task-uuid-1';

    beforeEach(() => {
      mockPrisma = {
        xpTransaction: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          create: vi.fn(),
          aggregate: vi.fn(),
        },
      };

      service = new XpService(mockPrisma as unknown as PrismaService);
    });

    it('should award XP for task completion with deterministic idempotency key', async () => {
      const expectedKey = buildTaskXpIdempotencyKey(taskId);
      mockPrisma.xpTransaction.findUnique.mockResolvedValue(null);

      const fakeTransaction = {
        id: 'tx-uuid-1',
        userId,
        amount: 37,
        reason: 'task_completed',
        idempotencyKey: expectedKey,
        metadata: { base: 25, durationBonus: 12 },
        createdAt: new Date('2026-11-21T12:00:00.000Z'),
      };
      mockPrisma.xpTransaction.create.mockResolvedValue(fakeTransaction);

      const result = await service.awardTaskCompletionXp(userId, {
        id: taskId,
        estimatedMinutes: 60,
      });

      expect(result).toEqual(fakeTransaction);
      expect(mockPrisma.xpTransaction.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: expectedKey },
      });
      expect(mockPrisma.xpTransaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          amount: 37,
          reason: 'task_completed',
          idempotencyKey: expectedKey,
          metadata: { base: 25, durationBonus: 12 },
        },
      });
    });

    it('should return existing transaction idempotently without double-awarding', async () => {
      const expectedKey = buildTaskXpIdempotencyKey(taskId);
      const existingTx = {
        id: 'tx-existing-1',
        userId,
        amount: 37,
        reason: 'task_completed',
        idempotencyKey: expectedKey,
        metadata: {},
        createdAt: new Date('2026-11-21T12:00:00.000Z'),
      };

      mockPrisma.xpTransaction.findUnique.mockResolvedValue(existingTx);

      const result = await service.awardTaskCompletionXp(userId, {
        id: taskId,
        estimatedMinutes: 60,
      });

      expect(result).toBe(existingTx);
      expect(mockPrisma.xpTransaction.create).not.toHaveBeenCalled();
    });

    it('should derive user level and summary dynamically from ledger aggregate sum', async () => {
      mockPrisma.xpTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 350 },
        _count: { id: 10 },
      });

      const summary = await service.getUserXpSummary(userId);

      expect(summary.totalXp).toBe(350);
      expect(summary.level).toBe(3); // 300 <= 350 < 600
      expect(summary.currentLevelBaseXp).toBe(300);
      expect(summary.nextLevelBaseXp).toBe(600);
      expect(summary.xpIntoCurrentLevel).toBe(50);
      expect(summary.xpNeededForNextLevel).toBe(300);
      expect(summary.progressRatio).toBeCloseTo(50 / 300);
      expect(summary.transactionsCount).toBe(10);
    });

    it('should return overview with summary and formatted recent transactions', async () => {
      mockPrisma.xpTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 150 },
        _count: { id: 4 },
      });

      const sampleDate = new Date('2026-11-21T10:00:00.000Z');
      mockPrisma.xpTransaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          userId,
          amount: 50,
          reason: 'task_completed',
          idempotencyKey: 'task-1:task_completed:1',
          metadata: { base: 25, durationBonus: 25 },
          createdAt: sampleDate,
        },
      ]);

      const overview = await service.getUserXpOverview(userId, 5);

      expect(overview.summary.totalXp).toBe(150);
      expect(overview.summary.level).toBe(2);
      expect(overview.recentTransactions).toHaveLength(1);
      expect(overview.recentTransactions[0]?.id).toBe('tx-1');
      expect(overview.recentTransactions[0]?.createdAt).toBe(sampleDate.toISOString());
    });
  });
});
