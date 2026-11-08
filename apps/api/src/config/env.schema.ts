import { z } from 'zod';

export const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ required_error: 'DATABASE_URL is required' })
      .min(1, 'DATABASE_URL cannot be empty'),
    DIRECT_URL: z
      .string({ required_error: 'DIRECT_URL is required' })
      .min(1, 'DIRECT_URL cannot be empty'),
    SUPABASE_URL: z
      .string({ required_error: 'SUPABASE_URL is required' })
      .url('SUPABASE_URL must be a valid URL'),
    SUPABASE_ANON_KEY: z
      .string({ required_error: 'SUPABASE_ANON_KEY is required' })
      .min(1, 'SUPABASE_ANON_KEY cannot be empty'),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required' })
      .min(1, 'SUPABASE_SERVICE_ROLE_KEY cannot be empty'),
    JWT_VERIFY_MODE: z.enum(['jwks', 'hs256']).default('jwks'),
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_JWT_SECRET: z.string().min(1).optional(),
    MAX_GROUP_MEMBERS: z.coerce.number().int().min(1).default(12),
    AI_PROVIDER: z.enum(['fake', 'gemini', 'openai']).default('fake'),
    AI_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).default('gemini-3.5-flash'),
    REDIS_URL: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER !== 'fake' && !data.AI_API_KEY && data.NODE_ENV !== 'test') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_API_KEY'],
        message: `AI_API_KEY is required when AI_PROVIDER is "${data.AI_PROVIDER}"`,
      });
    }
    if (data.JWT_VERIFY_MODE === 'jwks' && !data.SUPABASE_JWKS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_JWKS_URL'],
        message: 'SUPABASE_JWKS_URL is required when JWT_VERIFY_MODE is "jwks"',
      });
    }
    if (data.JWT_VERIFY_MODE === 'hs256' && !data.SUPABASE_JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_JWT_SECRET'],
        message: 'SUPABASE_JWT_SECRET is required when JWT_VERIFY_MODE is "hs256"',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((issue) => `  - [${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Configuration validation error. Missing or invalid environment variables:\n${errorMessages}\n\nPlease check your apps/api/.env file.\n`
    );
  }

  return result.data;
}
