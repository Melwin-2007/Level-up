import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  UpdateProfileInput,
  UserProfile,
  RegisterPushTokenInput,
  PushTokenResponse,
  NotificationPreferences,
} from '@mp/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  private readonly pushTokens = new Map<string, PushTokenResponse>();
  private readonly notificationPreferences = new Map<string, NotificationPreferences>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    return this.mapToUserProfile(profile);
  }

  async upsertProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const profile = await this.prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        displayName: input.displayName,
        timezone: input.timezone,
      },
      update: {
        displayName: input.displayName,
        timezone: input.timezone,
      },
    });

    return this.mapToUserProfile(profile);
  }

  async registerPushToken(
    userId: string,
    input: RegisterPushTokenInput
  ): Promise<PushTokenResponse> {
    // Verify user profile exists
    await this.getProfile(userId);

    const record: PushTokenResponse = {
      token: input.token,
      platform: input.platform ?? 'android',
      updatedAt: new Date().toISOString(),
    };

    this.pushTokens.set(userId, record);
    return record;
  }

  async getPushToken(userId: string): Promise<PushTokenResponse | null> {
    return this.pushTokens.get(userId) ?? null;
  }

  async updateNotificationPreferences(
    userId: string,
    input: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    await this.getProfile(userId);

    const current = this.getNotificationPreferencesSync(userId);
    const updated: NotificationPreferences = {
      dailySummaryEnabled: input.dailySummaryEnabled ?? current.dailySummaryEnabled,
      reminderTime: input.reminderTime ?? current.reminderTime,
    };

    this.notificationPreferences.set(userId, updated);
    return updated;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    await this.getProfile(userId);
    return this.getNotificationPreferencesSync(userId);
  }

  private getNotificationPreferencesSync(userId: string): NotificationPreferences {
    return (
      this.notificationPreferences.get(userId) ?? {
        dailySummaryEnabled: true,
        reminderTime: '09:00',
      }
    );
  }

  private mapToUserProfile(profile: {
    id: string;
    displayName: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfile {
    return {
      id: profile.id,
      displayName: profile.displayName,
      timezone: profile.timezone,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
