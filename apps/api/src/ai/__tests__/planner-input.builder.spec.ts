import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { buildPlannerInput, PlannerInputBuilderPrisma } from '../planner-input.builder.js';

describe('PlannerInputBuilder (P21)', () => {
  const cycleId = '22222222-2222-2222-2222-222222222222';
  const memberAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const memberBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const mockCycle = {
    id: cycleId,
    status: 'planning',
    year: 2026,
    month: 11,
  };

  const mockProfileA = {
    id: memberAId,
    timezone: 'Asia/Kolkata',
  };

  const mockSubmissionA = {
    id: 'sub-a-1',
    cycleId,
    userId: memberAId,
    status: 'locked',
    availability: {
      weeklyHours: {
        monday: 4,
        tuesday: 4,
        wednesday: 4,
        thursday: 4,
        friday: 4,
        saturday: 2,
        sunday: 0,
      },
      exceptions: [{ date: '2026-11-15', hours: 0, reason: 'Travel' }],
    },
    constraints: {
      fixedCommitments: [{ title: 'Team Meeting', hoursPerWeek: 5 }],
      maxDailyHours: 8,
    },
    goals: [
      {
        id: 'goal-a-1',
        position: 0,
        title: 'Launch MVP Feature',
        description: 'Complete end to end implementation',
        category: 'Engineering',
        priority: 1,
        estimatedHours: 25,
        deadline: new Date('2026-11-20T00:00:00Z'),
        successCriteria: { type: 'binary' },
        dependencies: [],
      },
      {
        id: 'goal-a-2',
        position: 1,
        title: 'User Testing',
        description: 'Test with 5 users',
        category: 'Product',
        priority: 2,
        estimatedHours: 10,
        deadline: new Date('2026-11-25T00:00:00Z'),
        successCriteria: { type: 'metric', target: 5, unit: 'users' },
        dependencies: [0],
      },
    ],
  };

  it('should build a complete PlannerInput matching expected structure', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: {
        findUnique: vi.fn().mockResolvedValue(mockCycle),
      },
      profile: {
        findUnique: vi.fn().mockResolvedValue(mockProfileA),
      },
      monthlySubmission: {
        findUnique: vi.fn().mockResolvedValue(mockSubmissionA),
      },
    };

    const result = await buildPlannerInput(cycleId, memberAId, mockPrisma);

    expect(result).toEqual({
      cycleId,
      userId: memberAId,
      cycleMonth: 11,
      cycleYear: 2026,
      timezone: 'Asia/Kolkata',
      goals: [
        {
          id: 'goal-a-1',
          position: 0,
          title: 'Launch MVP Feature',
          description: 'Complete end to end implementation',
          category: 'Engineering',
          priority: 1,
          estimatedHours: 25,
          deadline: '2026-11-20',
          successCriteria: { type: 'binary' },
          dependencies: [],
        },
        {
          id: 'goal-a-2',
          position: 1,
          title: 'User Testing',
          description: 'Test with 5 users',
          category: 'Product',
          priority: 2,
          estimatedHours: 10,
          deadline: '2026-11-25',
          successCriteria: { type: 'metric', target: 5, unit: 'users' },
          dependencies: [0],
        },
      ],
      availability: mockSubmissionA.availability,
      constraints: mockSubmissionA.constraints,
      historicalStats: null,
    });
  });

  it('should strictly isolate member data and never leak Member B into Member A input', async () => {
    const submissionFindUnique = vi.fn().mockImplementation(({ where }) => {
      // Simulate multi-member database: verify query keys
      if (where.cycleId_userId.userId === memberAId) {
        return Promise.resolve(mockSubmissionA);
      }
      if (where.cycleId_userId.userId === memberBId) {
        return Promise.resolve({
          id: 'sub-b-1',
          cycleId,
          userId: memberBId,
          status: 'locked',
          availability: { weeklyHours: { monday: 10 }, exceptions: [] },
          constraints: { fixedCommitments: [{ title: 'Secret B Job', hoursPerWeek: 40 }] },
          goals: [
            {
              id: 'goal-b-1',
              position: 0,
              title: 'Member B Private Secret Goal',
              priority: 1,
              dependencies: [],
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: { findUnique: vi.fn().mockResolvedValue(mockCycle) },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: { findUnique: submissionFindUnique },
    };

    const result = await buildPlannerInput(cycleId, memberAId, mockPrisma);

    // Verify submission query was strictly scoped to memberAId
    expect(submissionFindUnique).toHaveBeenCalledWith({
      where: {
        cycleId_userId: {
          cycleId,
          userId: memberAId,
        },
      },
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Verify zero data from Member B leaked into result
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Member B Private Secret Goal');
    expect(serialized).not.toContain('Secret B Job');
    expect(serialized).not.toContain(memberBId);
  });

  it('should reject when cycle phase is not planning', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: {
        findUnique: vi.fn().mockResolvedValue({ ...mockCycle, status: 'group_review' }),
      },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: { findUnique: vi.fn().mockResolvedValue(mockSubmissionA) },
    };

    await expect(buildPlannerInput(cycleId, memberAId, mockPrisma)).rejects.toThrow(
      BadRequestException
    );
  });

  it('should reject when submission is in draft status', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: { findUnique: vi.fn().mockResolvedValue(mockCycle) },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: {
        findUnique: vi.fn().mockResolvedValue({ ...mockSubmissionA, status: 'draft' }),
      },
    };

    await expect(buildPlannerInput(cycleId, memberAId, mockPrisma)).rejects.toThrow(
      BadRequestException
    );
  });

  it('should reject when submission is in submitted status but not locked', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: { findUnique: vi.fn().mockResolvedValue(mockCycle) },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: {
        findUnique: vi.fn().mockResolvedValue({ ...mockSubmissionA, status: 'submitted' }),
      },
    };

    await expect(buildPlannerInput(cycleId, memberAId, mockPrisma)).rejects.toThrow(
      BadRequestException
    );
  });

  it('should throw NotFoundException when cycle is not found', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: { findUnique: vi.fn().mockResolvedValue(null) },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: { findUnique: vi.fn().mockResolvedValue(mockSubmissionA) },
    };

    await expect(buildPlannerInput(cycleId, memberAId, mockPrisma)).rejects.toThrow(
      NotFoundException
    );
  });

  it('should throw NotFoundException when submission does not exist', async () => {
    const mockPrisma: PlannerInputBuilderPrisma = {
      monthlyCycle: { findUnique: vi.fn().mockResolvedValue(mockCycle) },
      profile: { findUnique: vi.fn().mockResolvedValue(mockProfileA) },
      monthlySubmission: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    await expect(buildPlannerInput(cycleId, memberAId, mockPrisma)).rejects.toThrow(
      NotFoundException
    );
  });
});
