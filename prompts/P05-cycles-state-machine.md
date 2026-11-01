# P05: Monthly cycles and the state machine

READ: AGENTS.md, docs/API.md (Cycles, State matrix, Transition table), docs/DECISIONS.md (19, 21), docs/TESTING.md (items 4 and 10).

## Goal

A group owner/admin can start a cycle for a month; the cycle moves through phases only when rules allow, and every later module can ask one place whether an operation is allowed.

## Tasks

1. `cycles` module: `POST /groups/:id/cycles`, `GET /cycles/current?groupId=`, `GET /cycles/:id`, `POST /cycles/:id/advance`.
2. Validation: month 1 to 12, year within current year -1 to +1, `submissionDeadline < reviewDeadline`, both in the future relative to the injected Clock. 409 `CYCLE_EXISTS` for a duplicate (group, year, month).
3. `CycleStateService`:
   - `assertAllows(cycle, operation)` driven by a constant table that mirrors the state matrix in docs/API.md (operations: `submission.write`, `others.read`, `review.create`, `comment.add`, `review.complete`, `advance`). Throws `CYCLE_STATE_INVALID` with the phase name in `details`.
   - `canAdvance(cycleId)` returns `{ ok, reason }` using the transition table. M1 implements `submission_open -> group_review` and `group_review -> planning`. Others return not ok with "Not available yet".
4. `advance`: owner/admin only; evaluates `canAdvance`; `{ force: true }` allowed for owner only. Do not add tables for this; write the forced advance to the application log with user id and cycle id only.
5. `GET /cycles/:id`: members only; include `phase`, deadlines, and `members: [{ userId, displayName, submissionStatus }]` where `submissionStatus` is `none | draft | submitted | locked`. Never include goal content. (Submissions module does not exist yet, so read the `monthly_submissions` table through a small read-only repository exposed by a `SubmissionsStatusPort` interface; implement it in P06 and use a stub returning `none` until then.)
6. `GET /cycles/current`: pick the cycle matching the current month in the caller's profile timezone, else the most recent for that group, else 404.
7. Tests: TESTING.md items 4 and 10 (table-driven over every operation x status), advance conditions (deadline passed with fake Clock; all submitted; forced).

## Constraints

- All time comparisons use the injected Clock.
- Cycle state rules must exist only in `CycleStateService`; other modules call it.

## Verify

```
pnpm --filter api test && pnpm --filter api test:e2e -- cycles
```

## Finish

Tick P05, commit `feat(cycles): create and advance with state matrix`.
