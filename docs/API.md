# API contract (Milestone 1)

Base path `/api/v1`. JSON only. Auth: `Authorization: Bearer <supabase access token>`.

## Standard error body

```json
{ "error": { "code": "SUBMISSION_LOCKED", "message": "This submission is locked and cannot be edited.", "details": {} } }
```

`message` is written for the end user (see COPY.md). `code` is stable and machine-readable. Never leak stack traces, SQL, or whether a resource exists in a group the caller cannot see (return 404, not 403, for non-members).

| HTTP | Typical codes |
| --- | --- |
| 400 | `VALIDATION_FAILED` (details = field errors) |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| 403 | `FORBIDDEN_ROLE`, `PROFILE_REQUIRED` |
| 404 | `NOT_FOUND` |
| 409 | `SUBMISSION_LOCKED`, `CYCLE_STATE_INVALID`, `ALREADY_MEMBER`, `CYCLE_EXISTS`, `REVIEW_EXISTS`, `GROUP_FULL` |
| 429 | `RATE_LIMITED` |

## Endpoints

SPEC endpoints plus the extra ones Milestone 1 needs (marked +).

### Me
| Method | Path | Notes |
| --- | --- | --- |
| PUT | `/me` | Create or update own profile (`displayName`, `timezone` IANA-validated). Only route usable before a profile exists. |
| GET | `/me` | Own profile |

### Groups
| Method | Path | Rules |
| --- | --- | --- |
| POST | `/groups` | Caller becomes `owner`. Generates invite code. |
| GET | `/groups` + | Groups I belong to |
| POST | `/groups/join` | Body `{ inviteCode }`. Rate limited. 409 if already member or full. |
| GET | `/groups/:id` | Members only. Includes member list (id, displayName, role). Invite code visible to owner/admin only. |

### Cycles
| Method | Path | Rules |
| --- | --- | --- |
| POST | `/groups/:id/cycles` | owner/admin. Body: year, month, submissionDeadline, reviewDeadline. 409 if that month exists. |
| GET | `/cycles/current` | Query `groupId`. Cycle for the current month in the caller's timezone, else the latest. 404 if none. |
| GET | `/cycles/:id` | Members. Includes per-member status list (submitted? locked? name only, no content). |
| POST | `/cycles/:id/advance` + | owner/admin. Moves to the next status if conditions in the transition table hold. Optional `{ force: true }` allowed for owner. |

### Submissions
| Method | Path | Rules |
| --- | --- | --- |
| POST | `/cycles/:id/submission` | Create the caller's submission. Body: goals[], availability, constraints, `submit: boolean`. Only while cycle = `submission_open`. |
| GET | `/cycles/:id/submission` + | Caller's own submission, always. |
| PATCH | `/cycles/:id/submission` | Replace goals/availability/constraints. Only if status in (`draft`,`submitted`) AND cycle = `submission_open`. Else `SUBMISSION_LOCKED` or `CYCLE_STATE_INVALID`. |
| POST | `/cycles/:id/lock-submission` | Locks the caller's own submitted submission. Irreversible in M1. |
| GET | `/cycles/:id/submissions` + | Others' goals during review: cycle in (`group_review`, `planning`, `execution`, `completed`). Returns only `submitted`/`locked` submissions, only goal fields (no availability or constraints). Caller's own included. |

### Reviews
| Method | Path | Rules |
| --- | --- | --- |
| POST | `/cycles/:id/reviews` | owner/admin. Cycle must be `group_review`. 409 if one exists. Sets `started_at`. |
| GET | `/cycles/:id/review` + | Review + comment counts |
| POST | `/reviews/:id/comments` | Any member. Body `{ submissionGoalId, comment }`. Goal must belong to the same cycle and a `submitted`/`locked` submission. `author_id` from JWT. |
| GET | `/reviews/:id/comments` + | Query `submissionGoalId` optional. Members only. |
| POST | `/reviews/:id/complete` + | owner/admin. Sets `completed_at`, locks all `submitted` submissions in the cycle (setting `locked_at`), leaves drafts as `draft`. |

Out of Milestone 1: generate-plan, approve-plan, reoptimize, report, group-report.

## State matrix (cycle status vs operation)

| Operation | submission_open | group_review | planning | execution | completed | cancelled |
| --- | --- | --- | --- | --- | --- | --- |
| Create/patch/lock submission | yes | no | no | no | no | no |
| Read others' goals | no | yes | yes | yes | yes | no |
| Create review | no | yes | no | no | no | no |
| Add comment | no | yes | no | no | no | no |
| Complete review | no | yes | no | no | no | no |
| Advance | yes | yes | yes | yes | no | no |

## Transition table

| From | To | Allowed when |
| --- | --- | --- |
| submission_open | group_review | deadline passed OR every member has `submitted`/`locked` OR owner forces |
| group_review | planning | review completed OR review deadline passed OR owner forces |
| planning | execution | (M3+) every participating member approved a plan OR owner proceeds |
| execution | completed | (M4+) cycle month ended and reconciliation done |

M1 implements the first two. Later transitions return `CYCLE_STATE_INVALID` with a clear message. Automatic deadline-triggered advancement arrives with BullMQ in M4; in M1 `advance` also runs lazily: `GET /cycles/:id` does not mutate state.

## Conventions

- Request/response field names camelCase; DB snake_case. Map in services, not controllers.
- Dates: `deadline` as `YYYY-MM-DD`; timestamps ISO 8601 UTC.
- IDs are UUIDs. Validate every path param as a UUID.
- Lists return `{ items: [...] }` so pagination can be added later.
