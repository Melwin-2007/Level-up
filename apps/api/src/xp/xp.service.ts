import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, XpTransaction } from '@prisma/client';
import {
  calculateLevelProgress,
  calculateTaskCompletionXp,
  type UserXpSummary,
  type XpSummaryResponse,
  type XpTransactionResponse,
} from '@mp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { buildTaskXpIdempotencyKey } from './xp.constants';

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Awards XP for a completed task using strict idempotency.
   * Can be executed inside an existing Prisma interactive transaction.
   */
  async awardTaskCompletionXp(
    userId: string,
    task: { id: string; estimatedMinutes?: number | null },
    tx?: Prisma.TransactionClient
  ): Promise<XpTransaction> {
    const client = tx ?? this.prisma;
    const idempotencyKey = buildTaskXpIdempotencyKey(task.id);

    // 1. Fast check for existing idempotency key
    const existing = await client.xpTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.log(`XP already awarded for task ${task.id} with key ${idempotencyKey}`);
      return existing;
    }

    // 2. Calculate pure reward
    const reward = calculateTaskCompletionXp(task.estimatedMinutes);

    // 3. Insert transaction, catching race-condition unique constraint violations safely
    try {
      const created = await client.xpTransaction.create({
        data: {
          userId,
          amount: reward.amount,
          reason: reward.reason,
          idempotencyKey,
          metadata: reward.breakdown,
        },
      });

      this.logger.log(
        `Awarded ${reward.amount} XP to user ${userId} for task ${task.id} (key: ${idempotencyKey})`
      );
      return created;
    } catch (err: unknown) {
      // Prisma P2002: unique constraint failed
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        const raceWinner = await client.xpTransaction.findUnique({
          where: { idempotencyKey },
        });
        if (raceWinner) {
          return raceWinner;
        }
      }
      throw err;
    }
  }

  /**
   * Derives current level, XP balance, and progress to next level directly from the ledger.
   * Levels are never stored as mutable counters in database columns.
   */
  async getUserXpSummary(userId: string): Promise<UserXpSummary> {
    const aggregate = await this.prisma.xpTransaction.aggregate({
      where: { userId },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalXp = aggregate._sum.amount ?? 0;
    const transactionsCount = aggregate._count.id;
    const progress = calculateLevelProgress(totalXp);

    return {
      level: progress.level,
      totalXp: progress.totalXp,
      currentLevelBaseXp: progress.currentLevelBaseXp,
      nextLevelBaseXp: progress.nextLevelBaseXp,
      xpIntoCurrentLevel: progress.xpIntoCurrentLevel,
      xpNeededForNextLevel: progress.xpNeededForNextLevel,
      progressRatio: progress.progressRatio,
      transactionsCount,
    };
  }

  /**
   * Returns complete overview with summary and recent transaction ledger entries.
   */
  async getUserXpOverview(userId: string, limit = 20): Promise<XpSummaryResponse> {
    const [summary, transactions] = await Promise.all([
      this.getUserXpSummary(userId),
      this.prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const recentTransactions: XpTransactionResponse[] = transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      reason: t.reason,
      idempotencyKey: t.idempotencyKey,
      metadata: (t.metadata as Record<string, unknown> | null) ?? {},
      createdAt: t.createdAt.toISOString(),
    }));

    return {
      summary,
      recentTransactions,
    };
  }
}
