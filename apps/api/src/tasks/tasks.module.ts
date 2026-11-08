import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [TasksService],
})
export class TasksModule {}
