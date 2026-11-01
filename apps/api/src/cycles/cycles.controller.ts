import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  advanceCycleSchema,
  createCycleSchema,
  type AdvanceCycleInput,
  type CreateCycleInput,
  type CycleDetailResponse,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CyclesService } from './cycles.service.js';

@Controller('groups/:id/cycles')
export class GroupCyclesController {
  constructor(@Inject(CyclesService) private readonly cyclesService: CyclesService) {}

  @Post()
  async createCycle(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) groupId: string,
    @Body(new ZodValidationPipe(createCycleSchema)) body: CreateCycleInput
  ): Promise<CycleDetailResponse> {
    return this.cyclesService.createCycle(groupId, user.userId, body);
  }
}

@Controller('cycles')
export class CyclesController {
  constructor(@Inject(CyclesService) private readonly cyclesService: CyclesService) {}

  @Get('current')
  async getCurrentCycle(
    @CurrentUser() user: { userId: string },
    @Query('groupId', new ParseUUIDPipe()) groupId: string
  ): Promise<CycleDetailResponse> {
    return this.cyclesService.getCurrentCycle(groupId, user.userId);
  }

  @Get(':id')
  async getCycleById(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<CycleDetailResponse> {
    return this.cyclesService.getCycleById(id, user.userId);
  }

  @Post(':id/advance')
  async advanceCycle(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(advanceCycleSchema)) body?: AdvanceCycleInput
  ): Promise<CycleDetailResponse> {
    return this.cyclesService.advanceCycle(id, user.userId, body);
  }
}
