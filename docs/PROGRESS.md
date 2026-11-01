# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P09
- Branch: feat/p08-acceptance

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [x] P03 Auth guard + profiles
- [x] P04 Groups
- [x] P05 Cycles + state machine
- [x] P06 Submissions
- [x] P07 Reviews
- [x] P08 Backend acceptance suite + hardening
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
- Used single-query nested creates for group creation and submission creation to eliminate interactive transaction roundtrips and avoid connection pool timeouts on remote database poolers.
- Configured `{ maxWait: 15000, timeout: 30000 }` on multi-statement Prisma interactive transactions (`patchSubmission`, `completeReview`).
- Review completion sets submitted submissions to `locked` with `lockedAt` and leaves `draft` untouched; verified byte-identical goals preservation (TESTING.md items 8 and 9).
- Added `@nestjs/swagger` in `apps/api` (non-production only) and exported OpenAPI contract snapshot to `apps/api/openapi.json`.
- Implemented `AppThrottlerGuard` to bind Nest 12 DI injection tokens cleanly.
- Added `httpLoggerMiddleware` strictly logging metadata (`requestId`, `userId`, `method`, `route`, `statusCode`, `durationMs`) without sensitive request bodies.

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.
- [PROD DEPLOYMENT]: The API container is packaged in `apps/api/Dockerfile`. To deploy to Railway/Render/Fly, create a service with build context `.` and Dockerfile `apps/api/Dockerfile`, configure env vars from `docs/SETUP.md` Section 11, and run `prisma migrate deploy`.

## Handoff notes for the next session

- Backend acceptance suite (`test/acceptance/milestone1.e2e-spec.ts`) completely verified (8/8 tests passing).
- Security review completed in `docs/SECURITY-REVIEW-M1.md`.
- Dynamic authorization fuzz test (`test/security/auth-fuzz.e2e-spec.ts`) verified against all registered router endpoints.
- Full API test suite (52 unit tests, 65 e2e tests across 9 suites) 100% green.
- Next prompt: P09 (`prompts/P09-mobile-scaffold-design-system.md`).
