import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { XpController } from './xp.controller.js';
import { GamificationController } from './gamification.controller.js';
import { XpService } from './xp.service.js';
import { AchievementsService } from './achievements.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [XpController, GamificationController],
  providers: [
    XpService,
    AchievementsService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [XpService, AchievementsService],
})
export class XpModule {}
