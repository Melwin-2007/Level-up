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

interface ExpressLayer {
  name?: string;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
  handle?: {
    stack?: ExpressLayer[];
  };
}

interface ExpressRouter {
  stack?: ExpressLayer[];
}

interface RouteInfo {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
}

function extractRoutes(app: INestApplication): RouteInfo[] {
  const instance = app.getHttpAdapter().getInstance() as Record<string, unknown>;
  const router = (instance['_router'] ?? (instance['router'] as ExpressRouter)) as
    ExpressRouter | undefined;
  const routes: RouteInfo[] = [];
  const validMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

  function processStack(stack: ExpressLayer[]) {
    for (const layer of stack) {
      if (layer.route?.path && layer.route.methods) {
        const path = layer.route.path;
        if (path.includes('*')) {
          continue;
        }
        for (const method of Object.keys(layer.route.methods)) {
          const lowerMethod = method.toLowerCase();
          if (validMethods.has(lowerMethod) && layer.route.methods[method]) {
            routes.push({
              method: lowerMethod as RouteInfo['method'],
              path,
            });
          }
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        processStack(layer.handle.stack);
      }
    }
  }

  if (router?.stack) {
    processStack(router.stack);
  }

  return routes;
}

describe('Authorization Fuzz Test (docs/SECURITY.md Section 5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeClock: FakeClock;

  let owner: TestUser;
  let member: TestUser;
  let nonMember: TestUser;

  let groupId: string;
  let cycleId: string;
  let reviewId: string;
  let goalId: string;

  let allRoutes: RouteInfo[] = [];
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

    // Discover all registered routes from Nest/Express router dynamically
    allRoutes = extractRoutes(app);

    // Create test users
    owner = await createTestUser('fuzz-owner');
    member = await createTestUser('fuzz-member');
    nonMember = await createTestUser('fuzz-nonmember');

    // Onboard users
    for (const u of [owner, member, nonMember]) {
      await request(app.getHttpServer())
        .put('/api/v1/me')
        .set(asUser(u.token))
        .send({ displayName: `User ${u.userId.slice(0, 6)}`, timezone: 'UTC' })
        .expect(200);
    }

    // Owner creates group
    const grpRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(asUser(owner.token))
      .send({ name: 'Fuzz Testing Group' })
      .expect(201);

    groupId = grpRes.body.id;
    createdGroupIds.push(groupId);

    // Member joins group
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set(asUser(member.token))
      .send({ inviteCode: grpRes.body.inviteCode })
      .expect(201);

    // Owner creates cycle
    const cycRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/cycles`)
      .set(asUser(owner.token))
      .send({
        year: 2026,
        month: 11,
        submissionDeadline: '2026-11-05T10:00:00.000Z',
        reviewDeadline: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    cycleId = cycRes.body.id;

    // Owner creates submission
    const subRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/submission`)
      .set(asUser(owner.token))
      .send({
        goals: [
          {
            title: 'Fuzz Goal',
            priority: 1,
            deadline: '2026-11-20',
          },
        ],
        submit: true,
      })
      .expect(201);

    goalId = subRes.body.goals[0].id;

    // Advance to review so review endpoints exist
    await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/advance`)
      .set(asUser(owner.token))
      .send({ force: true })
      .expect(201);

    const revRes = await request(app.getHttpServer())
      .post(`/api/v1/cycles/${cycleId}/reviews`)
      .set(asUser(owner.token))
      .expect(201);

    reviewId = revRes.body.id;
  }, 120000);

  afterAll(async () => {
    try {
      if (createdGroupIds.length > 0) {
        await prisma.group.deleteMany({
          where: { id: { in: createdGroupIds } },
        });
      }

      for (const u of [owner, member, nonMember]) {
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

  function resolvePath(pattern: string): string {
    if (pattern.includes('/groups/:id/cycles')) {
      return pattern.replace(':id', groupId);
    }
    if (pattern.includes('/groups/:id')) {
      return pattern.replace(':id', groupId);
    }
    if (pattern.includes('/cycles/current')) {
      return `${pattern}?groupId=${groupId}`;
    }
    if (pattern.includes('/cycles/:id')) {
      return pattern.replace(':id', cycleId);
    }
    if (pattern.includes('/reviews/:id')) {
      return pattern.replace(':id', reviewId);
    }
    return pattern;
  }

  it('1. should dynamically extract routes from Nest router', () => {
    expect(allRoutes.length).toBeGreaterThan(10);
    const paths = allRoutes.map((r) => r.path);
    expect(paths).toContain('/api/v1/health');
    expect(paths).toContain('/api/v1/me');
    expect(paths).toContain('/api/v1/groups');
    expect(paths).toContain('/api/v1/groups/:id');
    expect(paths).toContain('/api/v1/cycles/:id');
    expect(paths).toContain('/api/v1/reviews/:id/comments');
  });

  it('2. unauthenticated call (no token): all protected routes return 401 UNAUTHENTICATED', async () => {
    for (const route of allRoutes) {
      if (route.path === '/api/v1/health') {
        continue; // Public route
      }

      const url = resolvePath(route.path);
      const req = request(app.getHttpServer())[route.method](url);
      const res = await req;

      expect(
        res.status,
        `Route ${route.method.toUpperCase()} ${url} should require auth, but returned ${res.status}`
      ).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('3. non-member call: all group/cycle/review-scoped routes return 404 NOT_FOUND', async () => {
    const scopedRoutes = allRoutes.filter((r) => {
      return (
        r.path.includes('/groups/:id') ||
        r.path.includes('/cycles/') ||
        r.path.includes('/reviews/')
      );
    });

    for (const route of scopedRoutes) {
      const url = resolvePath(route.path);
      const req = request(app.getHttpServer())[route.method](url).set(asUser(nonMember.token));

      // Send payload for post/put/patch to avoid payload validation blocking before membership guard
      if (route.method === 'post' || route.method === 'patch' || route.method === 'put') {
        req.send({
          name: 'Test',
          year: 2026,
          month: 12,
          submissionDeadline: '2026-12-05T10:00:00.000Z',
          reviewDeadline: '2026-12-10T10:00:00.000Z',
          submissionGoalId: goalId,
          comment: 'Fuzzing comment',
          goals: [{ title: 'Fuzz goal', priority: 1, deadline: '2026-11-20' }],
        });
      }

      const res = await req;
      expect(
        res.status,
        `Route ${route.method.toUpperCase()} ${url} for non-member should return 404, but got ${res.status} (${JSON.stringify(res.body)})`
      ).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('4. member without needed role: admin-only routes return 403 FORBIDDEN_ROLE', async () => {
    const adminRoutes: RouteInfo[] = [
      { method: 'post', path: '/api/v1/groups/:id/cycles' },
      { method: 'post', path: '/api/v1/cycles/:id/advance' },
      { method: 'post', path: '/api/v1/cycles/:id/reviews' },
      { method: 'post', path: '/api/v1/reviews/:id/complete' },
    ];

    for (const route of adminRoutes) {
      const url = resolvePath(route.path);
      const req = request(app.getHttpServer())[route.method](url).set(asUser(member.token)).send({
        year: 2026,
        month: 12,
        submissionDeadline: '2026-12-05T10:00:00.000Z',
        reviewDeadline: '2026-12-10T10:00:00.000Z',
      });

      const res = await req;
      expect(
        res.status,
        `Admin route ${route.method.toUpperCase()} ${url} for plain member should return 403, but got ${res.status}`
      ).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    }
  });
});
