import { Controller, Post, Get, Body, Query, Inject } from '@nestjs/common';
import {
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncPullResponse,
  syncPushRequestSchema,
} from '@mp/shared';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post('push')
  async push(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(syncPushRequestSchema)) body: SyncPushRequest
  ): Promise<SyncPushResponse> {
    return this.syncService.pushActions(user.userId, body);
  }

  @Get('pull')
  async pull(
    @CurrentUser() user: CurrentUserPayload,
    @Query('since') since?: string
  ): Promise<SyncPullResponse> {
    return this.syncService.pullDelta(user.userId, since);
  }
}
