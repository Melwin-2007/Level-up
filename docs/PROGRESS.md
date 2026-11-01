# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P04
- Branch: feat/p03-profiles

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [x] P03 Auth guard + profiles
- [ ] P04 Groups
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
- Added database connection diagnostic script in `apps/api/scripts/check-db.ts` utilizing `pg.Client` directly without leaking secrets.
- `profiles.id` stores `auth.users.id` directly as UUID without a cross-schema foreign key constraint in Postgres, preventing Prisma P4002/P3006 multi-schema migration conflicts with Supabase's managed `auth` schema.
- Global `JwtAuthGuard` supports both `jwks` and `hs256` verification modes via `jose`.
- Timezone validation in `@mp/shared` uses `Intl.DateTimeFormat(undefined, { timeZone })` to validate canonical names and IANA link identifiers (such as `'Asia/Kolkata'`).

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.

## Handoff notes for the next session

- Global `JwtAuthGuard` enforces JWT authentication with `sub` attached as `req.user.userId`.
- Global `ProfileRequiredGuard` enforces profile existence (`403 PROFILE_REQUIRED`) except on `@AllowWithoutProfile()` (`PUT /me`).
- Users module implements `GET /me` and `PUT /me` with `@mp/shared` Zod schemas and default timezone `Asia/Kolkata`.
- Global `ThrottlerGuard` protects API routes against spam/abuse.
- E2E tests in `test/auth-profiles.e2e-spec.ts` verify all unauthenticated, token expiry, profile creation, and user isolation scenarios.
- Next prompt: P04 (`prompts/P04-groups.md`).
