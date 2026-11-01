import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { EnvConfig } from '../config/env.schema.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwksKeySet?: JWTVerifyGetKey;
  private hs256Secret?: Uint8Array;
  private verifyMode: 'jwks' | 'hs256';
  private supabaseUrl: string;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly configService: ConfigService<EnvConfig, true>
  ) {
    this.verifyMode = this.configService.get('JWT_VERIFY_MODE', { infer: true });
    this.supabaseUrl = this.configService.get('SUPABASE_URL', { infer: true });

    if (this.verifyMode === 'jwks') {
      const jwksUrl = this.configService.get('SUPABASE_JWKS_URL', { infer: true });
      if (jwksUrl) {
        this.jwksKeySet = createRemoteJWKSet(new URL(jwksUrl));
      }
    } else {
      const secret = this.configService.get('SUPABASE_JWT_SECRET', { infer: true });
      if (secret) {
        this.hs256Secret = new TextEncoder().encode(secret);
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Missing authentication token',
      });
    }

    try {
      let payload;

      if (this.verifyMode === 'jwks' && this.jwksKeySet) {
        const result = await jwtVerify(token, this.jwksKeySet, {
          audience: 'authenticated',
        });
        payload = result.payload;
      } else if (this.verifyMode === 'hs256' && this.hs256Secret) {
        const result = await jwtVerify(token, this.hs256Secret, {
          audience: 'authenticated',
        });
        payload = result.payload;
      } else {
        throw new UnauthorizedException({
          code: 'UNAUTHENTICATED',
          message: 'Authentication service misconfigured',
        });
      }

      // Verify issuer
      const expectedIssuers = [
        this.supabaseUrl,
        this.supabaseUrl.endsWith('/auth/v1') ? this.supabaseUrl : `${this.supabaseUrl}/auth/v1`,
      ];
      if (payload.iss && !expectedIssuers.includes(payload.iss)) {
        throw new UnauthorizedException({
          code: 'UNAUTHENTICATED',
          message: 'Token issuer does not match configuration',
        });
      }

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException({
          code: 'UNAUTHENTICATED',
          message: 'Token subject (sub) missing or invalid',
        });
      }

      // Attach user identity to request
      (request as unknown as { user: { userId: string } }).user = {
        userId: payload.sub,
      };

      return true;
    } catch (err) {
      if (err instanceof errors.JWTExpired) {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        });
      }

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or malformed authentication token',
      });
    }
  }
}
