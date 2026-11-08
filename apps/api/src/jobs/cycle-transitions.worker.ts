import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { JobsService } from './jobs.service.js';

export interface CycleTransitionResult {
  cycleId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
}

@Injectable()
export class CycleTransitionsWorker implements OnModuleInit {
  private readonly logger = new Logger(CycleTransitionsWorker.name);

  constructor(
    @Inject(JobsService) private readonly jobsService: JobsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  onModuleInit(): void {
    this.jobsService.registerWorker('cycles', async () => {
      return this.scanAndAdvanceCycles();
    });
  }

  async scanAndAdvanceCycles(): Promise<CycleTransitionResult[]> {
    const now = this.clock.now();
    const transitions: CycleTransitionResult[] = [];

    // 1. Advance submission_open -> group_review when past submissionDeadline
    const submissionOpenCycles = await this.prisma.monthlyCycle.findMany({
      where: {
        status: 'submission_open',
        submissionDeadline: { lte: now },
      },
    });

    for (const cycle of submissionOpenCycles) {
      await this.prisma.$transaction(async (tx) => {
        await tx.monthlyCycle.update({
          where: { id: cycle.id },
          data: { status: 'group_review' },
        });

        // Ensure group_reviews row exists
        await tx.groupReview.upsert({
          where: { cycleId: cycle.id },
          create: { cycleId: cycle.id },
          update: {},
        });
      });

      this.logger.log(
        `Cycle ${cycle.id} auto-advanced submission_open -> group_review (past deadline).`
      );
      transitions.push({
        cycleId: cycle.id,
        fromStatus: 'submission_open',
        toStatus: 'group_review',
        reason: 'submission_deadline_passed',
      });
    }

    // 2. Advance group_review -> planning when past reviewDeadline
    const groupReviewCycles = await this.prisma.monthlyCycle.findMany({
      where: {
        status: 'group_review',
        reviewDeadline: { lte: now },
      },
    });

    for (const cycle of groupReviewCycles) {
      await this.prisma.$transaction(async (tx) => {
        // Complete review and lock all submitted goals
        await tx.groupReview.upsert({
          where: { cycleId: cycle.id },
          create: { cycleId: cycle.id, completedAt: now },
          update: { completedAt: now },
        });

        await tx.monthlySubmission.updateMany({
          where: {
            cycleId: cycle.id,
            status: 'submitted',
          },
          data: {
            status: 'locked',
            lockedAt: now,
          },
        });

        await tx.monthlyCycle.update({
          where: { id: cycle.id },
          data: { status: 'planning' },
        });
      });

      this.logger.log(
        `Cycle ${cycle.id} auto-advanced group_review -> planning (past review deadline).`
      );
      transitions.push({
        cycleId: cycle.id,
        fromStatus: 'group_review',
        toStatus: 'planning',
        reason: 'review_deadline_passed',
      });
    }

    // 3. Advance planning -> execution when all participating members have approved baseline plans
    const planningCycles = await this.prisma.monthlyCycle.findMany({
      where: { status: 'planning' },
    });

    for (const cycle of planningCycles) {
      const lockedSubmissions = await this.prisma.monthlySubmission.findMany({
        where: { cycleId: cycle.id, status: 'locked' },
        select: { userId: true },
      });

      const participatingUserIds = lockedSubmissions.map((s) => s.userId);

      if (participatingUserIds.length > 0) {
        const approvedBaselinesCount = await this.prisma.planVersion.count({
          where: {
            cycleId: cycle.id,
            userId: { in: participatingUserIds },
            isBaseline: true,
            approvalStatus: 'approved',
          },
        });

        if (approvedBaselinesCount >= participatingUserIds.length) {
          await this.prisma.monthlyCycle.update({
            where: { id: cycle.id },
            data: { status: 'execution' },
          });

          this.logger.log(
            `Cycle ${cycle.id} auto-advanced planning -> execution (all baseline plans approved).`
          );
          transitions.push({
            cycleId: cycle.id,
            fromStatus: 'planning',
            toStatus: 'execution',
            reason: 'all_baseline_plans_approved',
          });
        }
      }
    }

    // 4. Advance execution -> completed when cycle month has ended
    const executionCycles = await this.prisma.monthlyCycle.findMany({
      where: { status: 'execution' },
    });

    for (const cycle of executionCycles) {
      // Month ends at 00:00 UTC on the 1st of the next month
      const monthEndUtc = Date.UTC(cycle.year, cycle.month, 1, 0, 0, 0, 0);
      if (now.getTime() >= monthEndUtc) {
        await this.prisma.monthlyCycle.update({
          where: { id: cycle.id },
          data: { status: 'completed' },
        });

        this.logger.log(`Cycle ${cycle.id} auto-advanced execution -> completed (month ended).`);
        transitions.push({
          cycleId: cycle.id,
          fromStatus: 'execution',
          toStatus: 'completed',
          reason: 'cycle_month_ended',
        });
      }
    }

    return transitions;
  }
}
