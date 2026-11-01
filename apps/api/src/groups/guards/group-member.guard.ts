import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GroupsService } from '../groups.service.js';

interface RequestWithUserAndParams extends Request {
  user?: {
    userId: string;
  };
  params: {
    id?: string;
    groupId?: string;
  };
}

@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(@Inject(GroupsService) private readonly groupsService: GroupsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUserAndParams>();
    const userId = request.user?.userId;
    const groupId = request.params.id ?? request.params.groupId;

    if (!userId || !groupId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    await this.groupsService.requireMembership(groupId, userId);
    return true;
  }
}
