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

describe('Plan Approval API (e2e - P24)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;
  let fakeLlmClient: FakeLlmClient;

  let owner: TestUser;
  let memberB: TestUser;
  let nonMember: TestUser;

  let groupId: string;
  let cycleId: string;
  let ownerPlanVersionId: string;
  let memberBPlanVersionId: string;
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

    owner = await createTestUser('p24-owner');
    memberB = await createTestUser('p24-memberb');
    nonMember = await createTestUser('p24-nonmember');

    // Create user profiles
    const users = [owner, memberB, nonMember];
    for (const u of users) {
      await request(app.getHttpServer())
        .put('/api/v1/me')
        .set(asUser(u.token))
        .send({ displayName: `User ${u.userId.slice(0, 6)}`, timezone: 'UTC' })
        .expect(200);
    }

    // Owner creates group and Member B joins
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(owner.token))
      .send({ name: 'Plan Approval Group' })
      .expect(201);

    groupId = groupRes.body.id;
    createdGroupIds.push(groupId);

    const inviteCode = groupRes.body.inviteCode;
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(memberB.token))
      .send({ inviteCode })
      .expect(201);

    // Create November 2026 cycle
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

    // Both owner and memberB submit goals
    const ownerSub = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Owner AI Roadmap',
            priority: 1,
            estimatedHours: 20,
            deadline: '2026-11-20',
          },
        ],
        availability: { weeklyHours: { monday: 8, tuesday: 8 } },
        constraints: { fixedCommitments: [] },
        submit: true,
      })
      .expect(201);

    const memberBSub = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(memberB.token))
      .send({
        goals: [
          {
            title: 'Member B Mobile Feature',
            priority: 1,
            estimatedHours: 15,
            deadline: '2026-11-25',
          },
        ],
        availability: { weeklyHours: { wednesday: 6, thursday: 6 } },
        constraints: { fixedCommitments: [] },
        submit: true,
      })
      .expect(201);

    // Advance cycle to planning and lock both submissions
    await prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: { status: 'planning' },
    });

    await prisma.monthlySubmission.updateMany({
      where: { cycleId },
      data: { status: 'locked', lockedAt: new Date() },
    });

    // Configure fake LLM client default responses
    fakeLlmClient.setDefaultResponse({
      feasibility: {
        verdict: 'feasible',
        totalEstimatedHours: 20,
        totalAvailableHours: 80,
        capacityRatio: 0.25,
        goalVerdicts: [
          {
            goalId: ownerSub.body.goals[0].id,
            status: 'achievable',
            risks: [],
            recommendations: ['Follow weekly schedule'],
          },
        ],
        conflicts: [],
        rationale: 'Balanced distribution.',
      },
      milestones: [
        {
          goalId: ownerSub.body.goals[0].id,
          title: 'Complete foundational modules',
          targetWeek: 1,
          estimatedMinutes: 600,
          dependencies: [],
        },
      ],
      pacingSummary: '10 hours weekly delivery.',
    });

    // Generate plan version for owner
    const ownerPlanRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(owner.token))
      .send({})
      .expect(201);
    ownerPlanVersionId = ownerPlanRes.body.planVersion.id;

    // Configure fake LLM client for memberB
    fakeLlmClient.setDefaultResponse({
      feasibility: {
        verdict: 'feasible',
        totalEstimatedHours: 15,
        totalAvailableHours: 60,
        capacityRatio: 0.25,
        goalVerdicts: [
          {
            goalId: memberBSub.body.goals[0].id,
            status: 'achievable',
            risks: [],
            recommendations: ['Follow weekly schedule'],
          },
        ],
        conflicts: [],
        rationale: 'Well paced.',
      },
      milestones: [
        {
          goalId: memberBSub.body.goals[0].id,
          title: 'Implement mobile UI review screens',
          targetWeek: 2,
          estimatedMinutes: 600,
          dependencies: [],
        },
      ],
      pacingSummary: '10 hours weekly delivery.',
    });

    // Generate plan version for memberB
    const memberBPlanRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/generate-plan`)
      .set(asUser(memberB.token))
      .send({})
      .expect(201);
    memberBPlanVersionId = memberBPlanRes.body.planVersion.id;
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
  }, 120000);

  it('1. should reject approval when cycle is not in planning phase', async () => {
    // Temporarily set cycle to group_review
    await prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: { status: 'group_review' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(owner.token))
      .send({ planVersionId: ownerPlanVersionId })
      .expect(409);

    expect(res.body.error.code).toBe('CYCLE_STATE_INVALID');

    // Restore cycle to planning
    await prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: { status: 'planning' },
    });
  });

  it('2. should reject non-member from approving a plan', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(nonMember.token))
      .send({ planVersionId: ownerPlanVersionId })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('3. should reject approving a plan version belonging to another user', async () => {
    // Owner tries to approve Member B's plan
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(owner.token))
      .send({ planVersionId: memberBPlanVersionId })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('4. should successfully approve owner pending plan and promote to baseline', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(owner.token))
      .send({ planVersionId: ownerPlanVersionId })
      .expect(201);

    const approvedPlan = res.body.planVersion;
    expect(approvedPlan.id).toBe(ownerPlanVersionId);
    expect(approvedPlan.approvalStatus).toBe('approved');
    expect(approvedPlan.isBaseline).toBe(true);
    expect(approvedPlan.approvedAt).toBeDefined();

    // Verify persisted in DB
    const dbPlan = await prisma.planVersion.findUnique({
      where: { id: ownerPlanVersionId },
    });
    expect(dbPlan?.approvalStatus).toBe('approved');
    expect(dbPlan?.isBaseline).toBe(true);
    expect(dbPlan?.approvedAt).not.toBeNull();

    // Verify cycle is still in planning because Member B has not approved yet
    const cycle = await prisma.monthlyCycle.findUnique({ where: { id: cycleId } });
    expect(cycle?.status).toBe('planning');
  });

  it('5. should reject approving an already approved plan version', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(owner.token))
      .send({ planVersionId: ownerPlanVersionId })
      .expect(409);

    expect(res.body.error.code).toBe('CYCLE_STATE_INVALID');
  });

  it('6. should reject approving a second baseline plan version for same member', async () => {
    // If owner tries to create or approve another plan version, baseline is already locked
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(owner.token))
      .send({ planVersionId: ownerPlanVersionId })
      .expect(409);

    expect(res.body.error.code).toBe('CYCLE_STATE_INVALID');
  });

  it('7. should auto-advance cycle to execution once all participating members approve their plans', async () => {
    // Member B approves their plan version
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/approve-plan`)
      .set(asUser(memberB.token))
      .send({ planVersionId: memberBPlanVersionId })
      .expect(201);

    expect(res.body.planVersion.approvalStatus).toBe('approved');
    expect(res.body.planVersion.isBaseline).toBe(true);

    // Verify cycle status has automatically transitioned from planning to execution
    const cycle = await prisma.monthlyCycle.findUnique({ where: { id: cycleId } });
    expect(cycle?.status).toBe('execution');
  });
});
