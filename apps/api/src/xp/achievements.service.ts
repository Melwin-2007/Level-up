import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  calculateStreak,
  evaluateAchievements,
  type GamificationOverview,
  type StreakData,
  type EvaluatedAchievement,
} from '@mp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CLOCK, type Clock } from '../common/clock/clock';
import { XpService } from './xp.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(XpService) private readonly xpService: XpService
  ) {}

  /**
   * Helper to format a Date as YYYY-MM-DD in the user's IANA timezone.
   */
  private formatLocalDate(date: Date, timeZone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Evaluates achievements, awards new ledger transactions idempotently,
   * and returns complete gamification status (level, streak, achievements).
   */
  async getGamificationOverview(userId: string): Promise<GamificationOverview> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timeZone = profile?.timezone || 'UTC';
    const now = this.clock.now();
    const todayDateStr = this.formatLocalDate(now, timeZone);

    // 1. Fetch completed tasks
    const completedTasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: 'completed',
      },
      select: {
        id: true,
        completedAt: true,
        scheduledDate: true,
        estimatedMinutes: true,
        actualMinutes: true,
      },
    });

    // 2. Derive unique local dates for streak calculation
    const completedDates = completedTasks
      .map((t) => {
        const d = t.completedAt ?? t.scheduledDate;
        return d ? this.formatLocalDate(d, timeZone) : null;
      })
      .filter((d): d is string => d !== null);

    const streak: StreakData = calculateStreak(completedDates, todayDateStr);

    // 3. Count accuracy
    const accurateTasksCount = completedTasks.filter((t) => {
      const variance = Math.abs(t.actualMinutes - t.estimatedMinutes);
      return variance <= 15;
    }).length;

    // 4. Check already awarded achievements from ledger
    const existingAwardTxs = await this.prisma.xpTransaction.findMany({
      where: {
        userId,
        reason: 'achievement_unlocked',
      },
      select: {
        metadata: true,
      },
    });

    const awardedAchievementIds = existingAwardTxs
      .map((tx) => {
        const meta = tx.metadata as { achievementId?: string } | null;
        return meta?.achievementId;
      })
      .filter((id): id is string => Boolean(id));

    // 5. Evaluate achievements
    const evaluated: EvaluatedAchievement[] = evaluateAchievements({
      completedTasksCount: completedTasks.length,
      longestStreak: streak.longestStreak,
      accurateTasksCount,
      awardedAchievementIds,
    });

    // 6. Award ledger entries for any newly unlocked achievements
    for (const ach of evaluated) {
      if (ach.isNewlyUnlocked) {
        const idempotencyKey = `achievement:${ach.id}:1`;
        try {
          await this.prisma.xpTransaction.create({
            data: {
              userId,
              amount: ach.xpReward,
              reason: 'achievement_unlocked',
              idempotencyKey,
              metadata: {
                achievementId: ach.id,
                title: ach.title,
              },
            },
          });
          this.logger.log(
            `Awarded ${ach.xpReward} XP to user ${userId} for achievement "${ach.title}"`
          );
        } catch (err: unknown) {
          const prismaErr = err as { code?: string };
          if (prismaErr.code !== 'P2002') {
            throw err;
          }
        }
      }
    }

    // 7. Get final level summary
    const level = await this.xpService.getUserXpSummary(userId);

    return {
      level,
      streak,
      achievements: evaluated,
    };
  }
}
