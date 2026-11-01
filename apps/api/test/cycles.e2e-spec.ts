import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CLOCK } from '../src/common/clock/clock.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { requestIdMiddleware } from '../src/common/middleware/request-id.middleware.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { asUser, createTestUser, type TestUser } from './helpers/auth.helper.js';
import { FakeClock } from './helpers/clock.js';

describe('Cycles & State Machine (e2e - TESTING.md item 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;
  let owner: TestUser;
  let member: TestUser;
  let nonMember: TestUser;

  let groupId: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    // Inject FakeClock initialized to 2026-11-01T10:00:00.000Z
    fakeClock = new FakeClock(new Date('2026-11-01T10:00:00.000Z'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(helmet());
    app.use(requestIdMiddleware);
    app.use(express.json({ limit: '100kb' }));
    app.use(express.urlencoded({ extended: true, limit: '100kb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Create real test users
    owner = await createTestUser('cycle-owner');
    member = await createTestUser('cycle-member');
    nonMember = await createTestUser('cycle-nonmember');

    // Create profiles
    const users = [owner, member, nonMember];
    for (const u of users) {
      await request(app.getHttpServer())
        .put('/api/v1/me')
        .set(asUser(u.token))
        .send({ displayName: `User ${u.userId.slice(0, 6)}`, timezone: 'Asia/Kolkata' })
        .expect(200);
    }

    // Owner creates group
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(owner.token))
      .send({ name: 'Cycle Testing Group' })
      .expect(201);

    groupId = groupRes.body.id;
    createdGroupIds.push(groupId);

    // Member joins group
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(member.token))
      .send({ inviteCode: groupRes.body.inviteCode })
      .expect(201);
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await prisma.group.deleteMany({
        where: { id: { in: createdGroupIds } },
      });
    }

    const users = [owner, member, nonMember];
    for (const u of users) {
      if (u) {
        await prisma.profile.deleteMany({ where: { id: u.userId } });
        await u.cleanup();
      }
    }

    await app.close();
  });

  let novemberCycleId: string;

  it('1. should allow owner to create a November cycle', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T10:00:00.000Z',
        reviewDeadline: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.groupId).toBe(groupId);
    expect(res.body.year).toBe(2026);
    expect(res.body.month).toBe(11);
    expect(res.body.status).toBe('submission_open');
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0].submissionStatus).toBe('none');

    novemberCycleId = res.body.id;
  });

  it('2. should reject duplicate cycle for same (groupId, year, month) with 409 CYCLE_EXISTS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T10:00:00.000Z',
        reviewDeadline: '2026-11-10T10:00:00.000Z',
      })
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'CYCLE_EXISTS',
    });
  });

  it('3. should reject cycle creation by a plain member with 403 FORBIDDEN_ROLE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(member.token))
      .send({
        year: 2026,
        month: 12,
        submissionDeadline: '2026-12-05T10:00:00.000Z',
        reviewDeadline: '2026-12-10T10:00:00.000Z',
      })
      .expect(403);

    expect(res.body.error).toMatchObject({
      code: 'FORBIDDEN_ROLE',
    });
  });

  it('4. should reject cycle creation by a non-member with 404 NOT_FOUND (DECISION 20)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(nonMember.token))
      .send({
        year: 2026,
        month: 12,
        submissionDeadline: '2026-12-05T10:00:00.000Z',
        reviewDeadline: '2026-12-10T10:00:00.000Z',
      })
      .expect(404);

    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('5. should return 404 NOT_FOUND for non-member reading cycle via GET /cycles/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${novemberCycleId}`)
      .set(asUser(nonMember.token))
      .expect(404);

    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Cycle not found',
    });
  });

  it('6. should allow member to read cycle and see member submission statuses via GET /cycles/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${novemberCycleId}`)
      .set(asUser(member.token))
      .expect(200);

    expect(res.body.id).toBe(novemberCycleId);
    expect(res.body.status).toBe('submission_open');
    expect(res.body.members).toHaveLength(2);
    for (const m of res.body.members) {
      expect(m.submissionStatus).toBe('none');
    }
  });

  it('7. should return current cycle for group via GET /cycles/current?groupId=', async () => {
    // Current fakeClock date is 2026-11-01, matching November cycle
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/current?groupId=${groupId}`)
      .set(asUser(member.token))
      .expect(200);

    expect(res.body.id).toBe(novemberCycleId);
    expect(res.body.year).toBe(2026);
    expect(res.body.month).toBe(11);
  });

  it('8. should reject unforced advance before deadline or submissions with 409 CYCLE_STATE_INVALID', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${novemberCycleId}/advance`)
      .set(asUser(owner.token))
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'CYCLE_STATE_INVALID',
      details: { phase: 'submission_open' },
    });
  });

  it('9. should advance cycle to group_review when submissionDeadline passes with FakeClock', async () => {
    // Advance clock from Nov 1 to Nov 6 (past submissionDeadline of Nov 5)
    fakeClock.advanceDays(5);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${novemberCycleId}/advance`)
      .set(asUser(owner.token))
      .expect(201);

    expect(res.body.id).toBe(novemberCycleId);
    expect(res.body.status).toBe('group_review');
  });

  it('10. should advance cycle to planning when reviewDeadline passes with FakeClock', async () => {
    // Advance clock from Nov 6 to Nov 11 (past reviewDeadline of Nov 10)
    fakeClock.advanceDays(5);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${novemberCycleId}/advance`)
      .set(asUser(owner.token))
      .expect(201);

    expect(res.body.id).toBe(novemberCycleId);
    expect(res.body.status).toBe('planning');
  });

  it('11. should reject further transitions beyond group_review in Milestone 1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${novemberCycleId}/advance`)
      .set(asUser(owner.token))
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'CYCLE_STATE_INVALID',
    });
  });

  it('12. should allow owner forced advance with { force: true } while rejecting plain member force', async () => {
    // Create a new cycle for December 2026
    const decRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 12,
        submissionDeadline: '2026-12-05T10:00:00.000Z',
        reviewDeadline: '2026-12-10T10:00:00.000Z',
      })
      .expect(201);

    const decCycleId = decRes.body.id;

    // Plain member tries to force advance -> 403 FORBIDDEN_ROLE
    await request(app.getHttpServer())
      .post(`/api/v1/cycles/${decCycleId}/advance`)
      .set(asUser(member.token))
      .send({ force: true })
      .expect(403);

    // Owner force advances -> succeeds immediately without waiting for deadline
    const forcedRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${decCycleId}/advance`)
      .set(asUser(owner.token))
      .send({ force: true })
      .expect(201);

    expect(forcedRes.body.id).toBe(decCycleId);
    expect(forcedRes.body.status).toBe('group_review');
  });
});
