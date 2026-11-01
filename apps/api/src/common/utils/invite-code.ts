import { randomInt } from 'node:crypto';

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/**
 * Generates an 8-character invite code using crypto.randomInt
 * from the alphabet ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (DECISIONS 23).
 */
export function generateInviteCode(): string {
  let code = '';
  const alphabetLength = INVITE_CODE_ALPHABET.length;
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const randomIndex = randomInt(0, alphabetLength);
    code += INVITE_CODE_ALPHABET[randomIndex];
  }
  return code;
}
