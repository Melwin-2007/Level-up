# P81: SQLite Outbox and Sync Protocol Implementation

## Goal

Implement local-first task execution synchronization using an offline SQLite outbox on mobile and delta synchronization endpoints on the API. Tasks and execution logs can be recorded with zero network connectivity; upon reconnecting, pending outbox mutations are flushed via `POST /sync/push` and updated server state is pulled via `GET /sync/pull?since=`.

## READ

- `docs/SYNC.md` (Offline architecture, outbox schema, conflict resolution rules)
- `docs/DATABASE.md` (Append-only actuals, idempotency keys)
- `docs/DECISIONS.md` (Decision 57)

## Scope

1. `packages/shared/`:
   - Add Zod schemas and TypeScript types for sync wire protocol:
     - `SyncPushRequestSchema`, `SyncPushResponseSchema`
     - `SyncPullResponseSchema`
     - `SyncActionItemSchema`

2. `apps/api/src/sync/`:
   - `sync.service.ts`:
     - Process batch push actions (`start`, `pause`, `complete`, `postpone`) idempotently via `TasksService` transaction logic.
     - Build delta pull response query returning updated tasks and cycle states where `updated_at > since`.
   - `sync.controller.ts`:
     - `POST /sync/push`
     - `GET /sync/pull`
   - `sync.module.ts`: Wire into API.
   - Tests: Replaying identical batch returns cached results without duplicate XP or log rows. Delta query returns newly updated items.

3. `apps/mobile/`:
   - Install or implement local SQLite store abstraction for tasks and outbox queue (`local_tasks`, `sync_outbox`).
   - `services/sync/`:
     - `sync-queue.ts`: Enqueue offline actions, flush pending outbox to `POST /sync/push`, apply delta updates from `GET /sync/pull`.
   - Hook integration: `useTasks` reads from local store with optimistic status updates while online/offline.

4. Tests:
   - API unit/integration tests for `POST /sync/push` and `GET /sync/pull`.
   - Idempotency test: Replaying outbox twice changes nothing.
   - Mobile offline sync unit tests.
