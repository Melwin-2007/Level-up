import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStore } from '../sync/local-store';
import { SyncManager } from '../sync/sync-manager';
import { api } from '../api';
import type { TaskResponse, SyncPushResponse, SyncPullResponse } from '@mp/shared';

jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Offline Synchronization & Outbox (P81)', () => {
  let store: LocalStore;
  let manager: SyncManager;

  const mockTask: TaskResponse = {
    id: 'task-1111',
    cycleId: 'cycle-1',
    userId: 'user-1',
    goalId: 'goal-1',
    planItemId: 'item-1',
    title: 'Offline task unit test',
    description: null,
    status: 'pending',
    scheduledDate: '2026-11-21',
    estimatedMinutes: 45,
    actualMinutes: 0,
    completedAt: null,
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    store = new LocalStore();
    manager = new SyncManager(store);
    await store.upsertTasks([mockTask]);
  });

  describe('LocalStore', () => {
    it('should store, retrieve, and update local tasks', async () => {
      const initial = await store.getTask('task-1111');
      expect(initial?.status).toBe('pending');
      expect(initial?.actualMinutes).toBe(0);

      const updated = await store.updateTaskStatus(
        'task-1111',
        'completed',
        45,
        '2026-11-21T12:00:00.000Z'
      );

      expect(updated?.status).toBe('completed');
      expect(updated?.actualMinutes).toBe(45);
      expect(updated?.completedAt).toBe('2026-11-21T12:00:00.000Z');

      const persisted = await store.getTask('task-1111');
      expect(persisted?.status).toBe('completed');
    });

    it('should queue outbox actions with idempotency keys and prevent duplicates', async () => {
      const item1 = await store.enqueueOutbox({
        idempotencyKey: 'task-1111:complete:key-1',
        taskId: 'task-1111',
        action: 'complete',
        payload: { durationMinutes: 45, note: null, postponedToDate: null },
        createdAt: '2026-11-21T12:00:00.000Z',
      });

      expect(item1.id).toBeDefined();
      expect(item1.status).toBe('pending');

      // Duplicate enqueue with same key
      const item2 = await store.enqueueOutbox({
        idempotencyKey: 'task-1111:complete:key-1',
        taskId: 'task-1111',
        action: 'complete',
        payload: { durationMinutes: 45, note: null, postponedToDate: null },
        createdAt: '2026-11-21T12:00:00.000Z',
      });

      expect(item2.id).toBe(item1.id);
      const outbox = await store.getOutbox();
      expect(outbox).toHaveLength(1);
    });
  });

  describe('SyncManager', () => {
    it('should perform optimistic local update when enqueuing action', async () => {
      const enqueued = await manager.enqueueAction('task-1111', 'complete', {
        durationMinutes: 45,
        note: 'Finished offline',
      });

      expect(enqueued.taskId).toBe('task-1111');
      expect(enqueued.action).toBe('complete');

      const localTask = await store.getTask('task-1111');
      expect(localTask?.status).toBe('completed');
      expect(localTask?.actualMinutes).toBe(45);
      expect(localTask?.completedAt).toBeDefined();

      const outbox = await store.getOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.status).toBe('pending');
    });

    it('should flush pending outbox to server and remove successful items', async () => {
      await manager.enqueueAction('task-1111', 'complete', {
        durationMinutes: 45,
      });

      const outboxBefore = await store.getOutbox();
      const idempotencyKey = outboxBefore[0]!.idempotencyKey;

      const mockPushResponse: SyncPushResponse = {
        syncedAt: '2026-11-21T12:05:00.000Z',
        processed: 1,
        results: [
          {
            idempotencyKey,
            taskId: 'task-1111',
            status: 'success',
            xpAwarded: 34,
          },
        ],
        updatedTasks: [
          {
            ...mockTask,
            status: 'completed',
            actualMinutes: 45,
            completedAt: '2026-11-21T12:00:00.000Z',
            updatedAt: '2026-11-21T12:05:00.000Z',
          },
        ],
      };

      (api.post as jest.Mock).mockResolvedValueOnce(mockPushResponse);

      const result = await manager.flushOutbox();

      expect(result.processed).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);

      expect(api.post).toHaveBeenCalledWith('/sync/push', {
        clientTimestamp: expect.any(String),
        actions: [
          {
            idempotencyKey,
            taskId: 'task-1111',
            action: 'complete',
            payload: { durationMinutes: 45, note: null, postponedToDate: null },
            clientCreatedAt: expect.any(String),
          },
        ],
      });

      const outboxAfter = await store.getOutbox();
      expect(outboxAfter).toHaveLength(0);

      const taskAfter = await store.getTask('task-1111');
      expect(taskAfter?.status).toBe('completed');
      expect(taskAfter?.updatedAt).toBe('2026-11-21T12:05:00.000Z');
    });

    it('should mark outbox items failed when server returns action errors', async () => {
      await manager.enqueueAction('task-1111', 'postpone', {
        postponedToDate: '2026-11-22',
      });

      const outboxBefore = await store.getOutbox();
      const idempotencyKey = outboxBefore[0]!.idempotencyKey;

      const mockPushResponse: SyncPushResponse = {
        syncedAt: '2026-11-21T12:05:00.000Z',
        processed: 1,
        results: [
          {
            idempotencyKey,
            taskId: 'task-1111',
            status: 'error',
            xpAwarded: 0,
            error: 'Cycle boundary exceeded',
          },
        ],
        updatedTasks: [],
      };

      (api.post as jest.Mock).mockResolvedValueOnce(mockPushResponse);

      const result = await manager.flushOutbox();

      expect(result.processed).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);

      const outboxAfter = await store.getOutbox();
      expect(outboxAfter).toHaveLength(1);
      expect(outboxAfter[0]?.status).toBe('failed');
      expect(outboxAfter[0]?.lastError).toBe('Cycle boundary exceeded');
    });

    it('should pull delta from server and store updated tasks and watermark', async () => {
      await store.setLastSyncedAt('2026-11-21T10:00:00.000Z');

      const mockPullResponse: SyncPullResponse = {
        syncedAt: '2026-11-21T12:10:00.000Z',
        activeCycle: {
          id: 'cycle-1',
          status: 'execution',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
        },
        tasks: [
          {
            ...mockTask,
            id: 'task-2222',
            title: 'Pulled task from server',
            status: 'pending',
          },
        ],
        xp: {
          totalXp: 400,
          currentLevel: 3,
        },
      };

      (api.get as jest.Mock).mockResolvedValueOnce(mockPullResponse);

      const pullResult = await manager.pullDelta();

      expect(pullResult.tasks).toHaveLength(1);
      expect(api.get).toHaveBeenCalledWith('/sync/pull?since=2026-11-21T10%3A00%3A00.000Z');

      const allTasks = await store.getTasks();
      expect(allTasks).toHaveLength(2);
      expect(allTasks.find((t) => t.id === 'task-2222')).toBeDefined();

      const lastSynced = await store.getLastSyncedAt();
      expect(lastSynced).toBe('2026-11-21T12:10:00.000Z');
    });
  });
});
