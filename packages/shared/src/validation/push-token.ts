import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  platform: z.enum(['android', 'ios', 'web']).optional().default('android'),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const notificationPreferencesSchema = z.object({
  dailySummaryEnabled: z.boolean().default(true),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format')
    .default('09:00'),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export interface PushTokenResponse {
  token: string;
  platform: 'android' | 'ios' | 'web';
  updatedAt: string;
}
