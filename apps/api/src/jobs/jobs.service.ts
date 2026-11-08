import { Injectable, Inject, Optional, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { REDIS_CONNECTION } from './redis.provider';
import type { QueueName, JobOptions, AppJob, JobProcessor, QueueStatus } from './jobs.types';

interface InMemoryJobRecord<T = unknown> {
  job: AppJob<T>;
  status: 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';
  timer?: ReturnType<typeof setTimeout>;
}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly bullQueues = new Map<QueueName, Queue>();
  private readonly bullWorkers = new Map<QueueName, Worker>();

  // In-memory fallback structures
  private readonly inMemoryJobs = new Map<QueueName, InMemoryJobRecord[]>();
  private readonly inMemoryProcessors = new Map<QueueName, JobProcessor>();
  private readonly inMemoryTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(@Optional() @Inject(REDIS_CONNECTION) private readonly redisClient: Redis | null) {
    const queueNames: QueueName[] = ['cycles', 'reminders'];
    for (const name of queueNames) {
      if (this.redisClient) {
        this.bullQueues.set(name, new Queue(name, { connection: this.redisClient }));
      } else {
        this.inMemoryJobs.set(name, []);
      }
    }
  }

  async addJob<T = unknown>(
    queueName: QueueName,
    jobName: string,
    data: T,
    opts: JobOptions = {}
  ): Promise<AppJob<T>> {
    const jobId =
      opts.jobId || `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (this.redisClient) {
      const queue = this.bullQueues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }
      const bullJob = await queue.add(jobName, data, {
        jobId,
        delay: opts.delay,
        attempts: opts.attempts ?? 3,
        repeat: opts.repeat,
      });

      return {
        id: bullJob.id || jobId,
        name: jobName,
        data,
        opts,
        timestamp: Date.now(),
      };
    }

    // In-memory fallback
    const appJob: AppJob<T> = {
      id: jobId,
      name: jobName,
      data,
      opts,
      timestamp: Date.now(),
    };

    const record: InMemoryJobRecord<T> = {
      job: appJob,
      status: opts.delay && opts.delay > 0 ? 'delayed' : 'waiting',
    };

    const queueList = this.inMemoryJobs.get(queueName) || [];
    queueList.push(record as InMemoryJobRecord<unknown>);
    this.inMemoryJobs.set(queueName, queueList);

    const processor = this.inMemoryProcessors.get(queueName);
    if (processor) {
      if (opts.delay && opts.delay > 0) {
        const timer = setTimeout(() => {
          void this.executeInMemoryJob(queueName, record as InMemoryJobRecord<unknown>, processor);
        }, opts.delay);
        record.timer = timer;
        this.inMemoryTimers.push(timer);
      } else {
        // Execute asynchronously
        queueMicrotask(() => {
          void this.executeInMemoryJob(queueName, record as InMemoryJobRecord<unknown>, processor);
        });
      }
    }

    return appJob;
  }

  registerWorker<T = unknown, R = unknown>(
    queueName: QueueName,
    processor: JobProcessor<T, R>
  ): void {
    if (this.redisClient) {
      const worker = new Worker(
        queueName,
        async (bullJob) => {
          const appJob: AppJob<T> = {
            id: bullJob.id || `${queueName}-${Date.now()}`,
            name: bullJob.name,
            data: bullJob.data as T,
            opts: bullJob.opts,
            timestamp: bullJob.timestamp,
          };
          return processor(appJob);
        },
        { connection: this.redisClient }
      );

      worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} in queue ${queueName} failed: ${err.message}`, err.stack);
      });

      this.bullWorkers.set(queueName, worker);
      return;
    }

    // In-memory registration
    this.inMemoryProcessors.set(queueName, processor as JobProcessor);

    // Trigger any waiting jobs
    const queueList = this.inMemoryJobs.get(queueName) || [];
    for (const record of queueList) {
      if (record.status === 'waiting') {
        queueMicrotask(() => {
          void this.executeInMemoryJob(queueName, record, processor as JobProcessor);
        });
      }
    }
  }

  private async executeInMemoryJob(
    queueName: QueueName,
    record: InMemoryJobRecord<unknown>,
    processor: JobProcessor
  ): Promise<void> {
    record.status = 'active';
    try {
      await processor(record.job);
      record.status = 'completed';
    } catch (err: unknown) {
      record.status = 'failed';
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`In-memory job ${record.job.id} failed: ${msg}`);
    }
  }

  async getQueueStatus(queueName: QueueName): Promise<QueueStatus> {
    if (this.redisClient) {
      const queue = this.bullQueues.get(queueName);
      if (!queue) {
        return { name: queueName, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
      }
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      return { name: queueName, waiting, active, completed, failed, delayed };
    }

    const records = this.inMemoryJobs.get(queueName) || [];
    const waiting = records.filter((r) => r.status === 'waiting').length;
    const active = records.filter((r) => r.status === 'active').length;
    const completed = records.filter((r) => r.status === 'completed').length;
    const failed = records.filter((r) => r.status === 'failed').length;
    const delayed = records.filter((r) => r.status === 'delayed').length;

    return { name: queueName, waiting, active, completed, failed, delayed };
  }

  async getAllQueueStatuses(): Promise<QueueStatus[]> {
    const queueNames: QueueName[] = ['cycles', 'reminders'];
    return Promise.all(queueNames.map((name) => this.getQueueStatus(name)));
  }

  // Helper for test verification
  getInMemoryJobs(queueName: QueueName): AppJob[] {
    const records = this.inMemoryJobs.get(queueName) || [];
    return records.map((r) => r.job);
  }

  async clearQueue(queueName: QueueName): Promise<void> {
    if (this.redisClient) {
      const queue = this.bullQueues.get(queueName);
      if (queue) {
        await queue.drain();
        await queue.clean(0, 1000, 'completed');
        await queue.clean(0, 1000, 'failed');
      }
      return;
    }

    const records = this.inMemoryJobs.get(queueName) || [];
    for (const r of records) {
      if (r.timer) clearTimeout(r.timer);
    }
    this.inMemoryJobs.set(queueName, []);
  }

  async onModuleDestroy(): Promise<void> {
    for (const timer of this.inMemoryTimers) {
      clearTimeout(timer);
    }

    for (const [, worker] of this.bullWorkers) {
      await worker.close();
    }
    for (const [, queue] of this.bullQueues) {
      await queue.close();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}
