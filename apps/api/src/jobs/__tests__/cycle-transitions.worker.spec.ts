import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CycleTransitionsWorker } from '../cycle-transitions.worker';
import { JobsService } from '../jobs.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Clock } from '../../common/clock/clock';

interface MockPrisma {
  monthlyCycle: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  groupReview: {
    upsert: ReturnType<typeof vi.fn>;
  };
  monthlySubmission: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  planVersion: {
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('CycleTransitionsWorker (P44)', () => {
  let worker: CycleTransitionsWorker;
  let jobsService: JobsService;
  let mockPrisma: MockPrisma;
  let mockClock: Clock;

  const fixedNow = new Date('2026-11-06T12:00:00.000Z');

  beforeEach(() => {
    jobsService = new JobsService(null);
    mockClock = {
      now: vi.fn(() => fixedNow),
    };

    mockPrisma = {
      monthlyCycle: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      groupReview: {
        upsert: vi.fn(),
      },
      monthlySubmission: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      planVersion: {
        count: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    worker = new CycleTransitionsWorker(
      jobsService,
      mockPrisma as unknown as PrismaService,
      mockClock
    );
    worker.onModuleInit();
  });

  it('should auto-advance cycle from submission_open to group_review when past submission deadline', async () => {
    const cycle = {
      id: 'cycle-1',
      status: 'submission_open',
      submissionDeadline: new Date('2026-11-05T00:00:00.000Z'), // Past
    };

    mockPrisma.monthlyCycle.findMany
      .mockResolvedValueOnce([cycle]) // submission_open
      .mockResolvedValueOnce([]) // group_review
      .mockResolvedValueOnce([]) // planning
      .mockResolvedValueOnce([]); // execution

    const results = await worker.scanAndAdvanceCycles();

    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.cycleId).toBe('cycle-1');
      expect(first.fromStatus).toBe('submission_open');
      expect(first.toStatus).toBe('group_review');
    }

    expect(mockPrisma.monthlyCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-1' },
      data: { status: 'group_review' },
    });
    expect(mockPrisma.groupReview.upsert).toHaveBeenCalledWith({
      where: { cycleId: 'cycle-1' },
      create: { cycleId: 'cycle-1' },
      update: {},
    });
  });

  it('should auto-advance cycle from group_review to planning, locking submitted submissions and completing review', async () => {
    const cycle = {
      id: 'cycle-2',
      status: 'group_review',
      reviewDeadline: new Date('2026-11-05T00:00:00.000Z'), // Past
    };

    mockPrisma.monthlyCycle.findMany
      .mockResolvedValueOnce([]) // submission_open
      .mockResolvedValueOnce([cycle]) // group_review
      .mockResolvedValueOnce([]) // planning
      .mockResolvedValueOnce([]); // execution

    const results = await worker.scanAndAdvanceCycles();

    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.cycleId).toBe('cycle-2');
      expect(first.fromStatus).toBe('group_review');
      expect(first.toStatus).toBe('planning');
    }

    expect(mockPrisma.groupReview.upsert).toHaveBeenCalledWith({
      where: { cycleId: 'cycle-2' },
      create: { cycleId: 'cycle-2', completedAt: fixedNow },
      update: { completedAt: fixedNow },
    });

    expect(mockPrisma.monthlySubmission.updateMany).toHaveBeenCalledWith({
      where: {
        cycleId: 'cycle-2',
        status: 'submitted',
      },
      data: {
        status: 'locked',
        lockedAt: fixedNow,
      },
    });

    expect(mockPrisma.monthlyCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-2' },
      data: { status: 'planning' },
    });
  });

  it('should auto-advance cycle from planning to execution when all participating baseline plans are approved', async () => {
    const cycle = {
      id: 'cycle-3',
      status: 'planning',
    };

    mockPrisma.monthlyCycle.findMany
      .mockResolvedValueOnce([]) // submission_open
      .mockResolvedValueOnce([]) // group_review
      .mockResolvedValueOnce([cycle]) // planning
      .mockResolvedValueOnce([]); // execution

    mockPrisma.monthlySubmission.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    mockPrisma.planVersion.count.mockResolvedValue(2); // Both approved baseline

    const results = await worker.scanAndAdvanceCycles();

    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.cycleId).toBe('cycle-3');
      expect(first.fromStatus).toBe('planning');
      expect(first.toStatus).toBe('execution');
    }

    expect(mockPrisma.monthlyCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-3' },
      data: { status: 'execution' },
    });
  });

  it('should auto-advance cycle from execution to completed when the cycle month has ended', async () => {
    // Current time is 2026-11-06. If cycle was October 2026 (month 10), month ended 2026-11-01 00:00 UTC.
    const cycle = {
      id: 'cycle-4',
      status: 'execution',
      year: 2026,
      month: 10,
    };

    mockPrisma.monthlyCycle.findMany
      .mockResolvedValueOnce([]) // submission_open
      .mockResolvedValueOnce([]) // group_review
      .mockResolvedValueOnce([]) // planning
      .mockResolvedValueOnce([cycle]); // execution

    const results = await worker.scanAndAdvanceCycles();

    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.cycleId).toBe('cycle-4');
      expect(first.fromStatus).toBe('execution');
      expect(first.toStatus).toBe('completed');
    }

    expect(mockPrisma.monthlyCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-4' },
      data: { status: 'completed' },
    });
  });
});
