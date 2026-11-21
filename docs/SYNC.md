# Offline Sync Architecture & Design Specification

## 1. Executive Summary & Philosophy

In the `monthly-productivity` system, daily task execution happens in the real world — during commutes, in transit, at the gym, or in environments with intermittent connectivity. Therefore, **daily execution is local-first**. A member must always be able to view their scheduled daily tasks, run execution timers, complete tasks, postpone tasks, and record actual time spent without an active internet connection.

Conversely, **group coordination, AI planning, and reporting are server-authoritative and online-only**. Group reviews require multi-member consensus, cycle transitions depend on group-wide state evaluations, AI plan generation requires secure server-side LLM gateways, and reports synthesize collective metrics.

This division strictly upholds the **three-record principle** (`docs/DATABASE.md`):

1. **Submitted Goals**: Server-authoritative and immutable once locked.
2. **Approved Baseline Plans**: Server-authoritative and immutable once approved.
3. **Execution Actuals (`tasks`, `task_logs`, `xp_transactions`)**: Created locally or server-side, projected into append-only ledgers, and reconciled via deterministic idempotency keys.

---

## 2. Entity Classification & Synchronization Boundaries

| Entity                    | Primary Store                    | Local Cache                | Offline Mutations                              | Sync Mechanism                                | Conflict Policy                                                                      |
| :------------------------ | :------------------------------- | :------------------------- | :--------------------------------------------- | :-------------------------------------------- | :----------------------------------------------------------------------------------- |
| **`task_logs`**           | Postgres (`task_logs`)           | SQLite (`local_task_logs`) | Yes (`start`, `pause`, `complete`, `postpone`) | Outbox push (`POST /sync/push`)               | **Zero Conflict**: Append-only log; deduplicated by `idempotency_key`.               |
| **`tasks`**               | Postgres (`tasks`)               | SQLite (`local_tasks`)     | Optimistic status update                       | Delta pull (`GET /sync/pull`) & push response | **Last-Writer-Wins**: Server timestamps order status updates; logs remain immutable. |
| **`cycles`**              | Postgres (`cycles`)              | AsyncStorage / SQLite      | No (Read-only)                                 | Delta pull (`GET /sync/pull`)                 | **Server Authoritative**: Read-only on client.                                       |
| **`plan_versions`**       | Postgres (`plan_versions`)       | TanStack Query Cache       | No (Read-only)                                 | Online REST (`GET /cycles/:id/plan`)          | **Server Authoritative**: Approved plans are immutable.                              |
| **`monthly_submissions`** | Postgres (`monthly_submissions`) | TanStack Query Cache       | No (Draft form in client memory only)          | Online REST (`PUT /cycles/:id/submission`)    | **Server Authoritative**: Submissions require online cycle state checks.             |
| **`group_reviews`**       | Postgres (`group_reviews`)       | TanStack Query Cache       | No (Read-only)                                 | Online REST (`POST /reviews/:id/comments`)    | **Server Authoritative**: Multi-user interactive reviews are online-only.            |
| **`monthly_reports`**     | Postgres (`monthly_reports`)     | TanStack Query Cache       | No (Read-only)                                 | Online REST (`GET /cycles/:id/reports/*`)     | **Server Authoritative**: Generated deterministically by backend.                    |
| **`xp_transactions`**     | Postgres (`xp_transactions`)     | Computed summary           | No (Awarded by server)                         | Delta pull (`GET /sync/pull`)                 | **Server Authoritative**: Backend awards XP upon reconciling completed task logs.    |

---

## 3. Conflict Resolution Policies

### 3.1 Task Logs: Zero-Conflict Append-Only Ledger

`task_logs` rows are immutable historical records of events (`start`, `pause`, `complete`, `postpone`). Because they are append-only:

- Multiple actions logged offline simply append in chronological sequence according to their `clientTimestamp`.
- If an action was partially delivered or re-sent, the server enforces deduplication using the unique `idempotency_key` stored in `task_logs.metadata->'idempotencyKey'`.
- Duplicate submissions return the previously accepted log entry with HTTP 200/201 and never create duplicate ledger rows or duplicate XP awards.

### 3.2 Task Status & Projections: Last-Writer-Wins

