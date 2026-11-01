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

describe('Groups & Membership (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestUser;
  let member1: TestUser;
  let member2: TestUser;
  let excessUser: TestUser;
  let nonMember: TestUser;
  let throttledUser: TestUser;

  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    // Set lowered group member cap to 3 for cap enforcement test
    process.env['MAX_GROUP_MEMBERS'] = '3';

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

    // Create real test users with profiles
    owner = await createTestUser('owner');
    member1 = await createTestUser('member-1');
    member2 = await createTestUser('member-2');
    excessUser = await createTestUser('excess');
    nonMember = await createTestUser('non-member');
    throttledUser = await createTestUser('throttled');

    const users = [owner, member1, member2, excessUser, nonMember, throttledUser];
    for (const u of users) {
      await request(app.getHttpServer())
        .put('/api/v1/me')
        .set(asUser(u.token))
        .send({ displayName: `User ${u.userId.slice(0, 6)}`, timezone: 'Asia/Kolkata' })
        .expect(200);
    }
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await prisma.group.deleteMany({
        where: { id: { in: createdGroupIds } },
      });
    }

    const users = [owner, member1, member2, excessUser, nonMember, throttledUser];
    for (const u of users) {
      if (u) {
        await prisma.profile.deleteMany({ where: { id: u.userId } });
        await u.cleanup();
      }
    }

    await app.close();
    delete process.env['MAX_GROUP_MEMBERS'];
  });

  let testGroupId: string;
  let testInviteCode: string;

  it('1. should create a group with caller as owner and return 8-char invite code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(owner.token))
      .send({ name: 'Alpha Productivity Group' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Alpha Productivity Group');
    expect(res.body.role).toBe('owner');
    expect(res.body.inviteCode).toBeDefined();
    expect(res.body.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0]).toMatchObject({
      userId: owner.userId,
      role: 'owner',
    });

    testGroupId = res.body.id;
    testInviteCode = res.body.inviteCode;
    createdGroupIds.push(testGroupId);
  });

  it('2. should list groups the caller belongs to via GET /groups', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/groups')
      .set(asUser(owner.token))
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    const found = res.body.items.find((g: { id: string }) => g.id === testGroupId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Alpha Productivity Group');
    expect(found.role).toBe('owner');
    expect(found.memberCount).toBe(1);
  });

  it('3. should return 404 NOT_FOUND for non-member on GET /groups/:id (DECISION 20)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/groups/${testGroupId}`)
      .set(asUser(nonMember.token))
      .expect(404);

    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Group not found',
    });
  });

  it('4. should reject joining with an unknown invite code (404 NOT_FOUND)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(member1.token))
      .send({ inviteCode: 'XXXXXXXX' })
      .expect(404);

    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'That code does not match a group',
    });
  });

  it('5. should reject joining if caller is already a member (409 ALREADY_MEMBER)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(owner.token))
      .send({ inviteCode: testInviteCode })
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'ALREADY_MEMBER',
      message: 'You are already a member of this group',
    });
  });

  it('6. should allow two members to join with valid invite code (trimmed & case-insensitive)', async () => {
    // Member 1 joins with lowercase / spaced code
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(member1.token))
      .send({ inviteCode: `  ${testInviteCode.toLowerCase()}  ` })
      .expect(201);

    expect(res1.body.id).toBe(testGroupId);
    expect(res1.body.role).toBe('member');
    // Plain member should NOT see invite code
    expect(res1.body.inviteCode).toBeUndefined();
    expect(res1.body.members).toHaveLength(2);

    // Member 2 joins
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(member2.token))
      .send({ inviteCode: testInviteCode })
      .expect(201);

    expect(res2.body.id).toBe(testGroupId);
    expect(res2.body.role).toBe('member');
    expect(res2.body.inviteCode).toBeUndefined();
    expect(res2.body.members).toHaveLength(3);
  });

  it('7. should enforce member cap and reject third join when group is full (409 GROUP_FULL)', async () => {
    // Member cap is configured as 3 in beforeAll (owner + member1 + member2 = 3)
    const res = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(excessUser.token))
      .send({ inviteCode: testInviteCode })
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'GROUP_FULL',
      message: 'This group is full',
    });
  });

  it('8. should hide inviteCode for plain members and show inviteCode for owner on GET /groups/:id', async () => {
    // Owner reads group
    const ownerRes = await request(app.getHttpServer())
      .get(`/api/v1/groups/${testGroupId}`)
      .set(asUser(owner.token))
      .expect(200);

    expect(ownerRes.body.role).toBe('owner');
    expect(ownerRes.body.inviteCode).toBe(testInviteCode);
    expect(ownerRes.body.members).toHaveLength(3);

    // Member reads group
    const memberRes = await request(app.getHttpServer())
      .get(`/api/v1/groups/${testGroupId}`)
      .set(asUser(member1.token))
      .expect(200);

    expect(memberRes.body.role).toBe('member');
    expect(memberRes.body.inviteCode).toBeUndefined();
    expect(memberRes.body.members).toHaveLength(3);
  });

  it('9. should enforce rate limiting on POST /groups/join (5 per minute per user)', async () => {
    // Send 5 requests (which should not be rate-limited)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/groups/join')
        .set(asUser(throttledUser.token))
        .send({ inviteCode: 'INVALID1' });
    }

    // 6th request within the same minute should be rejected with 429 RATE_LIMITED
    const res = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(throttledUser.token))
      .send({ inviteCode: 'INVALID1' })
      .expect(429);

    expect(res.body.error).toMatchObject({
      code: 'RATE_LIMITED',
    });
  });
});
