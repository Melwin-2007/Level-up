import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import {
  type UpdateProfileInput,
  type UserProfile,
  type RegisterPushTokenInput,
  type PushTokenResponse,
  type NotificationPreferences,
  updateProfileSchema,
  registerPushTokenSchema,
  notificationPreferencesSchema,
} from '@mp/shared';
import { AllowWithoutProfile } from '../auth/decorators/allow-without-profile.decorator.js';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() user: CurrentUserPayload): Promise<UserProfile> {
    return this.usersService.getProfile(user.userId);
  }

  @Put()
  @AllowWithoutProfile()
  async updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput
  ): Promise<UserProfile> {
    return this.usersService.upsertProfile(user.userId, body);
  }

  @Put('push-token')
  async registerPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(registerPushTokenSchema)) body: RegisterPushTokenInput
  ): Promise<PushTokenResponse> {
    return this.usersService.registerPushToken(user.userId, body);
  }

  @Get('push-token')
  async getPushToken(
    @CurrentUser() user: CurrentUserPayload
  ): Promise<{ pushToken: PushTokenResponse | null }> {
    const pushToken = await this.usersService.getPushToken(user.userId);
    return { pushToken };
  }

  @Put('notification-preferences')
  async updateNotificationPreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(notificationPreferencesSchema.partial()))
    body: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return this.usersService.updateNotificationPreferences(user.userId, body);
  }

  @Get('notification-preferences')
  async getNotificationPreferences(
    @CurrentUser() user: CurrentUserPayload
  ): Promise<NotificationPreferences> {
    return this.usersService.getNotificationPreferences(user.userId);
  }
}
