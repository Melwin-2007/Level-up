import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { validateEnv } from '../../src/config/env.schema.js';

config();

export interface TestUser {
  userId: string;
  token: string;
  cleanup: () => Promise<void>;
}

export async function createTestUser(prefix = 'test-user'): Promise<TestUser> {
  const env = validateEnv(process.env);
  const email = `${prefix}-${Date.now()}-${randomUUID().substring(0, 8)}@example.com`;
  const password = `TestPass!${randomUUID().substring(0, 8)}`;

  // 1. Create user via Supabase admin API
  const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(
      `Failed to create test user in Supabase Auth (${createRes.status}): ${errorBody}`
    );
  }

  const createdData = (await createRes.json()) as { id: string };
  const userId = createdData.id;

  // 2. Sign in to obtain genuine JWT access token
  const tokenRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    throw new Error(`Failed to sign in test user (${tokenRes.status}): ${errorBody}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  const cleanup = async (): Promise<void> => {
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }).catch(() => {});
  };

  return {
    userId,
    token,
    cleanup,
  };
}

export function asUser(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}
