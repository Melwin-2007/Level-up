import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createGroupSchema,
  type CreateGroupInput,
  type GroupDetailResponse,
  type GroupListResponse,
  joinGroupSchema,
  type JoinGroupInput,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { GroupsService } from './groups.service.js';

@Controller('groups')
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly groupsService: GroupsService) {}

  @Post()
  async createGroup(
    @CurrentUser() user: { userId: string },
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput
  ): Promise<GroupDetailResponse> {
    return this.groupsService.createGroup(user.userId, body);
  }

  @Get()
  async getMyGroups(@CurrentUser() user: { userId: string }): Promise<GroupListResponse> {
    return this.groupsService.getMyGroups(user.userId);
  }

  @Post('join')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async joinGroup(
    @CurrentUser() user: { userId: string },
    @Body(new ZodValidationPipe(joinGroupSchema)) body: JoinGroupInput
  ): Promise<GroupDetailResponse> {
    return this.groupsService.joinGroup(user.userId, body);
  }

  @Get(':id')
  async getGroupById(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<GroupDetailResponse> {
    return this.groupsService.getGroupById(id, user.userId);
  }
}
