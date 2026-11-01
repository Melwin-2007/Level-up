# AGENTS.md

Project: monthly-productivity. A group-reviewed monthly planning app. Mobile: Expo/React Native (Android first). Backend: NestJS modular monolith. Database: Supabase PostgreSQL via Prisma.

You are working for one solo developer. Be economical: small diffs, no speculative abstractions, no extra dependencies without a reason written in `docs/DECISIONS.md`.

## Read order at the start of every session

1. `docs/PROGRESS.md` (where we are, what is broken)
2. The prompt file you were given in `prompts/`
3. Only the docs that prompt lists under READ
4. `docs/SPEC.md` only for the sections the prompt names

Do not read the whole repo. Do not re-read files you have already read in this session.

## Non-negotiable rules

1. Three records are never merged: what the member submitted, what they approved as baseline, what actually happened. (`docs/DATABASE.md`)
2. Locked submissions, approved baseline plans, task logs and XP transactions are immutable. Enforce in the service layer AND with database triggers.
3. The backend decides everything: access, approval, XP, AI actions. The mobile app talks to Supabase only for authentication. All data goes through `/api/v1`.
4. Identity comes only from the validated JWT (`sub`). Never accept a user id from a request body, query or path to mean "the current user".
5. Group membership never grants access to another member's private data (availability, constraints, drafts, tasks, schedules, reports).
6. Every endpoint checks the cycle state before acting (`docs/API.md` state matrix).
7. All timestamps are stored UTC (`timestamptz`). Date-based logic uses the member's IANA timezone.
8. No AI features until Milestone 2. No Redis/BullMQ until Milestone 4. No microservices. No CRDTs.
9. No secrets in the repo, in the mobile bundle, in logs or in test snapshots. AI provider keys exist only in the API environment.
10. Never use `any`, `@ts-ignore`, or disable lint rules to get green. Fix the cause.

## Working method

- First reply of a session: a plan of at most 15 lines (files to touch, order, risks). Then build without waiting, unless a rule above is at risk.
- If something is ambiguous, use `docs/DECISIONS.md`. If it is not covered, take the simplest option, append it to `DECISIONS.md` as a new numbered entry, and continue.
- Work on one branch per prompt: `feat/p03-profiles`. Commit in small steps using Conventional Commits.
- Write the tests listed in the prompt in the same session as the code. A prompt is not finished while any test fails.
- Before finishing: run lint, typecheck, tests (commands below). Paste the results.
- Last action of every session: update `docs/PROGRESS.md` (done, decisions made, known issues, next prompt).

## Stop and report (do not push through) when

- A rule above would have to be broken.
- A migration would drop or rewrite existing data.
- You need a secret or an account action only the developer can do. Say exactly what and where to paste it.
- The same error survives two different fixes.

## Commands

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test                          # all workspaces
pnpm --filter api start:dev
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api prisma migrate dev
pnpm --filter api prisma generate
pnpm --filter mobile start
pnpm --filter mobile android
```

## Repo map

```
apps/api        NestJS API (src/auth, users, groups, cycles, submissions, reviews, common)
apps/mobile     Expo app (app/ routes, components, hooks, services, stores, theme)
packages/shared zod schemas + types used by both apps
docs/           spec and rules
prompts/        build prompts
```

## Definition of done (any prompt)

Code compiles, lint clean, new tests pass, existing tests pass, no new `TODO` without an entry in PROGRESS.md, docs updated if behaviour changed, PROGRESS.md updated.