A task's current status (`pending`, `in_progress`, `completed`, `postponed`, `cancelled`) is a derived projection of its log history.

- When an outbox batch is synced, the server executes the log entries within a database transaction.
- The task's `status`, `actual_minutes`, and `completed_at` are updated to match the latest sequential event.
- If a task was marked completed offline, but was postponed on another device, the completion action takes precedence if its completion timestamp is recorded, preserving earned progress.

### 3.3 Postpone Cycle Boundary Clamping

- When postponing a task offline, the user selects a target `scheduled_date`.
- Upon sync, the server validates the target date against the cycle's `end_date`. If the date exceeds the cycle boundary, the server clamps the date to the cycle's final execution day and logs a warning in the sync result.

### 3.4 Strict Rejection of Offline Structural Mutations

- Cycle advancements, goal edits after lock, baseline approvals, and plan reoptimizations **cannot** be performed offline.
- Any attempt to submit structural planning changes without server validation will be rejected with an immediate error (`ONLINE_REQUIRED`).

---

## 4. Idempotency Key Architecture

Every offline mutation enqueued into the outbox is assigned a deterministic, globally unique idempotency key constructed on the mobile device:

$$\text{idempotencyKey} = \text{taskId} + \text{":"} + \text{action} + \text{":"} + \text{clientUuid}$$

Example: `c56a4180-65aa-42ec-a945-5fd21dec0538:complete:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`

Guarantees:

1. **Network Retries**: If a push request drops after being processed by the server but before the client receives the response, subsequent retries match the existing key and return the original confirmation.
2. **Double-Click / Multi-Tap**: Rapid UI interactions generate only one outbox record per action intent.
3. **Ledger Integrity**: Task completion XP awards use key `${taskId}:task_completed:1`. Even if multiple completion logs arrive due to clock anomalies, the XP ledger trigger guarantees that exactly one transaction is created.

---

## 5. Local Storage & SQLite Outbox Schema

Mobile storage uses a local SQLite database (`level_up_local.db`) for structured offline queryability alongside secure session storage.

```sql
-- Cached tasks for the active cycle
CREATE TABLE IF NOT EXISTS local_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  plan_item_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- pending, in_progress, completed, postponed, cancelled
  scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
  estimated_minutes INTEGER NOT NULL,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT, -- ISO timestamp
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT -- Last server sync timestamp
);

-- Outbox queue for offline mutations
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL, -- Local UUID
  idempotency_key TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL, -- start, pause, complete, postpone
  payload_json TEXT NOT NULL, -- JSON stringified TaskActionInput
  created_at TEXT NOT NULL, -- Client timestamp ISO
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' -- pending, syncing, failed
);

-- Metadata for synchronization watermarks
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 6. Outbox Lifecycle & State Machine

```
[User Action in Offline Mode]
             │
             ▼
      (Write to Outbox)
             │
             ▼
     ┌───────────────┐
     │    PENDING    │◄───────────────────────────┐
     └───────┬───────┘                           │
             │ (Network Available / Flush Trigger)│ (Retry with Backoff)
             ▼                                   │
     ┌───────────────┐                           │
     │    SYNCING    │                           │
     └───────┬───────┘                           │
             ├─── Push Succeeded ──► [DELETE ROW / SYNCED]
             │
             └─── Push Failed (Network error) ───┘
             │
             └─── Permanent Error (400 / 403 / 404)
                     │
                     ▼
             ┌───────────────┐
             │    FAILED     │ (Flagged for diagnostics / user alert)
             └───────────────┘
