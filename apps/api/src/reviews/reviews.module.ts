import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../common/clock/clock.js';
import { CyclesModule } from '../cycles/cycles.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { CycleReviewsController, ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [GroupsModule, CyclesModule],
  controllers: [CycleReviewsController, ReviewsController],
  providers: [
    ReviewsService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
