import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CycleStateService } from '../cycles/cycle-state.service.js';
import { AiService } from '../ai/ai.service.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { buildPlannerInput } from '../ai/planner-input.builder.js';
import {
  buildPlannerPrompt,
  PLANNER_PROMPT_ID,
  PLANNER_PROMPT_VERSION,
} from '../ai/prompts/planner-prompt.js';
import {
  schedule,
  buildMonthAvailability,
  getDaysInMonth,
  calculateRemainingWork,
  type TaskCandidate,
  type TaskExecutionItem,
  type TaskExecutionStatus,
} from '@mp/scheduler';
import {
  planDecompositionSchema,
  type GeneratePlanInput,
  type ApprovePlanInput,
  type ReoptimizePlanInput,
  type PlanDecomposition,
  type PlanDiff,
} from '@mp/shared';

export interface PlanItemResponse {
  id: string;
  planVersionId: string;
  goalId?: string | null;
  itemType: string;
  title: string;
  description?: string | null;
  plannedDate?: string | null;
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
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(CLOCK) private readonly clock: Clock
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
    const versionType = 'initial';

    // Step 2 in Pipeline: Pass proposal through pure constraint scheduler
    const availability = buildMonthAvailability({
      year: plannerInput.cycleYear,
      month: plannerInput.cycleMonth,
      timezone: plannerInput.timezone,
      weeklyHours: plannerInput.availability?.weeklyHours,
      exceptions: plannerInput.availability?.exceptions,
    });

    const maxDailyMinutes = plannerInput.constraints?.maxDailyHours
      ? plannerInput.constraints.maxDailyHours * 60
      : undefined;

