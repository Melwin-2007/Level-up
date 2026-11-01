import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  CYCLE_STATUSES,
  GROUP_ROLES,
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
    const valid = { displayName: 'Alice', timezone: 'America/New_York' };
    const parsed = updateProfileSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    const invalid = { displayName: 'A', timezone: '' };
    const invalidParsed = updateProfileSchema.safeParse(invalid);
    expect(invalidParsed.success).toBe(false);
  });
});
