# P44: Automatic Cycle Transitions

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md (Transition table).

## Goal

BullMQ automated repeatable worker checking cycle deadlines and automatically advancing cycles according to the transition table.

## Tasks

1. In `apps/api/src/jobs/cycle-transitions.worker.ts`:
   - Scheduled job runs periodically (e.g. every hour or triggered upon deadline).
   - Scans active cycles in `submission_open` and `group_review`.
   - If `clock.now() >= cycle.submissionDeadline`: advances to `group_review`.
   - If `clock.now() >= cycle.reviewDeadline`: finishes review (locks submitted, leaves drafts) and advances to `planning`.
   - If in `planning` and all participating members have approved baseline plans: advances to `execution`.
   - If in `execution` and cycle month has ended: advances to `completed`.
   - Uses `CycleStateService` logic; does not block on missing members.
2. Tests:
   - Automated advancement past submission deadline moves cycle to `group_review`.
   - Automated advancement past review deadline locks submissions and moves to `planning`.
   - Cycle transition worker tests using fake Clock and in-memory queue.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P44, commit `feat(jobs): automatic cycle deadline transitions worker`.
