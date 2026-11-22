import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { XpModule } from '../xp/xp.module.js';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { SyncService } from './sync.service.js';
import { SyncController } from './sync.controller.js';

@Module({
  imports: [PrismaModule, TasksModule, XpModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [SyncService],
})
export class SyncModule {}
