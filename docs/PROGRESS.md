# Progress

Agents: update this file as the last action of every session. Keep it under 150 lines; compress old entries.

## Status

- Current milestone: 1
- Current prompt: P01
- Branch: main

## Checklist

- [x] P00 Repo bootstrap
- [ ] P01 Supabase + environment
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

- Configured `onlyBuiltDependencies: ['esbuild']` in `pnpm-workspace.yaml` to permit esbuild compilation under pnpm 11+.
- Configured `@mp/shared` with Vitest, TypeScript strict settings, Zod schemas, status string unions, and standard API error code unions.

## Known issues

(none yet)

## Handoff notes for the next session

- Monorepo scaffold is green (lint, typecheck, tests passing).
- Next prompt: P01 (`prompts/P01-supabase-environment.md`) for Supabase credentials and `.env` setup.
