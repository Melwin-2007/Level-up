import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalTask, SyncOutboxItem } from './types';

const STORAGE_KEYS = {
  TASKS: '@level_up/local_tasks',
  OUTBOX: '@level_up/sync_outbox',
  LAST_SYNCED_AT: '@level_up/last_synced_at',
};

export class LocalStore {
  async getTasks(): Promise<LocalTask[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      if (!raw) return [];
      return JSON.parse(raw) as LocalTask[];
    } catch {
      return [];
    }
  }

  async getTask(id: string): Promise<LocalTask | null> {
    const tasks = await this.getTasks();
    return tasks.find((t) => t.id === id) ?? null;
  }

  async upsertTasks(tasksToUpsert: LocalTask[]): Promise<void> {
    const existing = await this.getTasks();
    const taskMap = new Map<string, LocalTask>();

    for (const t of existing) {
      taskMap.set(t.id, t);
    }

    for (const t of tasksToUpsert) {
      taskMap.set(t.id, {
        ...(taskMap.get(t.id) ?? {}),
        ...t,
      });
    }

    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(Array.from(taskMap.values())));
  }

  async updateTaskStatus(
    taskId: string,
    status: string,
    actualMinutesToAdd = 0,
    completedAt?: string | null,
    scheduledDate?: string | null
  ): Promise<LocalTask | null> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    const task = tasks[index]!;
    const updated: LocalTask = {
      ...task,
      status,
      actualMinutes: task.actualMinutes + actualMinutesToAdd,
      completedAt: completedAt !== undefined ? completedAt : task.completedAt,
      scheduledDate: scheduledDate !== undefined ? scheduledDate : task.scheduledDate,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updated;
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return updated;
  }

  async getOutbox(): Promise<SyncOutboxItem[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.OUTBOX);
      if (!raw) return [];
      return JSON.parse(raw) as SyncOutboxItem[];
    } catch {
      return [];
    }
  }

  async enqueueOutbox(
    item: Omit<SyncOutboxItem, 'id' | 'attempts' | 'status'>
  ): Promise<SyncOutboxItem> {
    const outbox = await this.getOutbox();
    const existingIndex = outbox.findIndex((i) => i.idempotencyKey === item.idempotencyKey);

    if (existingIndex !== -1) {
      return outbox[existingIndex]!;
    }

    const newItem: SyncOutboxItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      attempts: 0,
      status: 'pending',
    };

    outbox.push(newItem);
    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
    return newItem;
  }

  async markOutboxSyncing(ids: string[]): Promise<void> {
    const outbox = await this.getOutbox();
    const idSet = new Set(ids);

    for (const item of outbox) {
      if (idSet.has(item.id)) {
        item.status = 'syncing';
        item.attempts += 1;
      }
    }

    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
  }

  async removeOutboxItems(idempotencyKeys: string[]): Promise<void> {
    const outbox = await this.getOutbox();
    const keySet = new Set(idempotencyKeys);
    const filtered = outbox.filter((item) => !keySet.has(item.idempotencyKey));

    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(filtered));
  }

  async markOutboxFailed(ids: string[], error: string): Promise<void> {
    const outbox = await this.getOutbox();
    const idSet = new Set(ids);

    for (const item of outbox) {
      if (idSet.has(item.id)) {
        item.status = 'failed';
        item.lastError = error;
      }
    }

    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
  }

  async getLastSyncedAt(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNCED_AT);
    } catch {
      return null;
    }
  }

  async setLastSyncedAt(timestamp: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNCED_AT, timestamp);
  }

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TASKS,
      STORAGE_KEYS.OUTBOX,
      STORAGE_KEYS.LAST_SYNCED_AT,
    ]);
  }
}

export const localStore = new LocalStore();
