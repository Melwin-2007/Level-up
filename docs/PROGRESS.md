# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 3
- Current prompt: P31 (Complete)
- Branch: feat/p31-timezone-calendar
- Next prompt: P32 (Pipeline integration)

## Checklist

### Milestone 1: Foundations & Group Planning (Complete)

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [x] P03 Auth guard + profiles
- [x] P04 Groups
- [x] P05 Cycles + state machine
- [x] P06 Submissions
- [x] P07 Reviews
- [x] P08 Backend acceptance suite + hardening
- [x] P09 Mobile scaffold + design system
- [x] P10 Mobile auth + onboarding
- [x] P11 Mobile groups + cycle overview
- [x] P12 Mobile submission + review
- [x] P13 Acceptance on devices + APK

### Milestone 2: AI Goal Analysis & Plan Generation (Complete)

- [x] P20 LLM gateway
- [x] P21 Planner input builder
- [x] P22 Feasibility and decomposition
- [x] P23 Plan generation API
- [x] P24 Plan approval API
- [x] P25 Mobile AI plan review

### Milestone 3: Daily Task Scheduling Engine (In Progress)

- [x] P30 Pure scheduler
- [x] P31 Timezone and calendar handling
- [ ] P32 Pipeline integration
- [ ] P33 Mobile weekly and daily planner views

## Decisions made in sessions (also copied to DECISIONS.md)

- Implemented timezone & calendar availability calculator in `@mp/scheduler` (`packages/scheduler/src/calendar.ts`) computing exact available minutes per local date across month lengths (28-31 days, leap years 2028, century leap 2000 vs 1900).
- Handled dated exception overrides (public holidays, catch-up work) and DST transitions in `America/New_York` (23h spring forward, 25h fall back) and `Europe/London`, with bidirectional `localSlotToUtc` and `utcToLocalSlot` converters and non-DST zone `Asia/Kolkata`.

- Implemented pure deterministic constraint-based task scheduling engine in `packages/scheduler` (`@mp/scheduler`) with zero framework or database dependencies.
- Enforced hard constraints: non-overlapping tasks, availability interval boundaries, dependency sequencing, deadline compliance, and daily capacity limits.
- Guaranteed zero work silently dropped (`input.tasks.length === scheduled.length + unscheduled.length`) with explicit trade-off explanations. Verified with 100 fast-check property iterations.

- Implemented `apps/mobile/app/cycles/[id]/plan.tsx` with prominent "Proposed by AI" banner on unapproved plans, feasibility capacity load bar, conflict alerts, and weekly milestone breakdown.
- Built AI Assistant bottom sheet using plain-row layout (no chat bubbles) providing plan pacing insights and adjustment regeneration form.
- Added baseline approval flow with confirmation sheet and atomic lock; verified zero hex literals outside `theme/tokens.ts`.

- Implemented `POST /cycles/:id/approve-plan` in `PlansService` & `PlansController`, atomically setting `approval_status = 'approved'`, `is_baseline = true`, and `approved_at = clock.now()`.
- Added race protection and baseline uniqueness verification; prevented duplicate approvals or cross-member plan approvals.
- Implemented automatic cycle transition from `planning` to `execution` when all participating members (locked submissions) approve baseline plans.

- Implemented `POST /cycles/:id/generate-plan` and `GET /cycles/:id/plan` in `PlansService` & `PlansController`.
- Enforced 3 generations per cycle per member rate limit returning 429 `PLAN_GENERATION_LIMIT_EXCEEDED`.
- Persisted immutable plan versions (`initial` vs `reoptimized`) and plan items atomically via Prisma transactions.

- Added Zod schemas for `FeasibilityReport` and `PlanDecomposition` in `@mp/shared` covering capacity ratios, goal verdicts, conflicts, and weekly milestones.
- Created versioned prompt builder `buildPlannerPrompt` (`planner-decomposition` v1.0) incorporating availability, dated exceptions, locked goals, and optional user adjustment feedback.

