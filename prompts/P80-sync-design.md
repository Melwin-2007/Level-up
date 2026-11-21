# P80: Offline Sync Architecture and Design Note

## Goal

Document the offline synchronization architecture in `docs/SYNC.md` before implementation. Define the exact boundaries of offline capability (execution vs planning), conflict resolution rules per entity, idempotency key construction, local SQLite schema, outbox queue state machine, retry policies, and sync wire protocol (`POST /sync/push`, `GET /sync/pull?since=`).

## READ

- `docs/DATABASE.md` (Three-record principle, append-only immutable task logs)
- `docs/API.md` (State machine and cycle authorization matrix)
- `docs/DECISIONS.md` (Decisions 42, 43, 46)
- `docs/SPEC.md` (Sections 4 and 6)

## Scope

1. Create `docs/SYNC.md` detailing:
   - System boundary: why execution is local-first while planning, review, and reporting are strictly server-authoritative.
   - Entity classification table (Local Cache vs Outbox Queued vs Online-Only).
   - Conflict resolution policies per entity (zero-conflict append-only logs, last-writer-wins task states, rejection of offline structural mutations).
   - Idempotency and deduplication architecture (`${taskId}:${action}:${clientTimestamp}`).
   - Local SQLite schema design (`local_tasks`, `local_task_logs`, `sync_outbox`, `sync_meta`).
   - Outbox lifecycle state machine (`pending`, `syncing`, `synced`, `failed`) and backoff retry strategy.
   - Synchronization wire protocol specifications:
     - `POST /sync/push`: Batch push of queued actions with atomic transaction semantics and per-item results.
     - `GET /sync/pull?since=<ISO_TIMESTAMP>`: Delta query returning changed tasks, cycle states, and profile XP.
   - Network connectivity awareness in Expo/React Native and background sync triggers.

2. Update `docs/DECISIONS.md`: Record Decision 57 summarizing offline sync architecture and conflict policies.
3. Update `docs/PROGRESS.md`: Record P80 completion and next prompt P81.
