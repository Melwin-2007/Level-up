# P03: JWT authentication and profiles

READ: AGENTS.md, docs/ARCHITECTURE.md (Request pipeline, Authentication), docs/SECURITY.md, docs/API.md (Me, errors), docs/TESTING.md (items 1 and 2).

## Goal

Every route is authenticated by default. A user can create and read their own profile.

## Tasks

1. `auth` module: `JwtAuthGuard` registered globally; `@Public()` decorator for `health`. Verify tokens with `jose` in the mode set by `JWT_VERIFY_MODE`. Check signature, `exp`, `aud = authenticated`, issuer. Attach `{ userId }`. Provide `@CurrentUser()`.
2. `ProfileRequiredGuard` registered globally after auth; `@AllowWithoutProfile()` for `PUT /me`. Missing profile returns 403 `PROFILE_REQUIRED`.
3. `users` module with `PUT /me` (upsert own profile: displayName 1 to 60 chars, timezone validated against `Intl.supportedValuesOf('timeZone')`, default `Asia/Kolkata`) and `GET /me`. Use zod schemas from `@mp/shared` (create them there; the mobile app will reuse them).
4. Throttler module configured globally with the write limits from docs/SECURITY.md.
5. Test helpers in `apps/api/test/helpers`: `createTestUser`, `asUser`, injectable `Clock`. Prefer creating users through the Supabase admin API in `mp-test` and signing in for a real token, so the guard is tested for real.
6. Tests: TESTING.md items 1 and 2, plus: a token for user A can never read user B's profile (there is no route that accepts another id; add a test that `GET /me` returns the caller).

## Constraints

- Never trust a user id from body, query or params.
- Do not log tokens.

## Verify

```
pnpm --filter api test && pnpm --filter api test:e2e
curl -i localhost:3000/api/v1/me          # 401
```

## Finish

Tick P03, update PROGRESS.md, commit `feat(auth): jwt guard and profiles`.
