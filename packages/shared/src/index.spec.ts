import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  createGroupSchema,
  CYCLE_STATUSES,
  GROUP_ROLES,
  joinGroupSchema,
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
});
