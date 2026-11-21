import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { CycleStateService } from '../../cycles/cycle-state.service.js';
import type { AiService } from '../../ai/ai.service.js';
import { ReportsService } from '../reports.service.js';

interface MockPrisma {
  monthlyCycle: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  groupMember: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  task: {
    findMany: ReturnType<typeof vi.fn>;
  };
  taskLog: {
    findMany: ReturnType<typeof vi.fn>;
  };
  planVersion: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  monthlyReport: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

interface MockCycleStateService {
  assertAllows: ReturnType<typeof vi.fn>;
}

interface MockAiService {
  generateStructured: ReturnType<typeof vi.fn>;
}

describe('ReportsService (P61 - Individual Report Generation)', () => {
  let service: ReportsService;
  let mockPrisma: MockPrisma;
  let mockCycleStateService: MockCycleStateService;
  let mockAiService: MockAiService;

  const mockCycle = {
    id: 'cycle-uuid-1',
    groupId: 'group-uuid-1',
    year: 2026,
    month: 11,
    status: 'completed',
  };

  const mockMembership = {
    groupId: 'group-uuid-1',
    userId: 'user-uuid-1',
    role: 'member',
  };

  const mockSubmission = {
    id: 'sub-uuid-1',
    cycleId: 'cycle-uuid-1',
    userId: 'user-uuid-1',
    status: 'locked',
    goals: [
      {
        id: 'goal-uuid-1',
        title: 'Launch MVP',
        priority: 5,
        estimatedHours: 40,
        successCriteria: { type: 'binary' },
      },
    ],
  };

  const mockTasks = [
    {
      id: 'task-1',
      goalId: 'goal-uuid-1',
      planItemId: 'plan-item-1',
      title: 'Scaffold API',
      description: null,
      status: 'completed',
      scheduledDate: new Date('2026-11-05T00:00:00Z'),
      estimatedMinutes: 120,
      actualMinutes: 110,
      completedAt: new Date('2026-11-05T15:00:00Z'),
    },
  ];

  const mockLogs = [
    {
      id: 'log-1',
      taskId: 'task-1',
      action: 'complete',
      durationMinutes: 110,
      loggedAt: new Date('2026-11-05T15:00:00Z'),
      metadata: {},
    },
  ];

  const mockBaselinePlan = {
    id: 'plan-v1',
    isBaseline: true,
    planItems: [
      {
        id: 'plan-item-1',
        goalId: 'goal-uuid-1',
        itemType: 'daily_task',
        title: 'Scaffold API',
        description: null,
        plannedDate: new Date('2026-11-05T00:00:00Z'),
        weekNumber: 1,
        estimatedMinutes: 120,
        orderIndex: 0,
      },
    ],
  };

  const mockCreatedReportRow = {
    id: 'report-uuid-1',
    cycleId: 'cycle-uuid-1',
    userId: 'user-uuid-1',
    reportType: 'individual',
    metrics: {
      weightedAchievement: {
        value: { score: 100, totalWeight: 5, totalWeightedScore: 5, goals: [] },
        displayValue: '100%',
        formula: 'formula',
        inputs: {},
      },
      taskExecution: {
        value: {
          totalTasks: 1,
          completedTasks: 1,
          inProgressTasks: 0,
          pendingTasks: 0,
          postponedTasks: 0,
          cancelledTasks: 0,
          completionRate: 100,
          totalEstimatedMinutes: 120,
          totalActualMinutes: 110,
        },
        displayValue: '1/1 tasks (100%)',
        formula: 'formula',
        inputs: {},
      },
      estimateAccuracy: {
        value: {
          completedTasksCount: 1,
          totalEstimatedMinutes: 120,
          totalActualMinutes: 110,
          varianceMinutes: -10,
          accuracyRatio: 91.7,
          taskBreakdown: [],
        },
        displayValue: '91.7% accuracy',
        formula: 'formula',
        inputs: {},
      },
      consistency: {
        value: {
          activeDays: 1,
          totalCycleDays: 30,
          activeDaysRatio: 3.3,
          weeklyCompletion: [],
        },
        displayValue: '1/30 active days (3.3%)',
        formula: 'formula',
        inputs: {},
      },
      planComparison: {
        value: {
          baseline: {
            plannedTasks: 1,
            completedTasks: 1,
            completionRate: 100,
            plannedMinutes: 120,
            actualMinutes: 110,
          },
          currentPlan: {
            plannedTasks: 1,
            completedTasks: 1,
            completionRate: 100,
            plannedMinutes: 120,
            actualMinutes: 110,
          },
          scopeVariance: { addedTasks: 0, removedTasks: 0, rescheduledTasks: 0 },
        },
        displayValue: 'Baseline: 100% | Current: 100%',
        formula: 'formula',
        inputs: {},
      },
    },
    insights: [
      {
        id: 'ins-1',
        title: 'Strong Goal Delivery',
        observation: 'Delivered all priority goals within scheduled timeframe.',
        recommendation: 'Maintain continuous pacing into the next cycle.',
        citations: [
          {
            metricId: 'weighted_achievement',
            metricValue: '100%',
            reason: 'Primary goals completed with all success criteria fulfilled',
          },
        ],
      },
    ],
    sharingSettings: {
      shareAchievementRate: true,
      shareCompletedTasksCount: true,
      shareConsistencyScore: true,
      shareGoalTitles: false,
    },
    createdAt: new Date('2026-12-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      monthlyCycle: {
        findUnique: vi.fn().mockResolvedValue(mockCycle),
      },
      groupMember: {
        findUnique: vi.fn().mockResolvedValue(mockMembership),
      },
      monthlySubmission: {
        findUnique: vi.fn().mockResolvedValue(mockSubmission),
      },
      task: {
        findMany: vi.fn().mockResolvedValue(mockTasks),
      },
      taskLog: {
        findMany: vi.fn().mockResolvedValue(mockLogs),
      },
      planVersion: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where?.isBaseline) return Promise.resolve(mockBaselinePlan);
          return Promise.resolve(mockBaselinePlan);
        }),
      },
      monthlyReport: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockCreatedReportRow),
      },
    };

    mockCycleStateService = {
      assertAllows: vi.fn(),
    };

    mockAiService = {
      generateStructured: vi.fn().mockResolvedValue({
        data: {
          insights: [
            {
              id: 'ins-1',
              title: 'Strong Goal Delivery',
              observation: 'Delivered all priority goals within scheduled timeframe.',
              recommendation: 'Maintain continuous pacing into the next cycle.',
              citations: [
                {
                  metricId: 'weighted_achievement',
                  metricValue: '100%',
                  reason: 'Primary goals completed with all success criteria fulfilled',
                },
              ],
            },
          ],
        },
      }),
    };

    service = new ReportsService(
      mockPrisma as unknown as PrismaService,
      mockCycleStateService as unknown as CycleStateService,
      mockAiService as unknown as AiService
    );
  });

  it('should generate an individual monthly report with pure metrics and AI insights', async () => {
    const report = await service.generateIndividualReport('cycle-uuid-1', 'user-uuid-1');

    expect(report.id).toBe('report-uuid-1');
    expect(report.cycleId).toBe('cycle-uuid-1');
    expect(report.userId).toBe('user-uuid-1');
    expect(report.reportType).toBe('individual');
    expect(report.metrics.weightedAchievement.value.score).toBe(100);
    expect(report.metrics.taskExecution.value.completedTasks).toBe(1);
    expect(report.insights).toHaveLength(1);
    expect(report.insights?.[0]?.citations[0]?.metricId).toBe('weighted_achievement');

    expect(mockPrisma.monthlyReport.create).toHaveBeenCalledTimes(1);
    expect(mockAiService.generateStructured).toHaveBeenCalledTimes(1);
  });

  it('should return existing report when called without regeneration note (idempotent)', async () => {
    mockPrisma.monthlyReport.findFirst.mockResolvedValueOnce(mockCreatedReportRow);

    const report = await service.generateIndividualReport('cycle-uuid-1', 'user-uuid-1');

    expect(report.id).toBe('report-uuid-1');
    // Did NOT call AI or create a new row
    expect(mockAiService.generateStructured).not.toHaveBeenCalled();
    expect(mockPrisma.monthlyReport.create).not.toHaveBeenCalled();
  });

  it('should regenerate report when explicit regeneration note is provided', async () => {
    mockPrisma.monthlyReport.findFirst.mockResolvedValueOnce(mockCreatedReportRow);

    const report = await service.generateIndividualReport(
      'cycle-uuid-1',
      'user-uuid-1',
      'Please recalculate with updated goal progress'
    );

    expect(report.id).toBe('report-uuid-1');
    expect(mockAiService.generateStructured).toHaveBeenCalledTimes(1);
    expect(mockPrisma.monthlyReport.create).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException if cycle does not exist', async () => {
    mockPrisma.monthlyCycle.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.generateIndividualReport('non-existent-cycle', 'user-uuid-1')
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if user is not a group member', async () => {
    mockPrisma.groupMember.findUnique.mockResolvedValueOnce(null);

    await expect(service.generateIndividualReport('cycle-uuid-1', 'foreign-user')).rejects.toThrow(
      NotFoundException
    );
  });

  it('should fall back to deterministic insights if AI returns insights lacking metric citations', async () => {
    mockAiService.generateStructured.mockResolvedValueOnce({
      data: {
        insights: [
          {
            id: 'bad-insight',
            title: 'No Citations',
            observation: 'No citations provided',
            recommendation: 'No citations provided',
            citations: [], // Invalid: missing citations
          },
        ],
      },
    });

    const report = await service.generateIndividualReport('cycle-uuid-1', 'user-uuid-1');
    expect(report).toBeDefined();
    expect(mockPrisma.monthlyReport.create).toHaveBeenCalledTimes(1);
  });
});