    const chunkThreshold = maxDailyMinutes ? Math.min(maxDailyMinutes, 120) : 120;
    const daysInMonth = getDaysInMonth(plannerInput.cycleYear, plannerInput.cycleMonth);
    const lastDayDate = `${plannerInput.cycleYear}-${String(plannerInput.cycleMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const taskCandidates: TaskCandidate[] = [];
    const candidateMetaMap = new Map<
      string,
      { goalId: string; title: string; targetWeek: number }
    >();

    for (let mIdx = 0; mIdx < decomposition.milestones.length; mIdx++) {
      const m = decomposition.milestones[mIdx]!;
      const goal = plannerInput.goals.find((g) => g.id === m.goalId);
      const priority = goal?.priority ?? 1;
      const deadline = goal?.deadline ?? lastDayDate;

      if (m.estimatedMinutes <= chunkThreshold) {
        const taskId = `m-${mIdx}`;
        taskCandidates.push({
          id: taskId,
          goalId: m.goalId,
          title: m.title,
          estimatedMinutes: m.estimatedMinutes,
          priority,
          deadline,
          dependencies: m.dependencies,
        });
        candidateMetaMap.set(taskId, {
          goalId: m.goalId,
          title: m.title,
          targetWeek: m.targetWeek,
        });
      } else {
        const numChunks = Math.ceil(m.estimatedMinutes / chunkThreshold);
        const baseChunkMinutes = Math.floor(m.estimatedMinutes / numChunks);
        const remainderMinutes = m.estimatedMinutes % numChunks;

        for (let c = 0; c < numChunks; c++) {
          const taskId = `m-${mIdx}-c${c}`;
          const duration = baseChunkMinutes + (c === 0 ? remainderMinutes : 0);
          const prevChunkId = c > 0 ? `m-${mIdx}-c${c - 1}` : undefined;
          const deps = prevChunkId ? [prevChunkId] : m.dependencies;

          taskCandidates.push({
            id: taskId,
            goalId: m.goalId,
            title: `${m.title} (Part ${c + 1}/${numChunks})`,
            estimatedMinutes: duration,
            priority,
            deadline,
            dependencies: deps,
          });

          candidateMetaMap.set(taskId, {
            goalId: m.goalId,
            title: `${m.title} (Part ${c + 1}/${numChunks})`,
            targetWeek: m.targetWeek,
          });
        }
      }
    }

    const schedulerOutput = schedule({
      tasks: taskCandidates,
      availability,
      maxDailyMinutes,
    });

    // If scheduler flags unscheduled work, name the tradeoff in plain language
    if (schedulerOutput.unscheduled.length > 0) {
      decomposition.tradeoffs = schedulerOutput.tradeoffs;

      if (!decomposition.feasibility.conflicts) {
        decomposition.feasibility.conflicts = [];
      }

      for (const u of schedulerOutput.unscheduled) {
        decomposition.feasibility.conflicts.push({
          type: 'capacity',
          description: `[SCHEDULER] ${u.details}`,
          goalIds: [u.goalId],
        });
      }

      if (decomposition.feasibility.verdict === 'feasible') {
        decomposition.feasibility.verdict = 'tight';
      }

      if (schedulerOutput.unscheduled.length > schedulerOutput.scheduled.length) {
        decomposition.feasibility.verdict = 'infeasible';
      }
    }

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

        const milestonePlanItems = await Promise.all(
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

        let orderIndex = decomposition.milestones.length;
        const dailyPlanItems = await Promise.all(
          schedulerOutput.scheduled.map((st) => {
            const meta = candidateMetaMap.get(st.taskId);
            const dayNum = Number(st.date.split('-')[2]);
            const weekNumber = Math.min(5, Math.ceil(dayNum / 7));

            const startH = String(Math.floor(st.startMinute / 60)).padStart(2, '0');
            const startM = String(st.startMinute % 60).padStart(2, '0');
            const endH = String(Math.floor(st.endMinute / 60)).padStart(2, '0');
            const endM = String(st.endMinute % 60).padStart(2, '0');

            return tx.planItem.create({
              data: {
                planVersionId: planVersion.id,
                itemType: 'daily_task',
                title: meta?.title ?? 'Daily Task',
                description: `Scheduled: ${startH}:${startM} - ${endH}:${endM}`,
                plannedDate: new Date(`${st.date}T00:00:00.000Z`),
                weekNumber,
                estimatedMinutes: st.durationMinutes,
                orderIndex: orderIndex++,
              },
            });
          })
        );

        return { planVersion, planItems: [...milestonePlanItems, ...dailyPlanItems] };
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
        plannedDate: item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : null,
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
        plannedDate: item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : null,
        weekNumber: item.weekNumber,
        estimatedMinutes: item.estimatedMinutes,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async approvePlan(
    cycleId: string,
    userId: string,
    input: ApprovePlanInput
  ): Promise<PlanVersionResponse> {
    const cycle = await this.prisma.monthlyCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    // 1. Assert cycle state allows plan approval (must be in planning)
    this.cycleStateService.assertAllows(cycle, 'plan.approve');

    // 2. Verify caller is a member of the group
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
        error: { code: 'NOT_FOUND', message: 'Cycle not found' },
      });
    }

    // 3. Find the target plan version
    const planVersion = await this.prisma.planVersion.findUnique({
      where: { id: input.planVersionId },
      include: {
        planItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!planVersion || planVersion.cycleId !== cycleId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Plan version not found for this cycle' },
      });
    }

    // 4. Verify ownership (private data isolation)
    if (planVersion.userId !== userId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Plan version not found for this cycle' },
      });
    }

    // 5. Verify pending status
    if (planVersion.approvalStatus !== 'pending') {
      throw new ConflictException({
        code: 'CYCLE_STATE_INVALID',
        message: `Plan version has already been ${planVersion.approvalStatus}`,
        details: { approvalStatus: planVersion.approvalStatus },
      });
    }

    // 6. Atomically approve and promote to baseline (or sync future tasks if reoptimized)
    const now = this.clock.now();
    const approvedVersion = await this.prisma.$transaction(async (tx) => {
      // Re-verify pending state inside transaction for race condition protection
      const current = await tx.planVersion.findUnique({
        where: { id: input.planVersionId },
      });

      if (!current || current.approvalStatus !== 'pending') {
        throw new ConflictException({
          code: 'CYCLE_STATE_INVALID',
          message: 'Plan version has already been approved or rejected',
        });
      }

      const isReoptimized = current.versionType === 'reoptimized';

      if (!isReoptimized) {
        // Initial plan approval: promote to baseline
        const existingBaseline = await tx.planVersion.findFirst({
          where: {
            cycleId,
            userId,
            isBaseline: true,
          },
        });

        if (existingBaseline) {
          throw new ConflictException({
            code: 'CYCLE_STATE_INVALID',
            message: 'A baseline plan has already been approved for this member in this cycle',
          });
        }
      }

      const updated = await tx.planVersion.update({
        where: { id: input.planVersionId },
        data: {
          approvalStatus: 'approved',
          approvedAt: now,
          isBaseline: !isReoptimized,
        },
        include: {
          planItems: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      if (isReoptimized) {
        // Task Sync for reoptimized plan:
        // 1. Fetch existing tasks
        const existingTasks = await tx.task.findMany({
          where: { cycleId, userId },
        });

        const newDailyTasks = updated.planItems.filter((item) => item.itemType === 'daily_task');
        const matchedItemIds = new Set<string>();

        // 2. Process existing tasks: preserve completed/cancelled untouched, sync or cancel uncompleted
        for (const t of existingTasks) {
          // NEVER touch completed or already cancelled tasks
          if (t.status === 'completed' || t.status === 'cancelled' || t.completedAt != null) {
            continue;
          }

          // Match by title & goalId
          const matchingItem = newDailyTasks.find(
            (item) =>
              !matchedItemIds.has(item.id) &&
              item.title === t.title &&
              (item.goalId ?? null) === (t.goalId ?? null)
          );

          if (matchingItem) {
            matchedItemIds.add(matchingItem.id);
            await tx.task.update({
              where: { id: t.id },
              data: {
                scheduledDate: matchingItem.plannedDate,
                estimatedMinutes: matchingItem.estimatedMinutes,
                planItemId: matchingItem.id,
                status: t.status === 'paused' || t.status === 'postponed' ? 'pending' : t.status,
              },
            });
          } else {
            // Task was removed in reoptimization -> mark cancelled
            await tx.task.update({
              where: { id: t.id },
              data: {
                status: 'cancelled',
              },
            });
          }
        }

        // 3. Materialize newly added tasks that didn't match existing tasks
        const newlyAddedItems = newDailyTasks.filter((item) => !matchedItemIds.has(item.id));
        if (newlyAddedItems.length > 0) {
          await tx.task.createMany({
            data: newlyAddedItems.map((item) => ({
              cycleId,
              userId,
              goalId: item.goalId,
              planItemId: item.id,
              title: item.title,
              description: item.description,
              status: 'pending',
              scheduledDate: item.plannedDate,
              estimatedMinutes: item.estimatedMinutes,
            })),
          });
        }
      } else {
        // Initial plan task materialization
        const dailyTasks = updated.planItems.filter((item) => item.itemType === 'daily_task');
        if (dailyTasks.length > 0) {
          const existingTasks = await tx.task.findMany({
            where: {
              planItemId: { in: dailyTasks.map((i) => i.id) },
            },
            select: { planItemId: true },
          });
          const existingItemIds = new Set(existingTasks.map((t) => t.planItemId));

          const tasksToCreate = dailyTasks
            .filter((item) => !existingItemIds.has(item.id))
            .map((item) => ({
              cycleId,
              userId,
              goalId: item.goalId,
              planItemId: item.id,
              title: item.title,
              description: item.description,
              status: 'pending',
              scheduledDate: item.plannedDate,
              estimatedMinutes: item.estimatedMinutes,
            }));

          if (tasksToCreate.length > 0) {
            await tx.task.createMany({
              data: tasksToCreate,
            });
          }
        }
      }

      // 7. Check if all members with locked submissions have approved plans (initial planning phase only)
      if (!isReoptimized) {
        const lockedSubmissions = await tx.monthlySubmission.findMany({
          where: {
            cycleId,
            status: 'locked',
          },
          select: { userId: true },
        });

        const participatingUserIds = lockedSubmissions.map((s) => s.userId);

        if (participatingUserIds.length > 0) {
          const approvedBaselinesCount = await tx.planVersion.count({
            where: {
              cycleId,
              userId: { in: participatingUserIds },
              isBaseline: true,
              approvalStatus: 'approved',
            },
          });

          if (approvedBaselinesCount >= participatingUserIds.length) {
            await tx.monthlyCycle.update({
              where: { id: cycleId },
              data: { status: 'execution' },
            });
            this.logger.log(
              `All ${participatingUserIds.length} participating members have approved baseline plans. Cycle ${cycleId} advanced to 'execution'.`
            );
          }
        }
      }

      return updated;
    });

    return {
      id: approvedVersion.id,
      cycleId: approvedVersion.cycleId,
      userId: approvedVersion.userId,
      versionNumber: approvedVersion.versionNumber,
      versionType: approvedVersion.versionType,
      approvalStatus: approvedVersion.approvalStatus,
      isBaseline: approvedVersion.isBaseline,
      planSnapshot: approvedVersion.planSnapshot as unknown as PlanDecomposition,
      approvedAt: approvedVersion.approvedAt?.toISOString() ?? null,
      createdAt: approvedVersion.createdAt.toISOString(),
      items: approvedVersion.planItems.map((item) => ({
        id: item.id,
        planVersionId: item.planVersionId,
        goalId: item.goalId,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        plannedDate: item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : null,
        weekNumber: item.weekNumber,
        estimatedMinutes: item.estimatedMinutes,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async reoptimizePlan(
    cycleId: string,
    userId: string,
    input: ReoptimizePlanInput
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

    // Must be in execution phase
    this.cycleStateService.assertAllows(cycle, 'plan.reoptimize');

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
      throw new HttpException(
        {
          error: {
            code: 'FORBIDDEN',
            message: "You are not a member of this cycle's group",
          },
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Fetch member's latest approved plan
    const approvedPlan = await this.prisma.planVersion.findFirst({
      where: {
        cycleId,
        userId,
        approvalStatus: 'approved',
      },
      orderBy: {
        versionNumber: 'desc',
      },
      include: {
        planItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!approvedPlan) {
      throw new NotFoundException({
        error: {
          code: 'NO_APPROVED_PLAN',
          message: 'No approved plan exists to reoptimize for this cycle',
        },
      });
    }

    const nowIso = this.clock.now().toISOString();
    const today = nowIso.slice(0, 10);
    const daysInCycleMonth = getDaysInMonth(cycle.year, cycle.month);
    const cycleStartDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-01`;
    const cycleEndDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-${String(daysInCycleMonth).padStart(2, '0')}`;

    // Fetch existing tasks
    const currentTasks = await this.prisma.task.findMany({
      where: { cycleId, userId },
      orderBy: { scheduledDate: 'asc' },
    });

    // Fetch availability
    const submission = await this.prisma.monthlySubmission.findUnique({
      where: {
        cycleId_userId: { cycleId, userId },
      },
    });
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    const userTimezone = profile?.timezone ?? 'UTC';

    const availabilityRaw = (submission?.availability as Record<string, unknown> | null) ?? null;
    const weeklyHours = availabilityRaw?.weeklyHours as Partial<Record<string, number>> | undefined;
    const exceptions = availabilityRaw?.exceptions as
      Array<{ date: string; hours: number; reason?: string }> | undefined;

    const monthAvailability = buildMonthAvailability({
      year: cycle.year,
      month: cycle.month,
      timezone: userTimezone,
      weeklyHours,
      exceptions,
    });

    const taskExecutionItems: TaskExecutionItem[] = currentTasks.map((t) => ({
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

    // If no materialized tasks exist, derive task items from approved plan daily_tasks
    if (taskExecutionItems.length === 0) {
      const dailyItems = approvedPlan.planItems.filter((i) => i.itemType === 'daily_task');
      for (const item of dailyItems) {
        taskExecutionItems.push({
          id: item.id,
          goalId: item.goalId,
          planItemId: item.id,
          title: item.title,
          status: 'pending',
          scheduledDate: item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : null,
          estimatedMinutes: item.estimatedMinutes,
        });
      }
    }

    const remainingWork = calculateRemainingWork({
      today,
      cycleStartDate,
      cycleEndDate,
      availability: monthAvailability,
      currentTasks: taskExecutionItems,
    });

    // Schedule reschedule candidates into remaining availability
    const remainingAvailability = monthAvailability.filter(
      (d) => d.date >= today && d.date <= cycleEndDate
    );

    const schedulerOutput = schedule({
      tasks: remainingWork.rescheduleCandidates,
      availability: remainingAvailability,
    });

    // Compute plan diff comparing uncompleted tasks against scheduled tasks
    const scheduledTaskMap = new Map<string, (typeof schedulerOutput.scheduled)[number]>();
    for (const st of schedulerOutput.scheduled) {
      scheduledTaskMap.set(st.taskId, st);
    }

    const movedTasks: Array<{
      taskId: string;
      title: string;
      fromDate?: string | null;
      toDate?: string | null;
    }> = [];
    const removedTasks: Array<{
      taskId: string;
      title: string;
      originalDate?: string | null;
      estimatedMinutes: number;
    }> = [];

    for (const t of taskExecutionItems) {
      if (t.status === 'completed' || t.status === 'cancelled') {
        continue;
      }
      const st = scheduledTaskMap.get(t.id);
      const originalDate = t.scheduledDate ?? null;
      if (st) {
        if (st.date !== originalDate) {
          movedTasks.push({
            taskId: t.id,
            title: t.title,
            fromDate: originalDate,
            toDate: st.date,
          });
        }
      } else {
        removedTasks.push({
          taskId: t.id,
          title: t.title,
          originalDate,
          estimatedMinutes: t.estimatedMinutes,
        });
      }
    }

    const diff: PlanDiff = {
      movedTasks,
      addedTasks: [],
      removedTasks,
      summary: `${movedTasks.length} tasks rescheduled, ${removedTasks.length} tasks unscheduled across remaining days.`,
    };

    const oldSnapshot = approvedPlan.planSnapshot as unknown as PlanDecomposition;
    const decomposition: PlanDecomposition = {
      feasibility: {
        verdict: remainingWork.isFeasible
          ? remainingWork.capacityDeficitMinutes === 0
            ? 'feasible'
            : 'tight'
          : 'infeasible',
        totalEstimatedHours: Math.round((remainingWork.totalRemainingMinutes / 60) * 10) / 10,
        totalAvailableHours: Math.round((remainingWork.remainingCapacityMinutes / 60) * 10) / 10,
        capacityRatio:
          remainingWork.remainingCapacityMinutes > 0
            ? Math.round(
                (remainingWork.totalRemainingMinutes / remainingWork.remainingCapacityMinutes) * 100
              ) / 100
            : 1,
        goalVerdicts: remainingWork.goalSummaries.map((g) => ({
          goalId: g.goalId,
          status: g.slippedTasks > 0 ? 'at_risk' : 'achievable',
          risks: g.slippedTasks > 0 ? [`${g.slippedTasks} tasks overdue`] : [],
          recommendations: g.slippedTasks > 0 ? ['Rescheduled to earlier available dates'] : [],
        })),
        conflicts:
          remainingWork.capacityDeficitMinutes > 0
            ? [
                {
                  type: 'capacity',
                  description: `Capacity deficit of ${remainingWork.capacityDeficitMinutes} minutes over remaining cycle duration`,
                  goalIds: remainingWork.goalSummaries.map((g) => g.goalId),
                },
              ]
            : [],
        rationale: `Reoptimization reason: "${input.reason}". ${diff.summary}`,
      },
      milestones: oldSnapshot.milestones ?? [],
      pacingSummary: `Reoptimized from ${today}: ${remainingWork.slippedTasks.length} slipped tasks recovered, ${schedulerOutput.scheduled.length} tasks scheduled over remaining period.`,
      tradeoffs: schedulerOutput.tradeoffs.map((t) => ({
        taskId: t.taskId,
        goalId: t.goalId,
        explanation: t.explanation,
      })),
      diff,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const highestVersion = await tx.planVersion.findFirst({
        where: { cycleId, userId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      const nextVersionNumber = (highestVersion?.versionNumber ?? approvedPlan.versionNumber) + 1;

      const newPlanVersion = await tx.planVersion.create({
        data: {
          cycleId,
          userId,
          versionNumber: nextVersionNumber,
          versionType: 'reoptimized',
          approvalStatus: 'pending',
          isBaseline: false,
          planSnapshot: decomposition as unknown as Prisma.InputJsonValue,
        },
      });

      const candidateMetaMap = new Map<string, TaskExecutionItem>();
      for (const t of taskExecutionItems) {
        candidateMetaMap.set(t.id, t);
      }

      await Promise.all(
        decomposition.milestones.map((m, idx) =>
          tx.planItem.create({
            data: {
              planVersionId: newPlanVersion.id,
              goalId: m.goalId ?? null,
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

      let orderIndex = decomposition.milestones.length;
      await Promise.all(
        schedulerOutput.scheduled.map((st) => {
          const meta = candidateMetaMap.get(st.taskId);
          const dayNum = Number(st.date.split('-')[2]);
          const weekNumber = Math.min(5, Math.ceil(dayNum / 7));

          const startH = String(Math.floor(st.startMinute / 60)).padStart(2, '0');
          const startM = String(st.startMinute % 60).padStart(2, '0');
          const endH = String(Math.floor(st.endMinute / 60)).padStart(2, '0');
          const endM = String(st.endMinute % 60).padStart(2, '0');

          return tx.planItem.create({
            data: {
              planVersionId: newPlanVersion.id,
              goalId: meta?.goalId && meta.goalId !== 'unassigned' ? meta.goalId : null,
              itemType: 'daily_task',
              title: meta?.title ?? 'Daily Task',
              description: `Scheduled: ${startH}:${startM} - ${endH}:${endM}`,
              plannedDate: new Date(`${st.date}T00:00:00.000Z`),
              weekNumber,
              estimatedMinutes: st.durationMinutes,
              orderIndex: orderIndex++,
            },
          });
        })
      );

      return tx.planVersion.findUniqueOrThrow({
        where: { id: newPlanVersion.id },
        include: {
          planItems: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });

    return {
      id: result.id,
      cycleId: result.cycleId,
      userId: result.userId,
      versionNumber: result.versionNumber,
      versionType: result.versionType,
      approvalStatus: result.approvalStatus,
      isBaseline: result.isBaseline,
      planSnapshot: result.planSnapshot as unknown as PlanDecomposition,
      approvedAt: result.approvedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
      items: result.planItems.map((item) => ({
        id: item.id,
        planVersionId: item.planVersionId,
        goalId: item.goalId,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        plannedDate: item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : null,
        weekNumber: item.weekNumber,
        estimatedMinutes: item.estimatedMinutes,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
}
