import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { CyclesModule } from '../cycles/cycles.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
  imports: [GroupsModule, CyclesModule],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
