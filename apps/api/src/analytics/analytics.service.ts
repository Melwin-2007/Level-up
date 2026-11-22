import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type MonthOverMonthResponse,
  type CycleReportMetrics,
  calculateMonthOverMonthTrends,
  type StoredReportData,
  type GoalCategoryInput,
} from '@mp/shared';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMonthOverMonthAnalytics(userId: string): Promise<MonthOverMonthResponse> {
    // 1. Fetch individual reports for user from completed cycles
    const reports = await this.prisma.monthlyReport.findMany({
      where: {
        userId,
        reportType: 'individual',
        cycle: {
          status: 'completed',
        },
      },
      include: {
        cycle: true,
      },
      orderBy: [{ cycle: { year: 'asc' } }, { cycle: { month: 'asc' } }],
    });

    if (reports.length < 2) {
      return {
        status: 'insufficient_data',
        completedCyclesCount: reports.length,
        requiredCyclesCount: 2,
        cycleTrends: [],
        summary: null,
        categoryBreakdown: [],
        observations: [],
      };
    }

    const cycleIds = reports.map((r) => r.cycleId);

    // 2. Fetch goals for category aggregation
    const goals = await this.prisma.goal.findMany({
      where: {
        userId,
        cycleId: { in: cycleIds },
      },
      select: {
        id: true,
        cycleId: true,
        title: true,
        category: true,
      },
    });

    const goalsByCycle = new Map<string, typeof goals>();
    for (const g of goals) {
      const list = goalsByCycle.get(g.cycleId) ?? [];
      list.push(g);
      goalsByCycle.set(g.cycleId, list);
    }

    // 3. Assemble StoredReportData
    const storedReports: StoredReportData[] = reports.map((r) => {
      const metrics = r.metrics as unknown as CycleReportMetrics;
      const cycleGoals = goalsByCycle.get(r.cycleId) ?? [];

      const goalScores = metrics.weightedAchievement?.value?.goals ?? [];
      const scoreMap = new Map<string, number>();
      for (const gs of goalScores) {
        scoreMap.set(gs.goalId, Math.round(gs.rawScore * 100));
      }

      const categoryInputs: GoalCategoryInput[] = cycleGoals.map((cg) => ({
        goalId: cg.id,
        title: cg.title,
        category: cg.category,
        score: scoreMap.get(cg.id) ?? metrics.weightedAchievement?.value?.score ?? 0,
      }));

      return {
        cycleId: r.cycleId,
        year: r.cycle.year,
        month: r.cycle.month,
        metrics,
        goals: categoryInputs,
      };
    });

    return calculateMonthOverMonthTrends(storedReports);
  }
}
