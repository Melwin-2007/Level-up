# P06: Goal submissions, drafts and locking

READ: AGENTS.md, docs/SPEC.md (4.1, Section 3 B), docs/API.md (Submissions), docs/DATABASE.md (triggers), docs/DECISIONS.md (12, 13, 16), docs/SECURITY.md, docs/TESTING.md (items 5 to 7).

## Goal

Each member submits their own goals independently, edits them until locking, and can never edit them after.

## Tasks

1. Shared zod schemas in `@mp/shared`: `GoalInput` (title 1 to 120, description up to 2000, category up to 40, priority 1 to 5, estimatedHours 0.25 to 400 with 2 decimals, deadline `YYYY-MM-DD` inside the cycle month, successCriteria JSON object with a documented shape: `{ type: "checklist" | "metric" | "binary", items?, target?, unit? }`, dependencies as array of goal indexes), `SubmissionInput` (goals 1 to 25, availability, constraints, submit boolean). Availability shape: weekly hours per weekday plus dated exceptions. Constraints: fixed commitments list, max daily hours.
2. `submissions` module:
   - `POST /cycles/:id/submission`: one per member per cycle (409 if exists). `submit: true` sets `submitted` and `submitted_at`; else `draft`.
   - `GET /cycles/:id/submission`: caller's own.
   - `PATCH /cycles/:id/submission`: allowed only when status is `draft` or `submitted` AND cycle is `submission_open`. Replaces the goal list in a transaction (delete and insert is acceptable before lock). If locked: 409 `SUBMISSION_LOCKED`. Wrong cycle phase: `CYCLE_STATE_INVALID`.
   - `POST /cycles/:id/lock-submission`: only `submitted` can lock; sets `locked`, `locked_at`.
   - `GET /cycles/:id/submissions`: others' goals per DECISIONS 13; explicit mapper that omits availability and constraints and omits drafts.
3. Implement the `SubmissionsStatusPort` for the cycles module (replace the stub from P05).
4. Mapper tests that fail if a forbidden field (`availability`, `constraints`) ever appears in the others' view.
5. Tests: TESTING.md items 5, 6, 7. Include the SQL-level test that a direct UPDATE of a locked goal is rejected by the trigger even if the service were bypassed.

## Constraints

- Ownership is derived from JWT: the submission is found by `(cycleId, userId)`. No submission id in the URL.
- Do not add revision/unlock behaviour.

## Verify

```
pnpm --filter api test:e2e -- submissions
```

## Finish

Tick P06, commit `feat(submissions): drafts, submit, lock`.
