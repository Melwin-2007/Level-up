# P42: Task API and Logs

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/API.md.

## Goal

Endpoints to manage daily task execution: query tasks, log actions (start, pause, complete, postpone), and enforce append-only `task_logs`.

## Tasks

1. In `apps/api/src/tasks/`:
   - `GET /tasks`: Query user's tasks for current cycle or filtered by date (`?date=YYYY-MM-DD` or `?cycleId=...`).
   - `GET /tasks/:id`: Task detail with logs.
   - `POST /tasks/:id/log`:
     - Actions: `start`, `pause`, `complete`, `postpone`.
     - Fields: `action`, `durationMinutes`, `note`, optional `postponedToDate`.
     - Header: `Idempotency-Key` for deduplication.
     - Derives new task `status`:
       - `start` -> `in_progress`
       - `pause` -> `paused`
       - `complete` -> `completed`, sets `completedAt = clock.now()`, accumulates `actualMinutes`
       - `postpone` -> `postponed`, updates `scheduledDate` to `postponedToDate`
     - Appends row to `task_logs` in a transaction. (Enforce DB trigger: `task_logs` is append-only).
2. Shared zod schemas and types in `@mp/shared`.
3. Tests:
   - Action logging transitions task status correctly.
   - `completedAt` set only on `complete`.
   - Direct update/deletion on `task_logs` rejected.
   - Idempotency key prevents double-execution.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P42, commit `feat(tasks): task execution api with append-only logging`.
