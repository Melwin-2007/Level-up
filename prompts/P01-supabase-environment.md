# P01: Supabase project and environment (some steps are yours)

READ: AGENTS.md, docs/ARCHITECTURE.md (Authentication, Hosting), docs/SECURITY.md (Operational rules).

## Steps for the developer (do these first, then start the agent)

1. Create three Supabase projects: `mp-dev`, `mp-test`, `mp-prod` (prod can wait).
2. In `mp-dev`, Authentication: enable Email provider. For development turn OFF "Confirm email" so signup works instantly; note it in PROGRESS.md as a prod to-do.
3. Copy these into `apps/api/.env` (not committed): project URL, anon key, service_role key, the database connection strings (pooler for `DATABASE_URL`, direct for `DIRECT_URL`), and how the project signs JWTs (JWKS URL or JWT secret; Dashboard, Project Settings, API/JWT).
4. Repeat for `mp-test` into `apps/api/.env.test`.

## Goal (agent)

Typed, validated configuration and safe env handling, plus a way to prove the database connection works.

## Tasks

1. Create `apps/api/.env.example` and `apps/mobile/.env.example` with names only: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL` or `SUPABASE_JWT_SECRET`, `JWT_VERIFY_MODE` (`jwks` or `hs256`), `PORT`, `NODE_ENV`; mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`.
2. Add `packages/shared/config` is NOT used for secrets. Instead create `apps/api/src/config/env.schema.ts` (zod) used by Nest `ConfigModule` validation. App must fail at boot with a readable message listing missing variables.
3. Verify `.gitignore` blocks every `.env*` except `.env.example`. Run `git check-ignore -v apps/api/.env`.
4. `docs/SETUP.md` already exists. Check it against what you actually implemented (variable names, script names, commands) and correct any mismatch. Do not rewrite it.
5. Add a script `scripts/check-db.ts` (run with `pnpm --filter api tsx scripts/check-db.ts` or similar) that connects with `DIRECT_URL` and prints server version and current database. No Prisma yet.

## Constraints

- Service role key and DB URLs never appear in `apps/mobile`.
- Do not print secrets in the check script.

## Verify

```
pnpm --filter api tsx scripts/check-db.ts       # prints version
unset DATABASE_URL && pnpm --filter api ...      # config validation fails with a clear list
```

## Finish

Tick P01, commit `chore: environment config and docs/SETUP.md`.
