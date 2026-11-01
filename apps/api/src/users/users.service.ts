import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateProfileInput, UserProfile } from '@mp/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Profile not found',
      });
    }

    return this.mapToUserProfile(profile);
  }

  async upsertProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const profile = await this.prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        displayName: input.displayName,
        timezone: input.timezone,
      },
      update: {
        displayName: input.displayName,
        timezone: input.timezone,
      },
    });

    return this.mapToUserProfile(profile);
  }

  private mapToUserProfile(profile: {
    id: string;
    displayName: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfile {
    return {
      id: profile.id,
      displayName: profile.displayName,
      timezone: profile.timezone,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
