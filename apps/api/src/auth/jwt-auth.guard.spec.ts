import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard (unit)', () => {
  const mockReflector = {
    getAllAndOverride: () => false,
  } as unknown as Reflector;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'JWT_VERIFY_MODE') return 'hs256';
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_JWT_SECRET') return 'test-secret-at-least-32-chars-long-123456';
      return null;
    },
  } as unknown as ConfigService<Record<string, unknown>, true>;

  const guard = new JwtAuthGuard(mockReflector, mockConfigService);

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader,
      },
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should reject request without authorization header', async () => {
    const ctx = createMockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrowError(UnauthorizedException);
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    }
  });

  it('should reject request with expired token and return TOKEN_EXPIRED code', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long-123456');
    const expiredToken = await new SignJWT({ sub: 'user-123', aud: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://test.supabase.co/auth/v1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);

    const ctx = createMockContext(`Bearer ${expiredToken}`);
    await expect(guard.canActivate(ctx)).rejects.toThrowError(UnauthorizedException);
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'TOKEN_EXPIRED',
      });
    }
  });

  it('should reject token with wrong audience', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long-123456');
    const wrongAudToken = await new SignJWT({ sub: 'user-123', aud: 'other-aud' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://test.supabase.co/auth/v1')
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(secret);

    const ctx = createMockContext(`Bearer ${wrongAudToken}`);
    await expect(guard.canActivate(ctx)).rejects.toThrowError(UnauthorizedException);
    try {
      await guard.canActivate(ctx);
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    }
  });

  it('should accept valid token and attach user payload to request', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long-123456');
    const validToken = await new SignJWT({ sub: 'test-user-id-999', aud: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://test.supabase.co/auth/v1')
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(secret);

    const req: { headers: { authorization: string }; user?: { userId: string } } = {
      headers: { authorization: `Bearer ${validToken}` },
    };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.user).toEqual({ userId: 'test-user-id-999' });
  });
});
