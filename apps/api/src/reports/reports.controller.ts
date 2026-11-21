import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  regenerateReportSchema,
  memberSharingSettingsSchema,
  type RegenerateReportInput,
  type MemberSharingSettings,
  type MonthlyReportResponse,
  type GroupReportResponse,
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

  @Get('group')
  async getGroupReport(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<{ report: GroupReportResponse }> {
    const report = await this.reportsService.getGroupReport(cycleId, user.userId);
    return { report };
  }

  @Put('sharing')
  async updateSharingSettings(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(memberSharingSettingsSchema)) body: MemberSharingSettings
  ): Promise<{ sharingSettings: MemberSharingSettings }> {
    const sharingSettings = await this.reportsService.updateSharingSettings(
      cycleId,
      user.userId,
      body
    );
    return { sharingSettings };
  }
}
