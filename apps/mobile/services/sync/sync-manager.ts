import {
  type SyncActionType,
  type SyncActionPayload,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncPullResponse,
} from '@mp/shared';
import { api } from '../api';
import { localStore, LocalStore } from './local-store';
import type { SyncOutboxItem, SyncStats } from './types';

export class SyncManager {
  private isSyncing = false;

  constructor(private readonly store: LocalStore = localStore) {}

  async enqueueAction(
    taskId: string,
    action: SyncActionType,
    payload: Partial<SyncActionPayload> = {},
    autoFlush = false
  ): Promise<SyncOutboxItem> {
    const fullPayload: SyncActionPayload = {
      durationMinutes: payload.durationMinutes ?? 0,
      note: payload.note ?? null,
      postponedToDate: payload.postponedToDate ?? null,
    };

    const idempotencyKey = `${taskId}:${action}:${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    // 1. Optimistic local task update
    const nowIso = new Date().toISOString();
    let newStatus = 'pending';
    let completedAt: string | null | undefined = undefined;
    let scheduledDate: string | null | undefined = undefined;

    switch (action) {
      case 'start':
        newStatus = 'in_progress';
        break;
      case 'pause':
        newStatus = 'paused';
        break;
      case 'complete':
        newStatus = 'completed';
        completedAt = nowIso;
        break;
      case 'postpone':
        newStatus = 'postponed';
        if (fullPayload.postponedToDate) {
          scheduledDate = fullPayload.postponedToDate;
        }
        break;
    }

    await this.store.updateTaskStatus(
      taskId,
      newStatus,
      fullPayload.durationMinutes,
      completedAt,
      scheduledDate
    );

    // 2. Queue into local outbox
    const item = await this.store.enqueueOutbox({
      idempotencyKey,
      taskId,
      action,
      payload: fullPayload,
      createdAt: nowIso,
    });

    // 3. Optional immediate push attempt
    if (autoFlush) {
      void this.flushOutbox().catch(() => {
        // Offline or network error: will remain in outbox for subsequent sync
      });
    }

    return item;
  }

  async flushOutbox(): Promise<{
    processed: number;
    successCount: number;
    errorCount: number;
  }> {
    if (this.isSyncing) {
      return { processed: 0, successCount: 0, errorCount: 0 };
    }

    const outbox = await this.store.getOutbox();
    const pendingItems = outbox.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );

    if (pendingItems.length === 0) {
      return { processed: 0, successCount: 0, errorCount: 0 };
    }

    this.isSyncing = true;
    const itemIds = pendingItems.map((i) => i.id);
    await this.store.markOutboxSyncing(itemIds);

    try {
      const pushRequest: SyncPushRequest = {
        clientTimestamp: new Date().toISOString(),
        actions: pendingItems.map((item) => ({
          idempotencyKey: item.idempotencyKey,
          taskId: item.taskId,
          action: item.action,
          payload: item.payload,
          clientCreatedAt: item.createdAt,
        })),
      };

      const response = await api.post<SyncPushResponse>('/sync/push', pushRequest);

      const successfulKeys = response.results
        .filter((r) => r.status === 'success')
        .map((r) => r.idempotencyKey);

      await this.store.removeOutboxItems(successfulKeys);

      if (response.updatedTasks && response.updatedTasks.length > 0) {
        await this.store.upsertTasks(response.updatedTasks);
      }

      const errorResults = response.results.filter((r) => r.status === 'error');
      for (const errItem of errorResults) {
        const matching = pendingItems.find((p) => p.idempotencyKey === errItem.idempotencyKey);
        if (matching) {
          await this.store.markOutboxFailed([matching.id], errItem.error || 'Server error');
        }
      }

      return {
        processed: response.processed,
        successCount: successfulKeys.length,
        errorCount: errorResults.length,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      await this.store.markOutboxFailed(itemIds, errorMsg);
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  async pullDelta(): Promise<SyncPullResponse> {
    const lastSyncedAt = await this.store.getLastSyncedAt();
    const endpoint = lastSyncedAt
      ? `/sync/pull?since=${encodeURIComponent(lastSyncedAt)}`
      : '/sync/pull';

    const response = await api.get<SyncPullResponse>(endpoint);

    if (response.tasks && response.tasks.length > 0) {
      await this.store.upsertTasks(response.tasks);
    }

    if (response.syncedAt) {
      await this.store.setLastSyncedAt(response.syncedAt);
    }

    return response;
  }

  async syncAll(): Promise<{ flushed: number; pulled: number }> {
    const flushRes = await this.flushOutbox().catch(() => ({
      processed: 0,
      successCount: 0,
      errorCount: 0,
    }));
    const pullRes = await this.pullDelta().catch(() => null);

    return {
      flushed: flushRes.successCount,
      pulled: pullRes?.tasks.length ?? 0,
    };
  }

  async getSyncStats(): Promise<SyncStats> {
    const outbox = await this.store.getOutbox();
    const pendingCount = outbox.filter(
      (i) => i.status === 'pending' || i.status === 'failed'
    ).length;
    const lastSyncedAt = await this.store.getLastSyncedAt();

    return {
      pendingCount,
      lastSyncedAt,
      isSyncing: this.isSyncing,
    };
  }
}

export const syncManager = new SyncManager();
