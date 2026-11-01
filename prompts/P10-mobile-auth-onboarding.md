# P10: Mobile authentication and onboarding

READ: AGENTS.md, docs/ARCHITECTURE.md (Authentication), docs/API.md (Me, errors), docs/COPY.md, docs/DESIGN.md (Components, Layout), docs/SECURITY.md (Operational rules).

## Goal

A person can register, sign in, stay signed in, set up their profile, and sign out. The app talks to the API with a bearer token.

## Tasks

1. `services/supabase.ts`: supabase-js client with a session storage adapter using the encrypted-AsyncStorage pattern (encryption key in SecureStore, session blob in AsyncStorage). Only anon key and URL in the app.
2. `services/api.ts`: typed fetch wrapper: base URL from env, attaches the current access token, parses the standard error body, on 401 refreshes the session once and retries once, throws `ApiError(code, message, details)`. `mapApiError` converts codes to COPY.md strings.
3. `stores/session.ts` (Zustand): session snapshot, `hasProfile`. Auth state listener keeps it in sync.
4. Route groups: `(auth)` for sign in / sign up; `(tabs)` for the main app. Redirect logic in the root layout: no session -> `(auth)`; session without profile -> `onboarding`; else tabs. No flicker: render the splash until the session check finishes.
5. Screens: Sign in, Sign up, Onboarding (display name, timezone with a searchable list defaulting to the device timezone, validated with the shared zod schema), You tab with sign out. Copy from COPY.md; errors in `ErrorBar`.
6. Onboarding calls `PUT /me`; on success the redirect moves to tabs.
7. Tests: API client refresh-and-retry (mock fetch), `mapApiError`, session store transitions.

## Constraints

- No social login yet.
- Never log tokens or passwords. Password fields: `secureTextEntry`, autofill hints set, minimum 8 characters.

## Verify

Manual: register, kill the app, reopen (still signed in), sign out, sign in. Airplane mode on sign in shows the network error string.

## Finish

Tick P10, record the manual checklist result in PROGRESS.md, commit `feat(mobile): auth and onboarding`.
