# Architecture

Interprets SPEC section 2. Modular monolith. One deployable API.

## Components (Milestone 1)

```
Android app (Expo)  --HTTPS /api/v1-->  NestJS API  --Prisma-->  Supabase Postgres
        |                                    |
        +--Supabase Auth (login only)--------+  (API validates the Supabase JWT)
```

Not present yet: Redis/BullMQ (M4), AI orchestrator (M2), scheduling engine (M3), SQLite offline store (M8).

## API modules (apps/api/src)

| Module | Owns | May call |
| --- | --- | --- |
| `common` | guards, filters, pipes, error codes, clock, id/code generators | nothing |
| `auth` | JWT validation, `CurrentUser` decorator, `ProfileRequiredGuard` | common |
| `users` | profile, timezone, preferences (`/me`) | auth, common |
| `groups` | groups, members, invite codes, membership guard | users |
| `cycles` | cycles, state machine, transition rules | groups |
| `submissions` | member submission, goals, lock | cycles |
| `reviews` | review session, comments, finalize | cycles, submissions |
| `prisma` | PrismaService only | nothing |

Rules:
- Controllers parse and respond. Services hold logic. Only services touch Prisma.
- A module never reads another module's tables directly; it calls that module's service.
- Cycle state checks live in ONE place: `CycleStateService.assertAllows(cycle, operation)` (see API.md matrix).
- DTO validation uses zod schemas from `packages/shared`. The same schema validates request bodies on the API and forms on mobile.

## Request pipeline

1. `JwtAuthGuard` verifies the Supabase access token and attaches `{ userId }`.
2. `ProfileRequiredGuard` (all routes except `PUT /me`) ensures a profile exists.
3. Route-level guard: `GroupMemberGuard` / `GroupAdminGuard` loads membership from the DB (never trusts client).
4. Zod validation pipe.
5. Service method: loads resource, checks ownership + cycle state, performs a transaction.
6. Global exception filter maps errors to the standard error body (API.md).

## Authentication

- Mobile signs up / logs in with `supabase-js`. The session is stored with the encrypted-storage pattern (SecureStore has a size limit, so keep the encryption key in SecureStore and the session blob in AsyncStorage).
- Mobile sends `Authorization: Bearer <access_token>` to the API.
- API verifies with the `jose` library. Check the Supabase dashboard: new projects use asymmetric signing keys (verify against the project's JWKS URL); older projects use the shared HS256 secret. Support the one the project uses, selected by env, and fail closed.
- Verify signature, `exp`, `aud = authenticated`, and issuer. Identity is `sub`.
- Token refresh is the mobile app's job. On 401 the app refreshes once, then retries once.

## Time

- Store `timestamptz` in UTC. Dates (`deadline`, `planned_date`) are calendar dates in the member's timezone.
- A "cycle month" is a calendar month. Cycle boundaries are computed per member timezone when planning begins (M3). In M1 only deadlines (`timestamptz`) matter.
- All "now" access goes through an injectable `Clock` so tests control time.

## Hosting (solo, low cost)

- Database/Auth: Supabase free or Pro project. Use two projects: `dev` and `prod`. Tests use a separate schema or database, never `dev` data.
- API: one container on Railway, Render or Fly.io. Needs: `DATABASE_URL` (pooler), `DIRECT_URL` (direct, for migrations), Supabase JWT config, `PORT`.
- Mobile: EAS Build for APK (internal distribution) in P13. Play Store later.
- Redis (Upstash or similar) only when M4 starts.
