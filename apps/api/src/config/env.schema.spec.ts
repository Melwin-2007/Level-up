import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const validBase = {
    PORT: '3000',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:password@localhost:6543/postgres?pgbouncer=true',
    DIRECT_URL: 'postgresql://postgres:password@localhost:5432/postgres',
    SUPABASE_URL: 'https://xyzcompany.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    JWT_VERIFY_MODE: 'jwks',
    SUPABASE_JWKS_URL: 'https://xyzcompany.supabase.co/auth/v1/.well-known/jwks.json',
  };

  it('should validate and parse complete valid config', () => {
    const parsed = validateEnv(validBase);
    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.JWT_VERIFY_MODE).toBe('jwks');
  });

  it('should validate hs256 mode when secret is provided', () => {
    const config = {
      ...validBase,
      JWT_VERIFY_MODE: 'hs256',
      SUPABASE_JWKS_URL: undefined,
      SUPABASE_JWT_SECRET: 'super-secret-jwt-key',
    };
    const parsed = validateEnv(config);
    expect(parsed.JWT_VERIFY_MODE).toBe('hs256');
    expect(parsed.SUPABASE_JWT_SECRET).toBe('super-secret-jwt-key');
  });

  it('should throw descriptive error listing missing required variables', () => {
    expect(() => validateEnv({})).toThrowError(/Missing or invalid environment variables/);
  });

  it('should require SUPABASE_JWKS_URL when mode is jwks', () => {
    const config = {
      ...validBase,
      JWT_VERIFY_MODE: 'jwks',
      SUPABASE_JWKS_URL: undefined,
    };
    expect(() => validateEnv(config)).toThrowError(/SUPABASE_JWKS_URL is required/);
  });
});
