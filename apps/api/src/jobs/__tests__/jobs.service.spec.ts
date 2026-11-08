import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobsService } from '../jobs.service';
import type { AppJob } from '../jobs.types';

describe('JobsService (P40)', () => {
  let service: JobsService;

  beforeEach(() => {
    // Instantiate with null Redis (in-memory mode)
    service = new JobsService(null);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should initialize queues and return default empty statuses', async () => {
    const statuses = await service.getAllQueueStatuses();
    expect(statuses).toHaveLength(2);
    expect(statuses.map((s) => s.name)).toEqual(['cycles', 'reminders']);
    const firstStatus = statuses[0];
    expect(firstStatus).toBeDefined();
    if (firstStatus) {
      expect(firstStatus.waiting).toBe(0);
      expect(firstStatus.completed).toBe(0);
    }
  });

  it('should add a job to the cycles queue', async () => {
    const job = await service.addJob('cycles', 'auto-advance', { cycleId: 'cycle-123' });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.name).toBe('auto-advance');
    expect(job.data).toEqual({ cycleId: 'cycle-123' });

    const status = await service.getQueueStatus('cycles');
    expect(status.waiting).toBe(1);
  });

  it('should process job when a worker is registered', async () => {
    const processed: AppJob[] = [];
    const processPromise = new Promise<void>((resolve) => {
      service.registerWorker('reminders', async (job) => {
        processed.push(job);
        resolve();
      });
    });

    await service.addJob('reminders', 'send-push', { userId: 'user-1', text: 'Reminder' });
    await processPromise;

    expect(processed).toHaveLength(1);
    const firstProcessed = processed[0];
    expect(firstProcessed).toBeDefined();
    if (firstProcessed) {
      expect(firstProcessed.name).toBe('send-push');
      expect(firstProcessed.data).toEqual({ userId: 'user-1', text: 'Reminder' });
    }

    const status = await service.getQueueStatus('reminders');
    expect(status.completed).toBe(1);
    expect(status.waiting).toBe(0);
  });

  it('should support delayed jobs', async () => {
    vi.useFakeTimers();

    let jobRan = false;
    service.registerWorker('cycles', async () => {
      jobRan = true;
    });

    await service.addJob('cycles', 'delayed-check', { foo: 'bar' }, { delay: 5000 });

    const initialStatus = await service.getQueueStatus('cycles');
    expect(initialStatus.delayed).toBe(1);
    expect(jobRan).toBe(false);

    // Fast forward timer
    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();

    expect(jobRan).toBe(true);
    const finalStatus = await service.getQueueStatus('cycles');
    expect(finalStatus.completed).toBe(1);

    vi.useRealTimers();
  });
});
