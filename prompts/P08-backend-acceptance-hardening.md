# P08: Backend acceptance suite and hardening

READ: AGENTS.md, docs/TESTING.md, docs/SECURITY.md, docs/SPEC.md (7.4).

## Goal
Prove the entire backend flow with one scenario test, then close security gaps before any mobile code exists.

## Tasks
1. Write `test/acceptance/milestone1.e2e-spec.ts` that executes SPEC 7.4 exactly: A creates group, B and C join, A creates November cycle, all three submit different goals, cycle advances to review, each sees others' goals (and not availability/constraints), comments added by each member are attributed correctly, review completed, submissions locked, originals preserved, PATCH after lock fails.
2. Run the Section 5 checklist in docs/SECURITY.md against every route. Produce `docs/SECURITY-REVIEW-M1.md` with a table: route, identity source, scoping, cycle-state check, test name. Fix any gap found.
3. Add an authorization fuzz test: for each route, call it with (a) no token, (b) a valid token for a non-member, (c) a member without the needed role. Assert expected 401/404/403. Generate the route list from Nest's router so new routes cannot be forgotten.
4. Confirm: no response includes raw Prisma rows; log lines contain no goal/comment text; helmet and CORS configured; request-id present on errors.
5. Generate an OpenAPI document from Nest (`@nestjs/swagger`) in non-production only, so you can inspect the contract. Save a snapshot `apps/api/openapi.json` in the repo.
6. Add `Dockerfile` (multi-stage, non-root user) and deployment notes to `docs/SETUP.md` for Railway/Render/Fly. Deploy the API once to a free tier and run `curl /api/v1/health`.

## Constraints
- Fixing a gap requires a failing test first.

## Verify
```
pnpm --filter api test && pnpm --filter api test:e2e
```
All green, including the acceptance scenario.

## Finish
Tick P08, tag `api-m1-ready`, update PROGRESS.md with the deployed API URL (no secrets).
