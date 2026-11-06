import {
  Injectable,
  Inject,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CycleStateService } from '../cycles/cycle-state.service.js';
import { AiService } from '../ai/ai.service.js';
import { buildPlannerInput } from '../ai/planner-input.builder.js';
import {
  buildPlannerPrompt,
  PLANNER_PROMPT_ID,
  PLANNER_PROMPT_VERSION,
} from '../ai/prompts/planner-prompt.js';
import {
  planDecompositionSchema,
  type GeneratePlanInput,
  type PlanDecomposition,
} from '@mp/shared';

export interface PlanItemResponse {
  id: string;
  planVersionId: string;
  goalId?: string | null;
  itemType: string;
  title: string;
  description?: string | null;
  weekNumber?: number | null;
  estimatedMinutes: number;
  orderIndex: number;
  createdAt: string;
}

export interface PlanVersionResponse {
  id: string;
  cycleId: string;
  userId: string;
  versionNumber: number;
  versionType: string;
  approvalStatus: string;
  isBaseline: boolean;
  planSnapshot: PlanDecomposition;
  approvedAt?: string | null;
  createdAt: string;
  items: PlanItemResponse[];
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CycleStateService) private readonly cycleStateService: CycleStateService,
    @Inject(AiService) private readonly aiService: AiService
  ) {}

  async generatePlan(
    cycleId: string,
    userId: string,
    input?: GeneratePlanInput
  ): Promise<PlanVersionResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Cycle not found',
        },
      });
    }

    // Assert cycle state allows plan generation (must be in planning)
    this.cycleStateService.assertAllows(cycle, 'plan.generate');

    // Verify user is a member of the group
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: cycle.groupId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Cycle not found',
        },
      });
    }

    // Rate limit: max 3 generations per cycle per member
    const existingCount = await this.prisma.planVersion.count({
      where: {
        cycleId,
        userId,
      },
    });

    if (existingCount >= 3) {
      throw new HttpException(
        {
          error: {
            code: 'PLAN_GENERATION_LIMIT_EXCEEDED',
            message: 'Maximum of 3 plan generations reached for this cycle',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Extract caller's isolated input
    const plannerInput = await buildPlannerInput(cycleId, userId, this.prisma);

    // Build prompt templates
    const { systemPrompt, userPrompt } = buildPlannerPrompt(plannerInput, input?.adjustmentsNote);

    // Call LLM gateway with structured validation
    const aiResponse = await this.aiService.generateStructured({
      promptId: PLANNER_PROMPT_ID,
      promptVersion: PLANNER_PROMPT_VERSION,
      systemPrompt,
      userPrompt,
      schema: planDecompositionSchema,
      userId,
      actionType: 'plan_generation',
    });

    const decomposition = aiResponse.data;
    const versionNumber = existingCount + 1;
    const versionType = existingCount === 0 ? 'initial' : 'reoptimized';

    const result = await this.prisma.$transaction(
      async (tx) => {
        const planVersion = await tx.planVersion.create({
          data: {
            cycleId,
            userId,
            versionNumber,
            versionType,
            approvalStatus: 'pending',
            isBaseline: false,
            planSnapshot: decomposition as unknown as Prisma.InputJsonValue,
          },
        });

        const planItems = await Promise.all(
          decomposition.milestones.map((m, idx) =>
            tx.planItem.create({
              data: {
                planVersionId: planVersion.id,
                itemType: 'milestone',
                title: m.title,
                description: m.description ?? null,
                weekNumber: m.targetWeek,
                estimatedMinutes: m.estimatedMinutes,
                orderIndex: idx,
              },
            })
          )
        );

        return { planVersion, planItems };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return {
      id: result.planVersion.id,
      cycleId: result.planVersion.cycleId,
      userId: result.planVersion.userId,
      versionNumber: result.planVersion.versionNumber,
      versionType: result.planVersion.versionType,
      approvalStatus: result.planVersion.approvalStatus,
      isBaseline: result.planVersion.isBaseline,
      planSnapshot: result.planVersion.planSnapshot as unknown as PlanDecomposition,
      approvedAt: result.planVersion.approvedAt?.toISOString() ?? null,
      createdAt: result.planVersion.createdAt.toISOString(),
      items: result.planItems.map((item) => ({
        id: item.id,
        planVersionId: item.planVersionId,
        goalId: item.goalId,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        weekNumber: item.weekNumber,
        estimatedMinutes: item.estimatedMinutes,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async getLatestPlan(cycleId: string, userId: string): Promise<PlanVersionResponse | null> {
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

    // Try first approved/baseline, else latest created
    const planVersion = await this.prisma.planVersion.findFirst({
      where: { cycleId, userId },
      orderBy: [{ isBaseline: 'desc' }, { versionNumber: 'desc' }],
      include: {
        planItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!planVersion) {
      return null;
    }

    return {
      id: planVersion.id,
      cycleId: planVersion.cycleId,
      userId: planVersion.userId,
      versionNumber: planVersion.versionNumber,
      versionType: planVersion.versionType,
      approvalStatus: planVersion.approvalStatus,
      isBaseline: planVersion.isBaseline,
      planSnapshot: planVersion.planSnapshot as unknown as PlanDecomposition,
      approvedAt: planVersion.approvedAt?.toISOString() ?? null,
      createdAt: planVersion.createdAt.toISOString(),
      items: planVersion.planItems.map((item) => ({
        id: item.id,
        planVersionId: item.planVersionId,
        goalId: item.goalId,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        weekNumber: item.weekNumber,
        estimatedMinutes: item.estimatedMinutes,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
}
