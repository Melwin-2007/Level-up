import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  regenerateReportSchema,
  type RegenerateReportInput,
  type MonthlyReportResponse,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReportsService } from './reports.service.js';

@Controller('cycles/:id/reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get('me')
  async getMyReport(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<{ report: MonthlyReportResponse }> {
    const report = await this.reportsService.getIndividualReport(cycleId, user.userId);
    return { report };
  }

  @Post('me/regenerate')
  async regenerateMyReport(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(regenerateReportSchema)) body: RegenerateReportInput
  ): Promise<{ report: MonthlyReportResponse }> {
    const report = await this.reportsService.generateIndividualReport(
      cycleId,
      user.userId,
      body.note
    );
    return { report };
  }
}
