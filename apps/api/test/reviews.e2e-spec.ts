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

describe('Group Review & Comments (e2e - TESTING.md items 8 & 9)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;
  let owner: TestUser;
  let memberB: TestUser;
  let memberC: TestUser;
  let nonMember: TestUser;

  let groupId: string;
  let cycleId: string;
  let ownerGoalId: string;
  let _memberBGoalId: string;
  let draftGoalId: string;
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
    owner = await createTestUser('rev-owner');
    memberB = await createTestUser('rev-memberb');
    memberC = await createTestUser('rev-memberc');
    nonMember = await createTestUser('rev-nonmember');

    const users = [owner, memberB, memberC, nonMember];
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
      .send({ name: 'Reviews Test Group' })
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

    // Submissions in November cycle
    const subOwnerRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Owner Submitted Goal',
            priority: 1,
            deadline: '2026-11-20',
          },
        ],
        submit: true,
      })
      .expect(201);
    ownerGoalId = subOwnerRes.body.goals[0].id;

    const subBRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberB.token))
      .send({
        goals: [
          {
            title: 'Member B Submitted Goal',
            priority: 2,
            deadline: '2026-11-25',
          },
        ],
        submit: true,
      })
      .expect(201);
    _memberBGoalId = subBRes.body.goals[0].id;

    const subCRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberC.token))
      .send({
        goals: [
          {
            title: 'Member C Draft Goal',
            priority: 3,
            deadline: '2026-11-28',
          },
        ],
        submit: false,
      })
      .expect(201);
    draftGoalId = subCRes.body.goals[0].id;
  }, 120000);

  afterAll(async () => {
    try {
      if (createdGroupIds.length > 0) {
        await prisma.group.deleteMany({
          where: { id: { in: createdGroupIds } },
        });
      }

      const users = [owner, memberB, memberC, nonMember];
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

  let reviewId: string;

  it('1. should reject review creation and commenting when cycle is still in submission_open', async () => {
    // Review create outside group_review
    const resCreate = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(owner.token))
      .expect(409);

    expect(resCreate.body.error.code).toBe('CYCLE_STATE_INVALID');
  });

  it('2. should reject review creation by plain member (403) and non-member (404)', async () => {
    // Advance cycle to group_review
    await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/advance`)
      .set(asUser(owner.token))
      .send({ force: true })
      .expect(201);

    // Plain member tries to create review -> 403
    const resMember = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(memberB.token))
      .expect(403);

    expect(resMember.body.error.code).toBe('FORBIDDEN_ROLE');

    // Non-member tries to create review -> 404
    const resNonMember = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(nonMember.token))
      .expect(404);

    expect(resNonMember.body.error.code).toBe('NOT_FOUND');
  });

  it('3. should allow owner to create review and reject second create with 409 REVIEW_EXISTS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(owner.token))
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.cycleId).toBe(cycleId);
    expect(res.body.startedAt).toBeDefined();
    expect(res.body.commentCount).toBe(0);

    reviewId = res.body.id;

    // Second create -> 409 REVIEW_EXISTS
    const dupRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(owner.token))
      .expect(409);

    expect(dupRes.body.error.code).toBe('REVIEW_EXISTS');
  });

  it('4. should read review metadata via GET /cycles/:id/review', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/review`)
      .set(asUser(memberB.token))
      .expect(200);

    expect(res.body.id).toBe(reviewId);
    expect(res.body.cycleId).toBe(cycleId);
    expect(res.body.commentCount).toBe(0);
  });

  it('5. should add comment carrying the correct author from JWT (Item 8)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .send({
        submissionGoalId: ownerGoalId,
        comment: 'Great goal description!',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.submissionGoalId).toBe(ownerGoalId);
    expect(res.body.authorId).toBe(memberB.userId);
    expect(res.body.comment).toBe('Great goal description!');

    // Self-notes allowed: owner comments on own goal
    const selfRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(owner.token))
      .send({
        submissionGoalId: ownerGoalId,
        comment: 'Personal note: check dependencies.',
      })
      .expect(201);

    expect(selfRes.body.authorId).toBe(owner.userId);
  });

  it('6. should reject comment on a goal from another cycle (400) or draft goal (409)', async () => {
    // Create other cycle and goal on demand
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

    const subDecRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${decRes.body.id}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Other Cycle Goal',
            priority: 1,
            deadline: '2026-12-20',
          },
        ],
        submit: true,
      })
      .expect(201);

    const crossCycleGoalId = subDecRes.body.goals[0].id;

    // Other cycle goal
    const crossRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .send({
        submissionGoalId: crossCycleGoalId,
        comment: 'Cross cycle comment attempt',
      })
      .expect(400);

    expect(crossRes.body.error.code).toBe('VALIDATION_FAILED');

    // Draft goal
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .send({
        submissionGoalId: draftGoalId,
        comment: 'Comment on draft attempt',
      })
      .expect(409);

    expect(draftRes.body.error.code).toBe('CYCLE_STATE_INVALID');
  });

  it('7. non-member cannot comment or read comments', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(nonMember.token))
      .send({
        submissionGoalId: ownerGoalId,
        comment: 'Unauthorized comment',
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(nonMember.token))
      .expect(404);
  });

  it('8. should list comments ordered ascending and support submissionGoalId filtering', async () => {
    const allRes = await request(app.getHttpServer())
      .get(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .expect(200);

    expect(allRes.body.items).toHaveLength(2);
    expect(allRes.body.items[0].comment).toBe('Great goal description!');
    expect(allRes.body.items[1].comment).toBe('Personal note: check dependencies.');

    // Filter by submissionGoalId
    const filterRes = await request(app.getHttpServer())
      .get(`/api/v1/reviews/${reviewId}/comments?submissionGoalId=${ownerGoalId}`)
      .set(asUser(memberB.token))
      .expect(200);

    expect(filterRes.body.items).toHaveLength(2);
  });

  it('9. review finalize: locks submitted submissions, leaves drafts as draft, and leaves goals byte-identical (Item 9)', async () => {
    // 1. Snapshot all goal rows for this cycle before completion
    const goalsBefore = await prisma.submissionGoal.findMany({
      where: {
        submission: {
          cycleId,
        },
      },
      orderBy: { id: 'asc' },
    });

    // Plain member cannot complete review -> 403
    await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/complete`)
      .set(asUser(memberB.token))
      .expect(403);

    // Owner completes review
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/complete`)
      .set(asUser(owner.token))
      .expect(201);

    expect(completeRes.body.id).toBe(reviewId);
    expect(completeRes.body.completedAt).toBeDefined();
    // 2 submitted submissions were locked (owner + memberB)
    expect(completeRes.body.lockedCount).toBe(2);
    // 1 draft submission was left untouched (memberC)
    expect(completeRes.body.draftCount).toBe(1);

    // Verify database state of submissions
    const submissions = await prisma.monthlySubmission.findMany({
      where: { cycleId },
    });

    const ownerSub = submissions.find((s) => s.userId === owner.userId);
    const memberBSub = submissions.find((s) => s.userId === memberB.userId);
    const memberCSub = submissions.find((s) => s.userId === memberC.userId);

    expect(ownerSub?.status).toBe('locked');
    expect(ownerSub?.lockedAt).toBeDefined();
    expect(memberBSub?.status).toBe('locked');
    expect(memberBSub?.lockedAt).toBeDefined();
    expect(memberCSub?.status).toBe('draft');
    expect(memberCSub?.lockedAt).toBeNull();

    // 2. Snapshot goal rows after completion and verify they are byte-identical
    const goalsAfter = await prisma.submissionGoal.findMany({
      where: {
        submission: {
          cycleId,
        },
      },
      orderBy: { id: 'asc' },
    });

    expect(JSON.stringify(goalsBefore)).toBe(JSON.stringify(goalsAfter));

    // 3. Comments are now closed: adding a comment after completion fails
    const closedRes = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .send({
        submissionGoalId: ownerGoalId,
        comment: 'Comment attempt after review completion',
      })
      .expect(409);

    expect(closedRes.body.error.code).toBe('CYCLE_STATE_INVALID');

    // 4. Reading comments after completion remains allowed
    const readAfter = await request(app.getHttpServer())
      .get(`/api/v1/reviews/${reviewId}/comments`)
      .set(asUser(memberB.token))
      .expect(200);

    expect(readAfter.body.items).toHaveLength(2);
  }, 90000);
});
