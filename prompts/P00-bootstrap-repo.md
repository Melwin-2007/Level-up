# P00: Bootstrap the monorepo

READ: AGENTS.md, docs/CONVENTIONS.md, docs/DECISIONS.md (entries 1 to 10), docs/ARCHITECTURE.md (Components, API modules).

## Goal
An empty but fully wired pnpm monorepo: lint, typecheck and test run green on nothing. No features.

## Tasks
1. Create `pnpm-workspace.yaml` with `apps/*` and `packages/*`. Add `.npmrc` with `node-linker=hoisted`.
2. Root `package.json`: scripts `lint`, `typecheck`, `test` that run recursively. Add `engines.node` for the current LTS.
3. Root `tsconfig.base.json` (strict, noUncheckedIndexedAccess, ES2022, moduleResolution bundler or node16 as each app needs). ESLint flat config with typescript-eslint, plus Prettier. Add `.editorconfig`, `.gitignore` (includes `.env*` except `.env.example`, `node_modules`, `dist`, `.expo`, `ios`, `android`), `.gitattributes`.
4. `packages/shared`: package name `@mp/shared`, exports `src/index.ts`. Add folders `types/`, `validation/`, a `errors.ts` with the error-code union from docs/API.md, and `status.ts` with the cycle/submission/role string-literal unions. Add a trivial test proving the package is importable.
5. Create empty `apps/api` and `apps/mobile` folders with only a README line each (they are scaffolded in P02 and P09).
6. Husky or lefthook pre-commit: lint-staged (eslint + prettier on staged files). Keep it fast.
7. GitHub Actions workflow `ci.yml`: install with pnpm cache, lint, typecheck, test. (Skip e2e for now.)
8. Root `README.md`: what the project is in 5 lines, how to run, link to docs.

## Constraints
- Do not scaffold NestJS or Expo yet.
- Do not add dependencies outside this list: typescript, eslint, typescript-eslint, prettier, lint-staged, husky (or lefthook), jest or vitest for the shared package, zod.

## Verify
```
pnpm install && pnpm lint && pnpm typecheck && pnpm test
git status   # clean after commit
```

## Finish
Update docs/PROGRESS.md (tick P00). Commit `chore: bootstrap monorepo`.
