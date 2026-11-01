import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALLOW_WITHOUT_PROFILE_KEY } from './decorators/allow-without-profile.decorator.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

@Injectable()
export class ProfileRequiredGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowWithoutProfile = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_PROFILE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (allowWithoutProfile) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { userId: string } }>();
    const userId = request.user?.userId;

    if (!userId) {
      return false;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new ForbiddenException({
        code: 'PROFILE_REQUIRED',
        message: 'A complete user profile is required to access this resource.',
      });
    }

    return true;
  }
}
