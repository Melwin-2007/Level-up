# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P01
- Branch: main

## Checklist

- [x] P00 Repo bootstrap
- [x] P01 Supabase + environment
- [ ] P02 API scaffold, Prisma schema, migrations, triggers, RLS
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

## Known issues & Prod To-dos

- [PROD TO-DO]: Turn "Confirm email" back ON for production (`mp-prod`) in Supabase Authentication settings. In development (`mp-dev`) and test (`mp-test`), "Confirm email" is disabled for frictionless onboarding.

## Handoff notes for the next session

- Environment validation, example env files, and check script are built and tested.
- Direct connection to Supabase PostgreSQL database verified.
- Next prompt: P02 (`prompts/P02-api-prisma-schema.md`).
