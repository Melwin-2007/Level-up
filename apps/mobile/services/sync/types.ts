import type { TaskResponse, SyncActionType, SyncActionPayload } from '@mp/shared';

export interface LocalTask extends TaskResponse {
  isLocalOnly?: boolean;
}

export type OutboxStatus = 'pending' | 'syncing' | 'failed';

export interface SyncOutboxItem {
  id: string;
  idempotencyKey: string;
  taskId: string;
  action: SyncActionType;
  payload: SyncActionPayload;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: OutboxStatus;
}

export interface SyncStats {
  pendingCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
}
