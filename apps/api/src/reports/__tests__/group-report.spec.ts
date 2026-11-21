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
    findMany: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
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
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

interface MockCycleStateService {
  assertAllows: ReturnType<typeof vi.fn>;
}

interface MockAiService {
  generateStructured: ReturnType<typeof vi.fn>;
}

describe('ReportsService (P62 - Group Report & Privacy Controls)', () => {
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

  const mockMembers = [
    {
      groupId: 'group-uuid-1',
      userId: 'user-a',
      role: 'owner',
      user: { id: 'user-a', displayName: 'Alice' },
    },
    {
      groupId: 'group-uuid-1',
      userId: 'user-b',
      role: 'member',
      user: { id: 'user-b', displayName: 'Bob' },
    },
  ];

  const mockIndividualReports = [
    {
      id: 'report-a',
      cycleId: 'cycle-uuid-1',
      userId: 'user-a',
      reportType: 'individual',
      metrics: {
        weightedAchievement: { value: { score: 90 } },
        taskExecution: { value: { completedTasks: 18 } },
        consistency: { value: { activeDaysRatio: 80 } },
      },
      sharingSettings: {
        shareAchievementRate: true,
        shareCompletedTasksCount: true,
        shareConsistencyScore: true,
        shareGoalTitles: true, // Alice shares goal titles
      },
      createdAt: new Date('2026-12-01T00:00:00Z'),
    },
    {
      id: 'report-b',
      cycleId: 'cycle-uuid-1',
      userId: 'user-b',
      reportType: 'individual',
      metrics: {
        weightedAchievement: { value: { score: 70 } },
        taskExecution: { value: { completedTasks: 10 } },
        consistency: { value: { activeDaysRatio: 60 } },
      },
      sharingSettings: {
        shareAchievementRate: false, // Bob hides achievement rate
        shareCompletedTasksCount: true,
        shareConsistencyScore: true,
        shareGoalTitles: false, // Bob hides goal titles
      },
      createdAt: new Date('2026-12-01T00:00:00Z'),
    },
  ];

  const mockSubmissions = [
    {
      userId: 'user-a',
      goals: [
        { title: 'Alice Goal 1', position: 0 },
        { title: 'Alice Goal 2', position: 1 },
      ],
    },
    {
      userId: 'user-b',
      goals: [{ title: 'Secret Bob Goal', position: 0 }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      monthlyCycle: {
        findUnique: vi.fn().mockResolvedValue(mockCycle),
      },
      groupMember: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where?.groupId_userId?.userId === 'user-a') {
            return Promise.resolve(mockMembers[0]);
          }
          if (where?.groupId_userId?.userId === 'user-b') {
            return Promise.resolve(mockMembers[1]);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue(mockMembers),
      },
      monthlySubmission: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue(mockSubmissions),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      planVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      monthlyReport: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue(mockIndividualReports),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'group-report-1',
            ...data,
            createdAt: new Date('2026-12-01T00:00:00Z'),
          })
        ),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'group-report-1',
            cycleId: 'cycle-uuid-1',
            userId: null,
            reportType: 'group',
            ...data,
            createdAt: new Date('2026-12-01T00:00:00Z'),
          })
        ),
      },
    };

    mockCycleStateService = {
      assertAllows: vi.fn(),
    };

    mockAiService = {
      generateStructured: vi.fn(),
    };

    service = new ReportsService(
      mockPrisma as unknown as PrismaService,
      mockCycleStateService as unknown as CycleStateService,
      mockAiService as unknown as AiService
    );
  });

  it('should generate aggregated group report respecting individual privacy settings', async () => {
    const groupReport = await service.getGroupReport('cycle-uuid-1', 'user-a');

    expect(groupReport.reportType).toBe('group');
    expect(groupReport.metrics.totalMembers).toBe(2);
    expect(groupReport.metrics.participatingMembers).toBe(2);

    // Alice shared achievement (90%), Bob hid achievement (null)
    // Average achievement should only average non-null values -> 90%
    expect(groupReport.metrics.averageAchievementRate).toBe(90);

    // Both shared completed tasks: 18 + 10 = 28
    expect(groupReport.metrics.totalCompletedTasks).toBe(28);

    // Both shared consistency: (80 + 60) / 2 = 70%
    expect(groupReport.metrics.averageConsistency).toBe(70);

    // Member summaries privacy checks:
    const aliceSummary = groupReport.metrics.memberSummaries.find((m) => m.userId === 'user-a');
    const bobSummary = groupReport.metrics.memberSummaries.find((m) => m.userId === 'user-b');

    expect(aliceSummary?.achievementRate).toBe(90);
    expect(aliceSummary?.goalTitles).toEqual(['Alice Goal 1', 'Alice Goal 2']);

    // Bob opted out of sharing achievement and goal titles:
    expect(bobSummary?.achievementRate).toBeNull();
    expect(bobSummary?.goalTitles).toEqual([]); // Privacy preserved: secret goal never appears!

    // Verify DB invariant: user_id must be null for group reports
    expect(mockPrisma.monthlyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportType: 'group',
          userId: null,
        }),
      })
    );
  });

  it('should update sharing settings for a member', async () => {
    mockPrisma.monthlyReport.findFirst.mockResolvedValueOnce({
      id: 'report-a',
      cycleId: 'cycle-uuid-1',
      userId: 'user-a',
      reportType: 'individual',
    });

    const newSettings = {
      shareAchievementRate: false,
      shareCompletedTasksCount: false,
      shareConsistencyScore: false,
      shareGoalTitles: false,
    };

    const updated = await service.updateSharingSettings('cycle-uuid-1', 'user-a', newSettings);
    expect(updated).toEqual(newSettings);
    expect(mockPrisma.monthlyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-a' },
        data: { sharingSettings: newSettings },
      })
    );
  });

  it('should throw NotFoundException if caller is not a group member', async () => {
    await expect(service.getGroupReport('cycle-uuid-1', 'non-member-user')).rejects.toThrow(
      NotFoundException
    );
  });
});
