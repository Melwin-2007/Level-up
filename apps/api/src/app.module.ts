import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { ProfileRequiredGuard } from './auth/profile-required.guard.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { validateEnv } from './config/env.schema.js';
import { CyclesModule } from './cycles/cycles.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { UsersModule } from './users/users.module.js';
import { AiModule } from './ai/ai.module.js';
import { PlansModule } from './plans/plans.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
        getTracker: (req: Record<string, unknown>) => {
          const user = req['user'] as { userId?: string } | undefined;
          const ip = req['ip'] as string | undefined;
          return user?.userId ?? ip ?? 'unknown';
        },
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    CyclesModule,
    SubmissionsModule,
    ReviewsModule,
    AiModule,
    PlansModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    Reflector,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ProfileRequiredGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
