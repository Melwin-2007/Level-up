import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CLOCK } from '../src/common/clock/clock.js';
import { FakeClock } from './helpers/clock.js';
import { LLM_CLIENT } from '../src/ai/llm-client.interface.js';
import { FakeLlmClient } from '../src/ai/fake-llm.client.js';
import { requestIdMiddleware } from '../src/common/middleware/request-id.middleware.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { createTestUser, asUser, TestUser } from './helpers/auth.helper.js';

describe('Plan Generation API (e2e - P23)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;
  let fakeLlmClient: FakeLlmClient;

  let owner: TestUser;
  let memberB: TestUser;
  let nonMember: TestUser;

  let groupId: string;
  let cycleId: string;
  let goalId: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    fakeClock = new FakeClock(new Date('2026-11-01T10:00:00.000Z'));
    fakeLlmClient = new FakeLlmClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .overrideProvider(LLM_CLIENT)
      .useValue(fakeLlmClient)
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

    owner = await createTestUser('p23-owner');
    memberB = await createTestUser('p23-memberb');
    nonMember = await createTestUser('p23-nonmember');

    // Create profiles
    const users = [owner, memberB, nonMember];
    for (const u of users) {
      await request(app.getHttpServer())
        .put('/api/v1/me')
        .set(asUser(u.token))
        .send({ displayName: `User ${u.userId.slice(0, 6)}`, timezone: 'UTC' })
        .expect(200);
    }

    // Create group with owner and invite memberB
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(owner.token))
      .send({ name: 'Plan Gen Group' })
      .expect(201);

    groupId = groupRes.body.id;
    createdGroupIds.push(groupId);

    const inviteCode = groupRes.body.inviteCode;
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(memberB.token))
      .send({ inviteCode })
      .expect(201);

    // Create cycle for Nov 2026
    const cycleRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T00:00:00.000Z',
        reviewDeadline: '2026-11-10T00:00:00.000Z',
      })
      .expect(201);
    cycleId = cycleRes.body.id;

    // Create submission for owner with 1 goal
    const subRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Build AI Scheduler',
            priority: 1,
            estimatedHours: 20,
            deadline: '2026-11-20',
          },
        ],
        availability: {
          weeklyHours: {
            monday: 5,
            tuesday: 5,
            wednesday: 5,
            thursday: 5,
            friday: 5,
            saturday: 0,
            sunday: 0,
          },
          exceptions: [],
        },
        constraints: { fixedCommitments: [] },
        submit: true,
      })
      .expect(201);

    goalId = subRes.body.goals[0].id;

    // Configure fake LLM client fixture using actual goalId
    fakeLlmClient.setDefaultResponse({
      feasibility: {
        verdict: 'feasible',
        totalEstimatedHours: 20,
        totalAvailableHours: 100,
        capacityRatio: 0.2,
        goalVerdicts: [
          {
            goalId,
            status: 'achievable',
            risks: [],
            recommendations: ['Deliver ahead of schedule'],
          },
        ],
        conflicts: [],
        rationale: 'Healthy weekly capacity buffer available.',
      },
      milestones: [
        {
          goalId,
          title: 'Design scheduler interface and state machine',
          targetWeek: 1,
          estimatedMinutes: 600,
          dependencies: [],
        },
        {
          goalId,
          title: 'Implement AI planner generator endpoint',
          targetWeek: 2,
          estimatedMinutes: 600,
          dependencies: [],
        },
      ],
      pacingSummary: 'Balanced 10h/week delivery cadence.',
    });
  }, 120000);

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE plan_items DISABLE TRIGGER trg_plan_items_immutable;`
      );
      for (const gid of createdGroupIds) {
        await prisma.group.deleteMany({ where: { id: gid } });
      }
    } catch {
      // Ignore cleanup error if DB triggers prevent cascade
    } finally {
      await prisma
        .$executeRawUnsafe(`ALTER TABLE plan_items ENABLE TRIGGER trg_plan_items_immutable;`)
        .catch(() => {});
    }

    const users = [owner, memberB, nonMember];
    for (const u of users) {
      if (u) {
        await prisma.profile.deleteMany({ where: { id: u.userId } }).catch(() => {});
        await u.cleanup().catch(() => {});
      }
    }
    await app.close();
  }, 60000);

  it('should reject plan generation when cycle is in submission_open phase', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({})
      .expect(409);

    expect(res.body.error.code).toBe('CYCLE_STATE_INVALID');
  });

  it('should reject plan generation if submission is not locked', async () => {
    // Advance cycle to planning directly in DB for testing
    await prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: { status: 'planning' },
    });

    // Owner submission is currently "submitted", not "locked"
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.submissionStatus).toBe('submitted');
  });

  it('should reject non-member from generating a plan', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(nonMember.token))
      .send({})
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should successfully generate initial plan version when submission is locked', async () => {
    // Lock owner's submission
    await prisma.monthlySubmission.updateMany({
      where: { cycleId, userId: owner.userId },
      data: { status: 'locked', lockedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({})
      .expect(201);

    const plan = res.body.planVersion;
    expect(plan.cycleId).toBe(cycleId);
    expect(plan.userId).toBe(owner.userId);
    expect(plan.versionNumber).toBe(1);
    expect(plan.versionType).toBe('initial');
    expect(plan.approvalStatus).toBe('pending');
    expect(plan.isBaseline).toBe(false);
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0].title).toBe('Design scheduler interface and state machine');
    expect(plan.items[0].weekNumber).toBe(1);
    expect(plan.items[0].estimatedMinutes).toBe(600);
    expect(plan.planSnapshot.feasibility.verdict).toBe('feasible');

    // Verify persisted in DB
    const dbPlan = await prisma.planVersion.findUnique({
      where: {
        cycleId_userId_versionNumber: {
          cycleId,
          userId: owner.userId,
          versionNumber: 1,
        },
      },
      include: { planItems: true },
    });

    expect(dbPlan).not.toBeNull();
    expect(dbPlan?.approvalStatus).toBe('pending');
    expect(dbPlan?.isBaseline).toBe(false);
    expect(dbPlan?.planItems).toHaveLength(2);
  });

  it('should regenerate plan with adjustmentsNote and increment version number', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({
        adjustmentsNote: 'Please shift week 1 workload to week 3',
      })
      .expect(201);

    const plan = res.body.planVersion;
    expect(plan.versionNumber).toBe(2);
    expect(plan.versionType).toBe('reoptimized');
    expect(plan.approvalStatus).toBe('pending');
    expect(plan.isBaseline).toBe(false);

    // Verify Version 1 is still intact in DB (immutability of previous versions)
    const v1 = await prisma.planVersion.findUnique({
      where: {
        cycleId_userId_versionNumber: {
          cycleId,
          userId: owner.userId,
          versionNumber: 1,
        },
      },
    });
    expect(v1).not.toBeNull();
    expect(v1?.versionNumber).toBe(1);
  });

  it('should enforce rate limit of 3 plan generations per cycle per member', async () => {
    // 3rd generation
    await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({ adjustmentsNote: 'Fine tune pacing' })
      .expect(201);

    // 4th generation should be rejected with 429
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({ adjustmentsNote: 'Exceeding limit' })
      .expect(429);

    expect(res.body.error.code).toBe('PLAN_GENERATION_LIMIT_EXCEEDED');
  });

  it('should allow fetching the generated plan via GET /cycles/:id/plan', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/cycles/${cycleId}/plan`)
      .set(asUser(owner.token))
      .expect(200);

    expect(res.body.planVersion).not.toBeNull();
    expect(res.body.planVersion.versionNumber).toBe(3); // latest pending
    expect(res.body.planVersion.items).toHaveLength(2);
  });
});
