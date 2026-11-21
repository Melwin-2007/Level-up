import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { GoalMetricInput, MonthlyReportResponse, ReportInsight } from '@mp/shared';
import {
  calculateCycleMetrics,
  type SuccessCriteriaDefinition,
  type TaskExecutionItem,
  type TaskLogItem,
  type PlanItemSnapshot,
  type TaskExecutionStatus,
} from '@mp/scheduler';
import { PrismaService } from '../prisma/prisma.service.js';
import { CycleStateService } from '../cycles/cycle-state.service.js';
import { AiService } from '../ai/ai.service.js';
import {
  buildReportPrompt,
  reportInsightsLlmOutputSchema,
  REPORT_PROMPT_ID,
  REPORT_PROMPT_VERSION,
} from '../ai/prompts/report-prompt.js';

const VALID_METRIC_IDS = new Set([
  'weighted_achievement',
  'task_execution',
  'estimate_accuracy',
  'consistency',
  'plan_comparison',
]);

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycleStateService: CycleStateService,
    private readonly aiService: AiService
  ) {}

  async generateIndividualReport(
    cycleId: string,
    userId: string,
    regenerationNote?: string
  ): Promise<MonthlyReportResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: cycle.groupId, userId } },
    });

    if (!membership) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    this.cycleStateService.assertAllows(cycle, 'report.generate');

    // Idempotency: Return existing report unless regeneration note is explicitly provided
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        cycleId,
        userId,
        reportType: 'individual',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingReport && !regenerationNote) {
      this.logger.log(
        `Returning existing individual report for user ${userId} in cycle ${cycleId}`
      );
      return this.mapToReportResponse(existingReport);
    }

    // 1. Gather all inputs for pure metrics calculation
    const submission = await this.prisma.monthlySubmission.findUnique({
      where: { cycleId_userId: { cycleId, userId } },
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    const tasks = await this.prisma.task.findMany({
      where: { cycleId, userId },
      orderBy: { scheduledDate: 'asc' },
    });

    const logs = await this.prisma.taskLog.findMany({
      where: { userId, task: { cycleId } },
      orderBy: { loggedAt: 'asc' },
    });

    const baselineVersion = await this.prisma.planVersion.findFirst({
      where: { cycleId, userId, isBaseline: true },
      include: { planItems: true },
    });

    const currentVersion = await this.prisma.planVersion.findFirst({
      where: { cycleId, userId, approvalStatus: 'approved' },
      orderBy: { versionNumber: 'desc' },
      include: { planItems: true },
    });

    const startDateStr = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(Date.UTC(cycle.year, cycle.month, 0)).getUTCDate();
    const endDateStr = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const goalMetricInputs: GoalMetricInput[] = (submission?.goals ?? []).map((g) => ({
      goalId: g.id,
      title: g.title,
      priority: g.priority,
      estimatedHours: g.estimatedHours ?? undefined,
      successCriteria: (g.successCriteria as unknown as SuccessCriteriaDefinition) ?? undefined,
    }));

    const taskExecutionItems: TaskExecutionItem[] = tasks.map((t) => ({
      id: t.id,
      goalId: t.goalId,
      planItemId: t.planItemId,
      title: t.title,
      description: t.description,
      status: t.status as TaskExecutionStatus,
      scheduledDate: t.scheduledDate ? t.scheduledDate.toISOString().slice(0, 10) : null,
      estimatedMinutes: t.estimatedMinutes,
      actualMinutes: t.actualMinutes,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }));

    const taskLogItems: TaskLogItem[] = logs.map((l) => ({
      id: l.id,
      taskId: l.taskId,
      action: l.action,
      durationMinutes: l.durationMinutes,
      loggedAt: l.loggedAt.toISOString(),
      metadata: l.metadata as Record<string, unknown> | null,
    }));

    const baselinePlanItemSnapshots: PlanItemSnapshot[] = (baselineVersion?.planItems ?? []).map(
      (i) => ({
        id: i.id,
        goalId: i.goalId,
        itemType: i.itemType,
        title: i.title,
        description: i.description,
        plannedDate: i.plannedDate ? i.plannedDate.toISOString().slice(0, 10) : null,
        weekNumber: i.weekNumber,
        estimatedMinutes: i.estimatedMinutes,
        orderIndex: i.orderIndex,
      })
    );

    const currentPlanItemSnapshots: PlanItemSnapshot[] = (currentVersion?.planItems ?? []).map(
      (i) => ({
        id: i.id,
        goalId: i.goalId,
        itemType: i.itemType,
        title: i.title,
        description: i.description,
        plannedDate: i.plannedDate ? i.plannedDate.toISOString().slice(0, 10) : null,
        weekNumber: i.weekNumber,
        estimatedMinutes: i.estimatedMinutes,
        orderIndex: i.orderIndex,
      })
    );

    // 2. Pure metrics calculation
    const metrics = calculateCycleMetrics({
      goals: goalMetricInputs,
      tasks: taskExecutionItems,
      logs: taskLogItems,
      cycleStartDate: startDateStr,
      cycleEndDate: endDateStr,
      baselinePlanItems: baselinePlanItemSnapshots,
      currentPlanItems: currentPlanItemSnapshots,
    });

    // 3. AI Insights generation citing metrics
    let insights: ReportInsight[] = [];
    try {
      const { systemPrompt, userPrompt } = buildReportPrompt(
        metrics,
        cycle.year,
        cycle.month,
        regenerationNote
      );

      const aiResponse = await this.aiService.generateStructured({
        promptId: REPORT_PROMPT_ID,
        promptVersion: REPORT_PROMPT_VERSION,
        systemPrompt,
        userPrompt,
        schema: reportInsightsLlmOutputSchema,
        userId,
        actionType: 'report.generate',
      });

      // Post-validation: strictly ensure every insight has valid citations
      const validatedInsights = aiResponse.data.insights.filter((insight) => {
        if (!insight.citations || insight.citations.length === 0) {
          return false;
        }
        return insight.citations.every((citation) => VALID_METRIC_IDS.has(citation.metricId));
      });

      if (validatedInsights.length === 0) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_AI_INSIGHTS',
            message: 'Generated insights lacked required metric citations',
          },
        });
      }

      insights = validatedInsights;
    } catch (aiErr) {
      this.logger.warn(
        `AI insights generation failed or fell back: ${aiErr instanceof Error ? aiErr.message : aiErr}`
      );
      // Fallback deterministic insights citing metrics
      insights = [
        {
          id: 'fallback-achievement',
          title: 'Monthly Goal Achievement',
          observation: `Completed monthly goals with a weighted score of ${metrics.weightedAchievement.value.score}%.`,
          recommendation: 'Use steady weekly delivery to maintain or increase completion.',
          citations: [
            {
              metricId: 'weighted_achievement',
              metricValue: `${metrics.weightedAchievement.value.score}%`,
              reason: 'Overall weighted score across cycle goals',
            },
          ],
        },
        {
          id: 'fallback-execution',
          title: 'Task Execution Volume',
          observation: `Completed ${metrics.taskExecution.value.completedTasks} out of ${metrics.taskExecution.value.totalTasks} scheduled tasks.`,
          recommendation: 'Evaluate uncompleted tasks for next cycle feasibility.',
          citations: [
            {
              metricId: 'task_execution',
              metricValue: `${metrics.taskExecution.value.completionRate}%`,
              reason: 'Task execution completion rate',
            },
          ],
        },
      ];
    }

    // 4. Persist to monthly_reports table
    const createdReport = await this.prisma.monthlyReport.create({
      data: {
        cycleId,
        userId,
        reportType: 'individual',
        metrics: metrics as unknown as Prisma.InputJsonValue,
        insights: insights as unknown as Prisma.InputJsonValue,
        sharingSettings: {
          shareAchievementRate: true,
          shareCompletedTasksCount: true,
          shareConsistencyScore: true,
          shareGoalTitles: false,
        },
      },
    });

    return this.mapToReportResponse(createdReport);
  }

  async getIndividualReport(cycleId: string, userId: string): Promise<MonthlyReportResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: cycle.groupId, userId } },
    });

    if (!membership) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    this.cycleStateService.assertAllows(cycle, 'report.read');

    const report = await this.prisma.monthlyReport.findFirst({
      where: {
        cycleId,
        userId,
        reportType: 'individual',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (report) {
      return this.mapToReportResponse(report);
    }

    // Auto-generate on read if cycle is in execution or completed
    return this.generateIndividualReport(cycleId, userId);
  }

  private mapToReportResponse(report: {
    id: string;
    cycleId: string;
    userId: string | null;
    reportType: string;
    metrics: unknown;
    insights: unknown;
    sharingSettings: unknown;
    createdAt: Date;
  }): MonthlyReportResponse {
    return {
      id: report.id,
      cycleId: report.cycleId,
      userId: report.userId,
      reportType: report.reportType as 'individual' | 'group',
      metrics: report.metrics as MonthlyReportResponse['metrics'],
      insights: (report.insights as ReportInsight[] | null) ?? [],
      sharingSettings: (report.sharingSettings as MonthlyReportResponse['sharingSettings']) ?? null,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
