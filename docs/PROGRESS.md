# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P05
- Branch: feat/p04-groups

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [x] P03 Auth guard + profiles
- [x] P04 Groups
- [ ] P05 Cycles + state machine
- [ ] P06 Submissions
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

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.

## Handoff notes for the next session

- `groups` module complete: `POST /groups`, `GET /groups`, `GET /groups/:id`, and `POST /groups/join`.
- `GroupMemberGuard` and `GroupAdminGuard` implemented and exported. `GroupsService` exports `requireMembership` and `requireAdmin` for subsequent modules (cycles, submissions, reviews).
- 41 automated tests passing across workspaces (`test/groups.e2e-spec.ts`, `test/auth-profiles.e2e-spec.ts`, `test/db/invariants.e2e-spec.ts`, `test/health.e2e-spec.ts`, unit tests).
- Next prompt: P05 (`prompts/P05-cycles.md`).
