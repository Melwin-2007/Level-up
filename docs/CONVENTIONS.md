# Conventions

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`. No `any`, no non-null `!` without a comment.
- Types and zod schemas shared by both apps live only in `packages/shared`. Mobile and API import from `@mp/shared`.
- Prefer string-literal unions over enums. Discriminated unions for results that can fail.

## Structure
- API: one folder per module: `x.module.ts`, `x.controller.ts`, `x.service.ts`, `x.service.spec.ts`, `dto/`, `mappers/`.
- Mobile: routes in `app/` only render and wire; logic lives in `hooks/` and `services/`; shared UI in `components/ui`; domain components in `components/<domain>`.
- Files under ~250 lines. Functions do one thing.

## Naming
- Files kebab-case. Components PascalCase. Hooks `useThing`. DB tables snake_case plural. Env vars `SCREAMING_SNAKE`.
- Booleans read as questions: `isLocked`, `hasSubmitted`.

## Errors
- API services throw typed `AppError(code, httpStatus, userMessage)`. Never throw raw strings. Never swallow errors.
- Mobile: TanStack Query surfaces errors; a single `mapApiError(error)` converts to a COPY.md string.

## Mobile state
- Server data: TanStack Query only. Query keys: `['cycle', id]`, `['groups']`, `['submission', cycleId]`, etc. Invalidate after mutations.
- Zustand only for: session snapshot, UI preferences, in-progress form drafts. Never duplicate server data in Zustand.

## Git
- Branch per prompt `feat/pNN-name`. Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Squash merge to `main`.
- Never commit generated build output, `.env`, or `node_modules`.

## Dependencies
- Add only with a one-line reason in DECISIONS.md. Prefer Expo SDK-compatible versions (`npx expo install`).
