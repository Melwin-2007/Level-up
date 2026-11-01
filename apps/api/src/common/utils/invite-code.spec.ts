import { describe, expect, it } from 'vitest';
import { generateInviteCode, INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from './invite-code.js';

describe('generateInviteCode', () => {
  it('should generate an 8-character code strictly from the allowed alphabet', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const char of code) {
      expect(INVITE_CODE_ALPHABET).toContain(char);
    }
  });

  it('should produce distinct codes across multiple invocations', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateInviteCode());
    }
    expect(codes.size).toBe(50);
  });
});
