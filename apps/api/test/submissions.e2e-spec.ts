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

describe('Goal Submissions, Drafts, and Locking (e2e - TESTING.md items 5, 6, 7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;
  let owner: TestUser;
  let memberB: TestUser;
  let memberC: TestUser;

  let groupId: string;
  let cycleId: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
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
    owner = await createTestUser('sub-owner');
    memberB = await createTestUser('sub-memberb');
    memberC = await createTestUser('sub-memberc');

    const users = [owner, memberB, memberC];
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
      .send({ name: 'Submissions Test Group' })
      .expect(201);

    groupId = groupRes.body.id;
    createdGroupIds.push(groupId);

    // Members join
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(memberB.token))
      .send({ inviteCode: groupRes.body.inviteCode })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(memberC.token))
      .send({ inviteCode: groupRes.body.inviteCode })
      .expect(201);

    // Owner creates November cycle
    const cycleRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T10:00:00.000Z',
        reviewDeadline: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    cycleId = cycleRes.body.id;
  }, 60000);

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await prisma.group.deleteMany({
        where: { id: { in: createdGroupIds } },
      });
    }

    const users = [owner, memberB, memberC];
    for (const u of users) {
      if (u) {
        await prisma.profile.deleteMany({ where: { id: u.userId } });
        await u.cleanup();
      }
    }

    await app.close();
  }, 60000);

  let memberBGoalId: string;

  it('1. should allow three members to each submit different goals (Item 5)', async () => {
    // Owner submits with submit: true
    const ownerRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Owner Goal: Launch NestJS API',
            category: 'Backend',
            priority: 1,
            estimatedHours: 15.5,
            deadline: '2026-11-20',
            successCriteria: { type: 'binary' },
            dependencies: [],
          },
        ],
        availability: { weeklyHours: { monday: 8, tuesday: 8 } },
        constraints: { fixedCommitments: [{ title: 'Sync call', hoursPerWeek: 1 }] },
        submit: true,
      })
      .expect(201);

    expect(ownerRes.body.status).toBe('submitted');
    expect(ownerRes.body.goals).toHaveLength(1);
    expect(ownerRes.body.goals[0].title).toBe('Owner Goal: Launch NestJS API');

    // Member B submits with submit: true
    const bRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberB.token))
      .send({
        goals: [
          {
            title: 'Member B Goal: Write Unit Tests',
            category: 'Testing',
            priority: 2,
            estimatedHours: 8,
            deadline: '2026-11-22',
            successCriteria: { type: 'checklist', items: ['Coverage 90%'] },
            dependencies: [],
          },
        ],
        availability: { weeklyHours: { wednesday: 6, thursday: 6 } },
        constraints: { fixedCommitments: [] },
        submit: true,
      })
      .expect(201);

    expect(bRes.body.status).toBe('submitted');
    expect(bRes.body.goals).toHaveLength(1);
    expect(bRes.body.goals[0].title).toBe('Member B Goal: Write Unit Tests');
    memberBGoalId = bRes.body.goals[0].id;

    // Member C creates a draft submission with submit: false
    const cRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberC.token))
      .send({
        goals: [
          {
            title: 'Member C Secret Draft Goal',
            priority: 3,
            deadline: '2026-11-25',
            dependencies: [],
          },
        ],
        availability: { weeklyHours: { friday: 4 } },
        constraints: { fixedCommitments: [] },
        submit: false,
      })
      .expect(201);

    expect(cRes.body.status).toBe('draft');
    expect(cRes.body.goals).toHaveLength(1);
  });

  it('2. each member reads only their own submission via GET /cycles/:id/submission', async () => {
    // Owner reads own submission
    const ownerRes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .expect(200);

    expect(ownerRes.body.userId).toBe(owner.userId);
    expect(ownerRes.body.goals[0].title).toBe('Owner Goal: Launch NestJS API');
    expect(ownerRes.body.availability.weeklyHours.monday).toBe(8);

    // Member B reads own submission
    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberB.token))
      .expect(200);

    expect(bRes.body.userId).toBe(memberB.userId);
    expect(bRes.body.goals[0].title).toBe('Member B Goal: Write Unit Tests');
    expect(bRes.body.availability.weeklyHours.wednesday).toBe(6);

    // Member C reads own submission
    const cRes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberC.token))
      .expect(200);

    expect(cRes.body.userId).toBe(memberC.userId);
    expect(cRes.body.status).toBe('draft');
    expect(cRes.body.goals[0].title).toBe('Member C Secret Draft Goal');
  });

  it('3. others goals are completely unavailable during submission_open via GET /cycles/:id/submissions', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submissions`)
      .set(asUser(owner.token))
      .expect(409);

    expect(res.body.error).toMatchObject({
      code: 'CYCLE_STATE_INVALID',
      details: { phase: 'submission_open', operation: 'others.read' },
    });
  });

  it('4. locking: member locks own submitted submission via POST /cycles/:id/lock-submission (Item 6)', async () => {
    // Member C (draft) cannot lock
    const cLockRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/lock-submission`)
      .set(asUser(memberC.token))
      .expect(409);

    expect(cLockRes.body.error.code).toBe('CYCLE_STATE_INVALID');

    // Member B (submitted) locks own submission
    const bLockRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/lock-submission`)
      .set(asUser(memberB.token))
      .expect(201);

    expect(bLockRes.body.status).toBe('locked');
    expect(bLockRes.body.lockedAt).toBeDefined();

    // Member B tries to PATCH submission after lock -> 409 SUBMISSION_LOCKED
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberB.token))
      .send({
        goals: [
          {
            title: 'Sneaky goal update after lock',
            priority: 1,
            deadline: '2026-11-20',
          },
        ],
      })
      .expect(409);

    expect(patchRes.body.error).toMatchObject({
      code: 'SUBMISSION_LOCKED',
      message: 'This submission is locked and cannot be edited.',
    });
  });

  it('5. direct SQL UPDATE on a locked submission_goals row is rejected by database trigger', async () => {
    // Attempting direct raw update on the goal row belonging to locked submission
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE submission_goals SET title = 'Trigger Bypassed' WHERE id = '${memberBGoalId}'::uuid`
      )
    ).rejects.toThrow();
  });

  it('6. visibility: in group_review, member A sees B submitted goals but never availability/constraints or drafts (Item 7)', async () => {
    // Force advance cycle to group_review
    await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/advance`)
      .set(asUser(owner.token))
      .send({ force: true })
      .expect(201);

    // Owner reads others' submissions
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submissions`)
      .set(asUser(owner.token))
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);

    // Only submitted/locked submissions are visible (Owner and Member B)
    const userIds = res.body.items.map((i: { userId: string }) => i.userId);
    expect(userIds).toContain(owner.userId);
    expect(userIds).toContain(memberB.userId);
    // Member C's draft submission must NEVER appear
    expect(userIds).not.toContain(memberC.userId);

    // Verify privacy: availability and constraints MUST NOT be present on any returned item
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty('availability');
      expect(item).not.toHaveProperty('constraints');
      expect(item.goals).toBeDefined();
      expect(item.goals.length).toBeGreaterThan(0);
      for (const goal of item.goals) {
        expect(goal).not.toHaveProperty('availability');
        expect(goal).not.toHaveProperty('constraints');
      }
    }

    // Member B reads others' submissions
    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submissions`)
      .set(asUser(memberB.token))
      .expect(200);

    const bUserIds = bRes.body.items.map((i: { userId: string }) => i.userId);
    expect(bUserIds).toContain(owner.userId);
    expect(bUserIds).not.toContain(memberC.userId);
  });
});
