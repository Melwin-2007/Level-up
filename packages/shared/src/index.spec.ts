import { describe, expect, it } from 'vitest';
import {
  advanceCycleSchema,
  API_ERROR_CODES,
  createCycleSchema,
  createGroupSchema,
  CYCLE_STATUSES,
  goalInputSchema,
  GROUP_ROLES,
  joinGroupSchema,
  submissionInputSchema,
  SUBMISSION_STATUSES,
  updateProfileSchema,
} from './index.js';

describe('@mp/shared exports', () => {
  it('should expose API error codes and statuses', () => {
    expect(API_ERROR_CODES).toContain('SUBMISSION_LOCKED');
    expect(CYCLE_STATUSES).toContain('submission_open');
    expect(SUBMISSION_STATUSES).toContain('submitted');
    expect(GROUP_ROLES).toContain('owner');
  });

  it('should validate profile payload using updateProfileSchema', () => {
    // 1 char display name is valid (1-60)
    const valid = { displayName: 'A', timezone: 'Asia/Kolkata' };
    const parsed = updateProfileSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    // Default timezone works when omitted
    const withDefaultTz = updateProfileSchema.safeParse({ displayName: 'Bob' });
    expect(withDefaultTz.success).toBe(true);
    if (withDefaultTz.success) {
      expect(withDefaultTz.data.timezone).toBe('Asia/Kolkata');
    }

    // Empty display name is rejected
    const emptyName = updateProfileSchema.safeParse({ displayName: '', timezone: 'UTC' });
    expect(emptyName.success).toBe(false);

    // Over 60 characters is rejected
    const longName = updateProfileSchema.safeParse({
      displayName: 'A'.repeat(61),
      timezone: 'UTC',
    });
    expect(longName.success).toBe(false);

    // Invalid IANA timezone is rejected
    const invalidTz = updateProfileSchema.safeParse({
      displayName: 'Charlie',
      timezone: 'Mars/Phobos',
    });
    expect(invalidTz.success).toBe(false);
  });

  it('should validate createGroupSchema and joinGroupSchema', () => {
    expect(createGroupSchema.safeParse({ name: 'Alpha Squad' }).success).toBe(true);
    expect(createGroupSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createGroupSchema.safeParse({ name: 'G'.repeat(61) }).success).toBe(false);

    expect(joinGroupSchema.safeParse({ inviteCode: 'ABCDEFGH' }).success).toBe(true);
    expect(joinGroupSchema.safeParse({ inviteCode: '' }).success).toBe(false);
  });

  it('should validate createCycleSchema and advanceCycleSchema', () => {
    const validCycle = {
      year: 2026,
      month: 11,
      submissionDeadline: '2026-11-05T00:00:00.000Z',
      reviewDeadline: '2026-11-08T00:00:00.000Z',
    };
    expect(createCycleSchema.safeParse(validCycle).success).toBe(true);

    // Invalid month
    expect(createCycleSchema.safeParse({ ...validCycle, month: 13 }).success).toBe(false);
    expect(createCycleSchema.safeParse({ ...validCycle, month: 0 }).success).toBe(false);

    // Invalid ISO string
    expect(
      createCycleSchema.safeParse({ ...validCycle, submissionDeadline: 'not-a-date' }).success
    ).toBe(false);

    // advanceCycleSchema
    expect(advanceCycleSchema.safeParse({ force: true }).success).toBe(true);
    expect(advanceCycleSchema.safeParse({}).success).toBe(true);
  });

  it('should validate goalInputSchema and submissionInputSchema', () => {
    const validGoal = {
      title: 'Complete NestJS Submissions Module',
      description: 'Implement full test coverage and schema validation',
      category: 'Backend',
      priority: 2,
      estimatedHours: 4.5,
      deadline: '2026-11-20',
      successCriteria: {
        type: 'checklist' as const,
        items: ['Write schemas', 'Write tests', 'Pass lint'],
      },
      dependencies: [],
    };
    expect(goalInputSchema.safeParse(validGoal).success).toBe(true);

    // Empty title
    expect(goalInputSchema.safeParse({ ...validGoal, title: '' }).success).toBe(false);

    // Priority out of bounds
    expect(goalInputSchema.safeParse({ ...validGoal, priority: 6 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...validGoal, priority: 0 }).success).toBe(false);

    // Estimated hours out of bounds
    expect(goalInputSchema.safeParse({ ...validGoal, estimatedHours: 0.1 }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...validGoal, estimatedHours: 401 }).success).toBe(false);

    // Invalid deadline regex
    expect(goalInputSchema.safeParse({ ...validGoal, deadline: '20-11-2026' }).success).toBe(false);

    // Submission input requires 1-25 goals
    expect(submissionInputSchema.safeParse({ goals: [] }).success).toBe(false);
    expect(
      submissionInputSchema.safeParse({
        goals: [validGoal],
        submit: true,
      }).success
    ).toBe(true);
  });
});
