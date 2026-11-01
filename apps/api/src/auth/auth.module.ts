import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ProfileRequiredGuard } from './profile-required.guard.js';

@Module({
  providers: [JwtAuthGuard, ProfileRequiredGuard],
  exports: [JwtAuthGuard, ProfileRequiredGuard],
})
export class AuthModule {}
