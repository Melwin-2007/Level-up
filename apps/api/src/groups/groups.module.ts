import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { GroupAdminGuard } from './guards/group-admin.guard.js';
import { GroupMemberGuard } from './guards/group-member.guard.js';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, GroupMemberGuard, GroupAdminGuard],
  exports: [GroupsService, GroupMemberGuard, GroupAdminGuard],
})
export class GroupsModule {}
