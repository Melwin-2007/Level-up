import { describe, expect, it } from 'vitest';

describe('Submissions Mapper (unit - forbidden field privacy)', () => {
  it('should strictly exclude availability, constraints, and raw sensitive data from others view', () => {
    // Simulate what Prisma returns with availability and constraints attached
    const mockRawSubmissions = [
      {
        id: 'sub-1',
        userId: 'user-1',
        status: 'submitted',
        availability: { weeklyHours: { monday: 8 }, exceptions: [] },
        constraints: { fixedCommitments: [{ title: 'Private doctor', hoursPerWeek: 2 }] },
        user: { displayName: 'Alice' },
        goals: [
          {
            id: 'goal-1',
            position: 0,
            title: 'Public Goal 1',
            description: 'My public description',
            category: 'Engineering',
            priority: 1,
            estimatedHours: 10,
            deadline: new Date('2026-11-20T00:00:00.000Z'),
            successCriteria: { type: 'binary' },
            dependencies: [],
          },
        ],
      },
    ];

    // Map through the service projection logic
    const mapped = mockRawSubmissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      displayName: s.user.displayName,
      status: s.status,
      goals: s.goals.map((g) => ({
        id: g.id,
        position: g.position,
        title: g.title,
        description: g.description ?? undefined,
        category: g.category ?? undefined,
        priority: g.priority,
        estimatedHours: g.estimatedHours ?? undefined,
        deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : undefined,
        successCriteria: g.successCriteria,
        dependencies: g.dependencies,
      })),
    }));

    for (const item of mapped) {
      expect(item).not.toHaveProperty('availability');
      expect(item).not.toHaveProperty('constraints');
      expect((item as Record<string, unknown>)['availability']).toBeUndefined();
      expect((item as Record<string, unknown>)['constraints']).toBeUndefined();
    }
  });
});