- Implemented `buildPlannerInput` ensuring strict privacy isolation: queries strictly for caller's locked submission and goals, blocking foreign member leakage and validating cycle `planning` phase.

- Added AI provider abstraction (`LlmClient`, `FakeLlmClient`, `GeminiLlmClient`) with Zod-validated structured outputs, 30s timeout, jittered retries, and token/cost audit logging in `ai_action_logs`.
- Redacted API keys from all error traces and logs to guarantee zero secrets leakage.

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
- Scaffolded Expo SDK 58 in `apps/mobile` with NativeWind v4, forced dark theme (`#000000`), custom font loaders (Archivo Narrow & Public Sans).
- Built complete `components/ui` design system and verified zero hex literals outside `theme/tokens.ts`.
- Implemented `services/supabase.ts` with encrypted-AsyncStorage session storage pattern (256-bit AES key in SecureStore, session in AsyncStorage via `aes-js`).
- Implemented `services/api.ts` typed fetch client with Bearer token attachment, 401 refresh-and-retry, error parsing, and `mapApiError` mapping.
- Implemented `stores/session.ts` with Zustand auth state sync and profile checks.
- Created `(auth)` (Sign In, Sign Up), `onboarding` (display name, searchable IANA timezone), and `(tabs)` (Today, Month, Group, You).
- Implemented `services/dates.ts` and `services/cycle-actions.ts` pure business logic; unit tested across all phases and roles.
- Implemented TanStack Query hooks in `hooks/use-groups.ts` and `hooks/use-cycles.ts`.
- Built Group tab with create/join sheets, member list, and native invite code sharing.
- Built Month tab with MonthStrip, deadline markers, phase dates, member submission status list with `StatusSquare`, and advance confirmation sheet.
- Implemented `submission-draft.ts` Zustand store with `persist` middleware to survive app crashes.
- Implemented `submission-mapper.ts` for bidirectional conversion between form state and shared Zod API payloads.
- Built Goal submission screen (`apps/mobile/app/cycles/[id]/submission.tsx`) with goal rows, add/edit goal Sheet, 5-square priority picker, deadline bounded by cycle month, success criteria picker (checklist, metric, binary), weekday steppers, lock confirmation, and orchestrated motion.
- Built Group review screen (`apps/mobile/app/cycles/[id]/review.tsx`) grouping goals by member with accordion goal details, inline comment rows with relative timestamps, add comment Sheet, finish review confirmation, and 15s conditional polling while active.
- Added Jest test suites for submission mapping, draft store, and review comment list (56/56 tests passing across 10 suites in mobile).

- Configured EAS build in `apps/mobile/eas.json` with `preview` (APK, internal) and `production` profiles.
- Wrote `docs/ACCEPTANCE-M1.md` with full 25-step SPEC 7.4 scenario checklist.
- Visual & contrast audit: removed all restricted text colors (`flare` small text, `signal` text, `oxblood` text) to ensure strict WCAG AA contrast compliance with `docs/DESIGN.md`.
- Privacy pass: verified that member availability, constraints, and drafts are never leaked across users via test suites and API contracts.

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.
- [PROD DEPLOYMENT]: The API container is packaged in `apps/api/Dockerfile`. To deploy to Railway/Render/Fly, create a service with build context `.` and Dockerfile `apps/api/Dockerfile`, configure env vars from `docs/SETUP.md` Section 11, and run `prisma migrate deploy`.

## Milestone 2 Starting Notes (AI Planning & Calendar)

- Milestone 1 is 100% complete.
- Open questions from `docs/DECISIONS.md` to resolve for M2:
  1. AI planner provider: Gemini / Anthropic via NestJS server module. AI keys exist only on the API server.
  2. Should owners be able to remove members or rotate invite codes?
  3. Should a member who did not submit by review time be excluded from planning automatically? (Default: yes, recorded as `draft`).
  4. Calendar export format (ICS / Google Calendar sync).
- Verification: 114 unit tests pass, 65 backend e2e acceptance tests pass. All 25 acceptance criteria in `docs/ACCEPTANCE-M1.md` pass.
