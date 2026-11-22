import { Controller, Get, Inject } from '@nestjs/common';
import type { MonthOverMonthResponse } from '@mp/shared';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('me/analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get('trends')
  async getTrends(@CurrentUser() user: CurrentUserPayload): Promise<MonthOverMonthResponse> {
    return this.analyticsService.getMonthOverMonthAnalytics(user.userId);
  }
}