```

### 6.1 Retry Strategy & Exponential Backoff

- When flushing the outbox fails due to network disconnection or 5xx server errors:
  - Attempt 1: 1s + jitter
  - Attempt 2: 2s + jitter
  - Attempt 3: 4s + jitter
  - Attempt 4: 8s + jitter
  - Attempt 5: 16s + jitter (Max delay 30s)
- Max automatic retry attempts: 5. After 5 failures, the status remains `pending` and waits for an explicit network reconnection event (`NetInfo.addEventListener`).

### 6.2 Trigger Events

Sync flushing is automatically triggered by:

1. **Connectivity Regained**: Mobile OS fires network state transition from offline to online.
2. **App Foregrounding**: `AppState` transition from `background` to `active`.
3. **Manual Pull-to-Refresh**: User pulls down on the Today execution tab.
4. **Immediate Online Dispatch**: If online when the user acts, the mutation is enqueued and flushed immediately.

---

## 7. Synchronization Wire Protocol

### 7.1 Push Endpoint: `POST /api/v1/sync/push`

Batches up to 50 pending outbox actions into a single atomic HTTP request.

**Request Body**:

```json
{
  "clientTimestamp": "2026-11-21T18:00:00.000Z",
  "actions": [
    {
      "idempotencyKey": "task-uuid-1:complete:uuid-a",
      "taskId": "task-uuid-1",
      "action": "complete",
      "payload": {
        "actualMinutes": 45,
        "feedback": "Completed all test cases"
      },
      "clientCreatedAt": "2026-11-21T17:45:00.000Z"
    },
    {
      "idempotencyKey": "task-uuid-2:postpone:uuid-b",
      "taskId": "task-uuid-2",
      "action": "postpone",
      "payload": {
        "postponeDate": "2026-11-22"
      },
      "clientCreatedAt": "2026-11-21T17:50:00.000Z"
    }
  ]
}
```

**Response Body**:

```json
{
  "syncedAt": "2026-11-21T18:00:02.100Z",
  "processed": 2,
  "results": [
    {
      "idempotencyKey": "task-uuid-1:complete:uuid-a",
      "status": "success",
      "taskId": "task-uuid-1",
      "xpAwarded": 34
    },
    {
      "idempotencyKey": "task-uuid-2:postpone:uuid-b",
      "status": "success",
      "taskId": "task-uuid-2",
      "xpAwarded": 0
    }
  ],
  "updatedTasks": [
    {
      "id": "task-uuid-1",
      "status": "completed",
      "actualMinutes": 45,
      "completedAt": "2026-11-21T17:45:00.000Z",
      "updatedAt": "2026-11-21T18:00:02.050Z"
    },
    {
      "id": "task-uuid-2",
      "status": "postponed",
      "scheduledDate": "2026-11-22",
      "updatedAt": "2026-11-21T18:00:02.080Z"
    }
  ]
}
```

### 7.2 Pull Endpoint: `GET /api/v1/sync/pull?since=<ISO_TIMESTAMP>`

Retrieves all entities that have changed since the client's last synchronization watermark.

**Query Parameters**:

- `since`: ISO timestamp (e.g., `2026-11-21T12:00:00.000Z`). If omitted, returns all active entities for current cycle.

**Response Body**:

```json
{
  "syncedAt": "2026-11-21T18:05:00.000Z",
  "activeCycle": {
    "id": "cycle-uuid-1",
    "status": "execution",
    "startDate": "2026-11-01",
    "endDate": "2026-11-30"
  },
  "tasks": [
    {
      "id": "task-uuid-3",
      "title": "Review PR",
      "status": "pending",
      "scheduledDate": "2026-11-21",
      "estimatedMinutes": 30,
      "actualMinutes": 0,
      "completedAt": null,
      "updatedAt": "2026-11-21T17:30:00.000Z"
    }
  ],
  "xp": {
    "totalXp": 450,
    "currentLevel": 4
  }
}
```

---

## 8. Edge Cases & Resilience Guarantees

1. **Cycle Closes While Member Is Offline**:
   - If a member completes tasks offline on November 30, but only reconnects on December 1 (after the cycle auto-transitions to `completed`), the server accepts the completion logs because the `clientCreatedAt` falls within the active cycle window. XP is credited to the member's permanent ledger.
2. **Token Expiration in Offline Mode**:
   - If the Supabase JWT expires while disconnected, outbox mutations remain safely preserved in the SQLite outbox.
   - Upon reconnecting, the mobile authentication client attempts an automatic token refresh. Once a valid JWT is acquired, the outbox flushes cleanly.
3. **Replay Invariance**:
   - Replaying an outbox batch (e.g., due to an interrupted connection during HTTP response delivery) is 100% idempotent. The server locates existing `task_logs` matching each `idempotencyKey` and returns identical response data without altering database state.
