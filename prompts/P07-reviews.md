# P07: Group review and comments

READ: AGENTS.md, docs/SPEC.md (Section 3 C, 7.4), docs/API.md (Reviews), docs/DECISIONS.md (15, 22), docs/SECURITY.md, docs/TESTING.md (items 8 and 9).

## Goal
During group review, members read each other's submitted goals and leave attributed comments. Finishing the review locks submissions and preserves originals.

## Tasks
1. `reviews` module: `POST /cycles/:id/reviews`, `GET /cycles/:id/review`, `POST /reviews/:id/comments`, `GET /reviews/:id/comments`, `POST /reviews/:id/complete`.
2. `POST reviews`: owner/admin, cycle must be `group_review`, one per cycle (409 `REVIEW_EXISTS`). Set `started_at` from the Clock.
3. `POST comments`: caller must be a member of the cycle's group; the review must be open (`completed_at` null); `submissionGoalId` must belong to a `submitted`/`locked` submission of the same cycle; `author_id` = JWT user; comment 1 to 1000 chars; trim; throttle writes.
4. `GET comments`: members only; optional `submissionGoalId` filter; return `{ id, submissionGoalId, authorId, authorName, comment, createdAt }` ordered ascending.
5. `POST complete`: owner/admin; in one transaction set `completed_at`, set every `submitted` submission to `locked` with `locked_at`, leave `draft` untouched. Return a summary `{ lockedCount, draftCount }`.
6. After completion, comments are closed; reading remains allowed.
7. Tests: TESTING.md items 8 and 9. Item 9 compares submission goal rows before and after completion and expects them byte-identical (except the parent submission status and `locked_at`).

## Constraints
- A suggestion in a comment never changes the goal. There is no code path from comments to goals.
- Comments are immutable in M1.

## Verify
```
pnpm --filter api test:e2e -- reviews
```

## Finish
Tick P07, commit `feat(reviews): comments and finalization`.
