import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  patchSubmissionInputSchema,
  submissionInputSchema,
  type OthersSubmissionsResponse,
  type OwnSubmissionResponse,
  type PatchSubmissionInput,
  type SubmissionInput,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SubmissionsService } from './submissions.service.js';

@Controller('cycles/:id')
export class SubmissionsController {
  constructor(
    @Inject(SubmissionsService) private readonly submissionsService: SubmissionsService
  ) {}

  @Post('submission')
  async createSubmission(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(submissionInputSchema)) body: SubmissionInput
  ): Promise<OwnSubmissionResponse> {
    return this.submissionsService.createSubmission(cycleId, user.userId, body);
  }

  @Get('submission')
  async getOwnSubmission(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<OwnSubmissionResponse> {
    return this.submissionsService.getOwnSubmission(cycleId, user.userId);
  }

  @Patch('submission')
  async patchSubmission(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(patchSubmissionInputSchema)) body: PatchSubmissionInput
  ): Promise<OwnSubmissionResponse> {
    return this.submissionsService.patchSubmission(cycleId, user.userId, body);
  }

  @Post('lock-submission')
  async lockSubmission(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<OwnSubmissionResponse> {
    return this.submissionsService.lockSubmission(cycleId, user.userId);
  }

  @Get('submissions')
  async getOthersSubmissions(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<OthersSubmissionsResponse> {
    return this.submissionsService.getOthersSubmissions(cycleId, user.userId);
  }
}
