import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { XpSummaryResponse } from '@mp/shared';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { XpService } from './xp.service.js';

@Controller('me/xp')
export class XpController {
  constructor(@Inject(XpService) private readonly xpService: XpService) {}

  @Get()
  async getMyXp(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string
  ): Promise<XpSummaryResponse> {
    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : 20;
    return this.xpService.getUserXpOverview(user.userId, parsedLimit);
  }
}
