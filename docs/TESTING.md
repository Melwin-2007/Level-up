# Testing

Tooling: Jest + Supertest for the API; Jest + React Native Testing Library for mobile logic and components. Manual device checklist for flows.

## Test database

- A separate Supabase project (or a separate Postgres schema) named `test`. Never run tests against `dev` data.
- `pnpm --filter api test:e2e` runs migrations, creates users with the Supabase admin API (or signs test JWTs with the configured test key), runs scenarios, truncates its own data.
- Helper `createTestUser(name)` returns `{ userId, token }`. Helper `asUser(token)` wraps Supertest with the auth header. Clock is injected, never real time.

## Required API tests (Milestone 1)

Map directly to the acceptance scenario (SPEC 7.4).

1. Auth: no token 401; expired token 401; token for user without profile 403 `PROFILE_REQUIRED`.
2. Profiles: create/update own; invalid timezone rejected.
3. Groups: create (creator is owner); two users join with the code; third join after the cap fails; non-member gets 404 on the group; member cannot see the invite code, owner can.
4. Cycles: owner creates November; duplicate month 409; plain member cannot create; non-member 404.
5. Submissions: three members each submit different goals; each reads only their own via GET submission; others' goals unavailable during `submission_open`.
6. Locking: lock own submission; PATCH afterwards 409 `SUBMISSION_LOCKED`; direct SQL UPDATE on a locked `submission_goals` row is rejected by the trigger.
7. Visibility: in `group_review`, member A sees B's and C's submitted goals but not availability/constraints; never sees someone's draft.
8. Reviews: only owner/admin creates; second create 409; comments carry the correct author; comment on a goal from another cycle rejected; non-member cannot comment or read; commenting outside `group_review` rejected.
9. Review finalize: submitted submissions become `locked` with `locked_at`; drafts remain drafts; originals unchanged (compare goal rows before and after).
10. State matrix: table-driven test for every operation x cycle status in API.md.
11. Immutability triggers for every row in DATABASE.md (SQL-level tests).
12. Throttling on join.

## Mobile tests

- Unit: zod forms, `MonthStrip` layout math, error-code to string mapping, API client refresh-and-retry logic.
- Component: `Button` variants, `Field` error rendering, `PriorityMarks`.
- Manual checklist (run on a real device per milestone, record in PROGRESS.md):
  - Register, kill app, reopen: still signed in.
  - Airplane mode on every screen: shows the network error, no crash, retry works.
  - Font scale 130%: nothing clipped.
  - Two accounts on two devices complete the SPEC 7.4 scenario.
  - Back gesture never lands on a stale screen after login/logout.

## Rules

- A bug fix starts with a failing test.
- No snapshot tests of large trees.
- Tests do not call real AI providers (M2+): mock the client; keep one separate manually-run contract test.
