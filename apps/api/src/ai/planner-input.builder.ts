import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type {
  PlannerInput,
  PlannerGoal,
  SuccessCriteria,
  AvailabilityInput,
  ConstraintsInput,
} from '@mp/shared';

export interface PlannerInputBuilderPrisma {
  monthlyCycle: {
    findUnique(args: {
      where: { id: string };
      select?: { id: true; status: true; year: true; month: true };
    }): Promise<{ id: string; status: string; year: number; month: number } | null>;
  };
  profile: {
    findUnique(args: {
      where: { id: string };
      select?: { id: true; timezone: true };
    }): Promise<{ id: string; timezone: string } | null>;
  };
  monthlySubmission: {
    findUnique(args: {
      where: { cycleId_userId: { cycleId: string; userId: string } };
      include?: {
        goals: {
          orderBy: { position: 'asc' };
        };
      };
    }): Promise<{
      id: string;
      cycleId: string;
      userId: string;
      status: string;
      availability: unknown;
      constraints: unknown;
      goals: Array<{
        id: string;
        position: number;
        title: string;
        description: string | null;
        category: string | null;
        priority: number;
        estimatedHours: number | null;
        deadline: Date | null;
        successCriteria: unknown;
        dependencies: unknown;
      }>;
    } | null>;
  };
}

export async function buildPlannerInput(
  cycleId: string,
  userId: string,
  prisma: PlannerInputBuilderPrisma | PrismaService
): Promise<PlannerInput> {
  const cycle = await prisma.monthlyCycle.findUnique({
    where: { id: cycleId },
    select: { id: true, status: true, year: true, month: true },
  });

  if (!cycle) {
    throw new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Cycle not found',
      },
    });
  }

  if (cycle.status !== 'planning') {
    throw new BadRequestException({
      error: {
        code: 'CYCLE_STATE_INVALID',
        message: `Plan generation requires cycle phase "planning", but current phase is "${cycle.status}"`,
        details: { phase: cycle.status },
      },
    });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });

  if (!profile) {
    throw new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'User profile not found',
      },
    });
  }

  // Query strictly for caller's submission and goals
  const submission = await prisma.monthlySubmission.findUnique({
    where: {
      cycleId_userId: {
        cycleId,
        userId,
      },
    },
    include: {
      goals: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!submission) {
    throw new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Submission not found for this cycle',
      },
    });
  }

  if (submission.status !== 'locked') {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_FAILED',
        message: `Submission must be locked before generating a plan. Current status: "${submission.status}"`,
        details: { submissionStatus: submission.status },
      },
    });
  }

  const goals: PlannerGoal[] = submission.goals.map((g) => {
    let deps: number[] = [];
    if (Array.isArray(g.dependencies)) {
      deps = g.dependencies.filter((d): d is number => typeof d === 'number');
    }

    return {
      id: g.id,
      position: g.position,
      title: g.title,
      description: g.description ?? undefined,
      category: g.category ?? undefined,
      priority: g.priority,
      estimatedHours: g.estimatedHours ?? undefined,
      deadline: g.deadline ? g.deadline.toISOString().split('T')[0] : undefined,
      successCriteria: g.successCriteria ? (g.successCriteria as SuccessCriteria) : undefined,
      dependencies: deps,
    };
  });

  const availability = (submission.availability ?? { exceptions: [] }) as AvailabilityInput;
  const constraints = (submission.constraints ?? { fixedCommitments: [] }) as ConstraintsInput;

  return {
    cycleId: cycle.id,
    userId: profile.id,
    cycleMonth: cycle.month,
    cycleYear: cycle.year,
    timezone: profile.timezone,
    goals,
    availability,
    constraints,
    historicalStats: null,
  };
}
