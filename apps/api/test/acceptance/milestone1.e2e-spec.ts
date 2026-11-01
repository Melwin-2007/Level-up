import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { CLOCK } from '../../src/common/clock/clock.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { requestIdMiddleware } from '../../src/common/middleware/request-id.middleware.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { asUser, createTestUser, type TestUser } from '../helpers/auth.helper.js';
import { FakeClock } from '../helpers/clock.js';

describe('Milestone 1 Acceptance Suite (SPEC 7.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;

  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;

  let groupId: string;
  let inviteCode: string;
  let cycleId: string;
  let reviewId: string;

  let goalA1Id: string;
  let goalB1Id: string;
  let goalC1Id: string;

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
    userA = await createTestUser('acc-a');
    userB = await createTestUser('acc-b');
    userC = await createTestUser('acc-c');
  }, 120000);

  afterAll(async () => {
    try {
      if (createdGroupIds.length > 0) {
        await prisma.group.deleteMany({
          where: { id: { in: createdGroupIds } },
        });
      }

      const users = [userA, userB, userC];
      for (const u of users) {
        if (u) {
          await prisma.profile.deleteMany({ where: { id: u.userId } }).catch(() => {});
          await u.cleanup().catch(() => {});
        }
      }
    } catch {
      // Ignored during teardown
    } finally {
      await app.close();
    }
  }, 120000);

  it('1. Users A, B, and C onboard and create their profiles', async () => {
    const resA = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userA.token))
      .send({ displayName: 'Alice (Owner)', timezone: 'America/New_York' })
      .expect(200);

    expect(resA.body.displayName).toBe('Alice (Owner)');
    expect(resA.body.timezone).toBe('America/New_York');

    const resB = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userB.token))
      .send({ displayName: 'Bob (Member)', timezone: 'Europe/London' })
      .expect(200);

    expect(resB.body.displayName).toBe('Bob (Member)');

    const resC = await request(app.getHttpServer())
      .put('/api/v1/me')
      .set(asUser(userC.token))
      .send({ displayName: 'Charlie (Member)', timezone: 'Asia/Tokyo' })
      .expect(200);

    expect(resC.body.displayName).toBe('Charlie (Member)');
  });

  it('2. A creates group, B and C join using the invite code', async () => {
    // A creates group
    const createGroupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(userA.token))
      .send({ name: 'Alpha Squad' })
      .expect(201);

    groupId = createGroupRes.body.id;
    inviteCode = createGroupRes.body.inviteCode;
    createdGroupIds.push(groupId);

    expect(groupId).toBeDefined();
    expect(inviteCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(createGroupRes.body.role).toBe('owner');

    // B joins
    const joinBRes = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(userB.token))
      .send({ inviteCode })
      .expect(201);

    expect(joinBRes.body.id).toBe(groupId);
    expect(joinBRes.body.role).toBe('member');
    expect(joinBRes.body.inviteCode).toBeUndefined(); // Plain members cannot see inviteCode

    // C joins
    const joinCRes = await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(userC.token))
      .send({ inviteCode })
      .expect(201);

    expect(joinCRes.body.id).toBe(groupId);
    expect(joinCRes.body.role).toBe('member');

    // Verify group detail has all 3 members
    const groupDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupId}`)
      .set(asUser(userA.token))
      .expect(200);

    expect(groupDetailRes.body.members).toHaveLength(3);
  });

  it('3. A creates November cycle', async () => {
    const cycleRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(userA.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T10:00:00.000Z',
        reviewDeadline: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    cycleId = cycleRes.body.id;
    expect(cycleId).toBeDefined();
    expect(cycleRes.body.status).toBe('submission_open');
  });

  it('4. All three members submit different goals during submission_open', async () => {
    // Reading others' goals is disallowed during submission_open
    await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submissions`)
      .set(asUser(userA.token))
      .expect(409);

    // User A submits
    const subARes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(userA.token))
      .send({
        availability: {
          weeklyHours: {
            monday: 6,
            tuesday: 6,
            wednesday: 6,
            thursday: 6,
            friday: 6,
          },
          exceptions: [],
        },
        constraints: {
          fixedCommitments: [{ title: 'Consulting', hoursPerWeek: 10 }],
          maxDailyHours: 8,
        },
        goals: [
          {
            title: 'Goal A1: Implement Backend Architecture',
            description: 'Finish all core services and state machines',
            category: 'Engineering',
            priority: 1,
            estimatedHours: 20,
            deadline: '2026-11-20',
          },
          {
            title: 'Goal A2: Database Optimization',
            description: 'Index tuning and connection pooling',
            category: 'Infrastructure',
            priority: 2,
            estimatedHours: 10,
            deadline: '2026-11-25',
          },
        ],
        submit: true,
      })
      .expect(201);

    expect(subARes.body.status).toBe('submitted');
    expect(subARes.body.goals).toHaveLength(2);
    goalA1Id = subARes.body.goals[0].id;

    // User B submits
    const subBRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(userB.token))
      .send({
        availability: {
          weeklyHours: { monday: 4, tuesday: 4, wednesday: 4, thursday: 4, friday: 4 },
          exceptions: [],
        },
        constraints: {
          fixedCommitments: [{ title: 'Study', hoursPerWeek: 15 }],
        },
        goals: [
          {
            title: 'Goal B1: Write Documentation and Guides',
            description: 'Comprehensive onboarding docs',
            category: 'Docs',
            priority: 1,
            estimatedHours: 12,
            deadline: '2026-11-22',
          },
        ],
        submit: true,
      })
      .expect(201);

    expect(subBRes.body.status).toBe('submitted');
    goalB1Id = subBRes.body.goals[0].id;

    // User C submits
    const subCRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(userC.token))
      .send({
        availability: {
          weeklyHours: { monday: 5, tuesday: 5, wednesday: 5, thursday: 5, friday: 5 },
          exceptions: [],
        },
        constraints: {
          fixedCommitments: [],
          maxDailyHours: 6,
        },
        goals: [
          {
            title: 'Goal C1: E2E Acceptance Testing',
            description: 'Automate all end-to-end integration scenarios',
            category: 'Testing',
            priority: 1,
            estimatedHours: 16,
            deadline: '2026-11-28',
          },
        ],
        submit: true,
      })
      .expect(201);

    expect(subCRes.body.status).toBe('submitted');
    goalC1Id = subCRes.body.goals[0].id;

    // Each member reads only their own submission via GET submission
    const ownARes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(userA.token))
      .expect(200);

    expect(ownARes.body.userId).toBe(userA.userId);
    expect(ownARes.body.availability.weeklyHours.monday).toBe(6);
    expect(ownARes.body.constraints.maxDailyHours).toBe(8);
  });

  it('5. Cycle advances to group_review', async () => {
    // Because all 3 members have submitted, transition condition holds
    const advanceRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/advance`)
      .set(asUser(userA.token))
      .send({})
      .expect(201);

    expect(advanceRes.body.status).toBe('group_review');
  });

  it("6. Each sees others' goals and NOT their private availability/constraints", async () => {
    const subsRes = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/submissions`)
      .set(asUser(userA.token))
      .expect(200);

    expect(subsRes.body.items).toHaveLength(3);

    for (const item of subsRes.body.items) {
      expect(item.status).toBe('submitted');
      expect(item.goals.length).toBeGreaterThan(0);
      // Privacy invariant: availability and constraints MUST NEVER be leaked in others' submissions view
      expect((item as Record<string, unknown>).availability).toBeUndefined();
      expect((item as Record<string, unknown>).constraints).toBeUndefined();
    }
  });

  it('7. A creates group review, and members leave attributed comments', async () => {
    // Owner A creates review
    const revRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(userA.token))
      .expect(201);

    reviewId = revRes.body.id;
    expect(reviewId).toBeDefined();

    // B comments on A's Goal A1
    const commB = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(userB.token))
      .send({
        submissionGoalId: goalA1Id,
        comment: 'Architecture plan is solid. Estimated hours look realistic.',
      })
      .expect(201);

    expect(commB.body.authorId).toBe(userB.userId);
    expect(commB.body.authorName).toBe('Bob (Member)');

    // C comments on B's Goal B1
    const commC = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(userC.token))
      .send({
        submissionGoalId: goalB1Id,
        comment: 'Please include API response schemas in the documentation.',
      })
      .expect(201);

    expect(commC.body.authorId).toBe(userC.userId);
    expect(commC.body.authorName).toBe('Charlie (Member)');

    // A comments on C's Goal C1
    const commA = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(userA.token))
      .send({
        submissionGoalId: goalC1Id,
        comment: 'I can supply test auth tokens for the test harnesses.',
      })
      .expect(201);

    expect(commA.body.authorId).toBe(userA.userId);
    expect(commA.body.authorName).toBe('Alice (Owner)');

    // Comments ordered ascending
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(userA.token))
      .expect(200);

    expect(listRes.body.items).toHaveLength(3);
    expect(listRes.body.items[0].authorId).toBe(userB.userId);
    expect(listRes.body.items[1].authorId).toBe(userC.userId);
    expect(listRes.body.items[2].authorId).toBe(userA.userId);
  });

  it('8. Review completion: locks submissions, preserves byte-identical originals, and rejects PATCH after lock', async () => {
    // 1. Snapshot all goal rows before review completion
    const goalsBefore = await prisma.submissionGoal.findMany({
      where: {
        submission: {
          cycleId,
        },
      },
      orderBy: { id: 'asc' },
    });

    expect(goalsBefore.length).toBe(4); // 2 from A + 1 from B + 1 from C

    // 2. Owner completes review
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/complete`)
      .set(asUser(userA.token))
      .expect(201);

    expect(completeRes.body.lockedCount).toBe(3);
    expect(completeRes.body.draftCount).toBe(0);
    expect(completeRes.body.completedAt).toBeDefined();

    // 3. Confirm all submissions are now locked in DB
    const submissions = await prisma.monthlySubmission.findMany({
      where: { cycleId },
    });

    expect(submissions).toHaveLength(3);
    for (const sub of submissions) {
      expect(sub.status).toBe('locked');
      expect(sub.lockedAt).toBeDefined();
    }

    // 4. Originals preserved: byte-identical comparison
    const goalsAfter = await prisma.submissionGoal.findMany({
      where: {
        submission: {
          cycleId,
        },
      },
      orderBy: { id: 'asc' },
    });

    expect(JSON.stringify(goalsBefore)).toBe(JSON.stringify(goalsAfter));

    // 5. PATCH after lock fails with 409
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(userA.token))
      .send({
        goals: [
          {
            title: 'Modified Goal After Lock',
            priority: 1,
            deadline: '2026-11-20',
          },
        ],
      })
      .expect(409);

    expect(['SUBMISSION_LOCKED', 'CYCLE_STATE_INVALID']).toContain(patchRes.body.error.code);
  });
});
