import { Controller, Get, Inject } from '@nestjs/common';
import type { GamificationOverview } from '@mp/shared';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { AchievementsService } from './achievements.service.js';

@Controller('me/gamification')
export class GamificationController {
  constructor(
    @Inject(AchievementsService) private readonly achievementsService: AchievementsService
  ) {}

  @Get()
  async getMyGamification(@CurrentUser() user: CurrentUserPayload): Promise<GamificationOverview> {
    return this.achievementsService.getGamificationOverview(user.userId);
  }
}
