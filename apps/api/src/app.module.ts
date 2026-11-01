import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { ProfileRequiredGuard } from './auth/profile-required.guard.js';
import { validateEnv } from './config/env.schema.js';
import { CyclesModule } from './cycles/cycles.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { UsersModule } from './users/users.module.js';

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
  ],
  controllers: [HealthController],
  providers: [
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
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
