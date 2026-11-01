import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { GroupsModule } from '../groups/groups.module.js';
import { CycleStateService } from './cycle-state.service.js';
import { CyclesController, GroupCyclesController } from './cycles.controller.js';
import { CyclesService } from './cycles.service.js';
import { PrismaSubmissionsStatusRepository } from './prisma-submissions-status.repository.js';
import { SUBMISSIONS_STATUS_PORT } from './submissions-status.port.js';

@Module({
  imports: [GroupsModule],
  controllers: [GroupCyclesController, CyclesController],
  providers: [
    CyclesService,
    CycleStateService,
    {
      provide: SUBMISSIONS_STATUS_PORT,
      useClass: PrismaSubmissionsStatusRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [CyclesService, CycleStateService, SUBMISSIONS_STATUS_PORT, CLOCK],
})
export class CyclesModule {}
