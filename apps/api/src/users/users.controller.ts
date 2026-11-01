import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { type UpdateProfileInput, type UserProfile, updateProfileSchema } from '@mp/shared';
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
}
