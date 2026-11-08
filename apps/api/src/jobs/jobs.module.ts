import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { redisProvider } from './redis.provider.js';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';
import { RemindersWorker } from './reminders.worker.js';
import { CycleTransitionsWorker } from './cycle-transitions.worker.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [
    redisProvider,
    JobsService,
    RemindersWorker,
    CycleTransitionsWorker,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [JobsService, RemindersWorker, CycleTransitionsWorker],
})
export class JobsModule {}
