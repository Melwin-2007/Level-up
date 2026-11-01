import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { requestIdMiddleware } from '../src/common/middleware/request-id.middleware.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { asUser, createTestUser, type TestUser } from './helpers/auth.helper.js';

describe('Auth & Profiles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(helmet());
    app.use(requestIdMiddleware);
    app.use(express.json({ limit: '100kb' }));
    app.use(express.urlencoded({ extended: true, limit: '100kb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Create real test users via Supabase auth admin API
    userA = await createTestUser('alice');
    userB = await createTestUser('bob');
  });

  afterAll(async () => {
    if (userA) {
      await prisma.profile.deleteMany({ where: { id: userA.userId } });
      await userA.cleanup();
    }
    if (userB) {
      await prisma.profile.deleteMany({ where: { id: userB.userId } });
      await userB.cleanup();
    }
    await app.close();
  });

  it('1. should return 401 UNAUTHENTICATED when Authorization header is missing', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').expect(401);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('2. should return 401 UNAUTHENTICATED when token is invalid or malformed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer not-a-valid-token')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('3. should return 403 PROFILE_REQUIRED when authenticated user has no profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(asUser(userA.token))
      .expect(403);

    expect(res.body.error.code).toBe('PROFILE_REQUIRED');
  });

  it('4. should reject PUT /me with invalid timezone or empty display name', async () => {
    // Empty display name
    const res1 = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userA.token))
      .send({ displayName: '', timezone: 'America/New_York' })
      .expect(400);

    expect(res1.body.error.code).toBe('VALIDATION_FAILED');

    // Invalid IANA timezone
    const res2 = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userA.token))
      .send({ displayName: 'Alice', timezone: 'Invalid/NonExistent_Zone' })
      .expect(400);

    expect(res2.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('5. should allow PUT /me without prior profile and successfully create profile', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userA.token))
      .send({
        displayName: 'Alice Developer',
        timezone: 'America/New_York',
      })
      .expect(200);

    expect(res.body.id).toBe(userA.userId);
    expect(res.body.displayName).toBe('Alice Developer');
    expect(res.body.timezone).toBe('America/New_York');
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();
  });

  it('6. should allow GET /me once profile exists and return own profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(asUser(userA.token))
      .expect(200);

    expect(res.body.id).toBe(userA.userId);
    expect(res.body.displayName).toBe('Alice Developer');
  });

  it('7. should update profile on subsequent PUT /me calls', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userA.token))
      .send({
        displayName: 'Alice Senior Dev',
        timezone: 'Asia/Kolkata',
      })
      .expect(200);

    expect(res.body.displayName).toBe('Alice Senior Dev');
    expect(res.body.timezone).toBe('Asia/Kolkata');
  });

  it('8. should enforce user isolation: User A cannot read User B profile', async () => {
    // Setup Bob's profile
    await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userB.token))
      .send({
        displayName: 'Bob The Builder',
        timezone: 'Europe/London',
      })
      .expect(200);

    // When Alice calls GET /me, she only receives Alice's profile
    const aliceRes = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(asUser(userA.token))
      .expect(200);

    expect(aliceRes.body.id).toBe(userA.userId);
    expect(aliceRes.body.displayName).toBe('Alice Senior Dev');

    // When Bob calls GET /me, he only receives Bob's profile
    const bobRes = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(asUser(userB.token))
      .expect(200);

    expect(bobRes.body.id).toBe(userB.userId);
    expect(bobRes.body.displayName).toBe('Bob The Builder');
  });
});
