# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P02
- Branch: feat/p02-api-prisma-schema

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [x] P02 API scaffold, Prisma schema, migrations, triggers, RLS
- [ ] P03 Auth guard + profiles
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
- `profiles.id` stores `auth.users.id` directly as UUID but does not define a cross-schema foreign key constraint in Postgres, preventing Prisma P4002/P3006 multi-schema migration conflicts with Supabase's managed `auth` schema.

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.

## Handoff notes for the next session

- NestJS API scaffolded with `/api/v1` prefix, helmet, 100 kB body size limit, and error filter.
- Complete Prisma schema covering all 16 tables written and migrated.
- Check constraints, partial unique index (`one_baseline_per_member_cycle`), and PL/pgSQL immutability triggers applied and verified by 7 integration invariant tests.
- Next prompt: P03 (`prompts/P03-auth-profiles.md`).
