# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P07
- Branch: feat/p06-submissions

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [x] P03 Auth guard + profiles
- [x] P04 Groups
- [x] P05 Cycles + state machine
- [x] P06 Submissions
- [ ] P07 Reviews
- [ ] P08 Backend acceptance suite + hardening
- [ ] P09 Mobile scaffold + design system
- [ ] P10 Mobile auth + onboarding
- [ ] P11 Mobile groups + cycle overview
- [ ] P12 Mobile submission + review
- [ ] P13 Acceptance on devices + APK

## Decisions made in sessions (also copied to DECISIONS.md)

- Added Zod-based startup configuration validation in `apps/api/src/config/env.schema.ts` with human-readable error formatting.
- `profiles.id` stores `auth.users.id` directly as UUID without a cross-schema foreign key constraint in Postgres, preventing Prisma P4002/P3006 multi-schema migration conflicts with Supabase's managed `auth` schema.
- Global `JwtAuthGuard` supports both `jwks` and `hs256` verification modes via `jose`.
- Timezone validation in `@mp/shared` uses `Intl.DateTimeFormat(undefined, { timeZone })` to validate canonical names and IANA link identifiers.
- Added `MAX_GROUP_MEMBERS` in env schema (default 12 per DECISION 17).
- Invite code generated from 8-char alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` using `crypto.randomInt` with retry loop (max 5) on collision.
- `POST /groups/join` rate-limited to 5 writes/min per user via ThrottlerGuard tracking `req.user.userId`.
- Non-members receive 404 for group-scoped endpoints (DECISION 20). Plain members cannot see `inviteCode` in group detail.
- Cycle state matrix and transitions encapsulated solely in `CycleStateService` using an injectable `Clock` provider.
- `SubmissionsStatusPort` provides read-only submission status resolution for cycle member lists.
- Goal deadlines must fall strictly inside the cycle month (`YYYY-MM-DD`).
- In `GET /cycles/:id/submissions`, an explicit mapper strips `availability`, `constraints`, and drafts from other members' views (DECISION 13).

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.

## Handoff notes for the next session

- `submissions` module complete: `POST /cycles/:id/submission`, `GET /cycles/:id/submission`, `PATCH /cycles/:id/submission`, `POST /cycles/:id/lock-submission`, and `GET /cycles/:id/submissions`.
- Locking enforced in both service layer (409 `SUBMISSION_LOCKED`) and database level via `trg_prevent_submission_goals_modification_when_locked` trigger.
- Full TESTING.md items 5, 6, 7 verified in `test/submissions.e2e-spec.ts`.
- Next prompt: P07 (`prompts/P07-reviews.md`).
