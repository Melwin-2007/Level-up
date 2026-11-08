# P40: Infrastructure (Redis + BullMQ)

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md, docs/TESTING.md.

## Goal

Add Redis and BullMQ in a `jobs` module in `apps/api`. Queues for: cycle auto-advance on deadlines, reminder dispatch, report generation (later). Bull Board in non-production. Tests use in-memory / mock strategy.

## Tasks

1. In `apps/api`:
   - Install `bullmq` and `ioredis` (plus `ioredis-mock` for unit/e2e tests).
   - Create `src/jobs/jobs.module.ts`, `src/jobs/jobs.service.ts` or queue providers.
   - Define queues: `cycles` (for transition jobs), `reminders` (for notification jobs).
   - Provide Redis connection factory with env `REDIS_URL` or fallback to mock when in test or when Redis is not configured.
2. Bull Board:
   - Mount Bull Board on non-production environments (e.g. `/admin/queues`) behind auth guard.
3. Tests:
   - Queue job addition and worker execution test using mock Redis.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P40, commit `feat(jobs): redis and bullmq queue infrastructure`.
