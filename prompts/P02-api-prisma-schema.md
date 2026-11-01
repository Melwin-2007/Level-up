# P02: NestJS scaffold, Prisma schema, migrations, triggers, RLS

READ: AGENTS.md, docs/ARCHITECTURE.md, docs/DATABASE.md (all), docs/SPEC.md section 3 (all SQL), docs/DECISIONS.md.

## Goal
A running NestJS app connected to Postgres through Prisma, with the full Milestone 1 schema, constraints, immutability triggers and RLS applied by migrations.

## Tasks
1. Scaffold `apps/api` with NestJS (TypeScript strict, Jest). Global prefix `api/v1`. Add `GET /api/v1/health` (public) returning `{ status: "ok" }`. Add helmet, a body size limit of 100 kB, a request-id middleware, and the global exception filter producing the standard error body from docs/API.md.
2. Create `PrismaModule`/`PrismaService`.
3. Write `prisma/schema.prisma` for ALL tables in SPEC section 3.2 (including `goals`, `plan_versions`, `plan_items`, `tasks`, `task_logs`, `monthly_reports`, `xp_transactions`) so later milestones do not need to reshape the core. Use `@@map` / `@map` to keep SPEC names. Add the extra columns/indexes from docs/DATABASE.md ("Additions to SPEC schema" and "Indexes beyond SPEC"). `profiles.id` has no Prisma relation to `auth.users` (added in SQL).
4. Run `prisma migrate dev --create-only --name init`, review the generated SQL. Then create a second migration `db_invariants` (hand-written SQL) containing:
   - all CHECK constraints from SPEC
   - `one_baseline_per_member_cycle` partial unique index
   - FK `profiles.id -> auth.users(id) ON DELETE CASCADE`
   - every trigger in docs/DATABASE.md as PL/pgSQL functions with clear exception messages
   - `UNIQUE (cycle_id)` on `group_reviews`
5. Third migration `rls`: enable RLS on all tables and add the policies from docs/DATABASE.md.
6. Add `test/db/invariants.e2e-spec.ts` that connects to the TEST database and proves, with raw SQL: locked submission goals cannot be updated/inserted/deleted; `plan_items`, `task_logs`, `xp_transactions` reject UPDATE and DELETE; a second baseline for the same member and cycle fails; reoptimized version with `is_baseline = true` fails; invalid status values fail.
7. Add npm scripts: `prisma:migrate`, `prisma:generate`, `test:e2e` (pointing at `.env.test`), `db:reset:test` (only allowed when `NODE_ENV=test`; refuse otherwise).

## Constraints
- Never run migrate/reset against `mp-prod`. The reset script must check the database name contains `test`.
- Statuses remain TEXT + CHECK.
- Do not create any controllers beyond `health`.

## Verify
```
pnpm --filter api prisma migrate dev
pnpm --filter api test:e2e -- invariants
curl localhost:3000/api/v1/health
```

## Finish
Tick P02, record any schema deviations in DECISIONS.md, commit in 3 commits (scaffold, schema, invariants).
