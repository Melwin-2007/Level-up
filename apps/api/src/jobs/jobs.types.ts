export type QueueName = 'cycles' | 'reminders';

export interface JobOptions {
  delay?: number;
  jobId?: string;
  repeat?: {
    every?: number;
    cron?: string;
  };
  attempts?: number;
}

export interface AppJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  opts?: JobOptions;
  timestamp?: number;
}

export type JobProcessor<T = unknown, R = unknown> = (job: AppJob<T>) => Promise<R>;

export interface QueueStatus {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
