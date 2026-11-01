import { z } from 'zod';

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name must be at least 1 character')
    .max(60, 'Display name must not exceed 60 characters'),
  timezone: z
    .string()
    .trim()
    .refine((tz) => isValidTimezone(tz), {
      message: 'Invalid IANA timezone identifier',
    })
    .default('Asia/Kolkata'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
