# Setup

Everything needed to recreate the development environment from nothing. Follow in order. Items marked **(you)** can only be done by the developer, not the agent.

## 1. Machine prerequisites **(you)**

| Tool             | Version                                                    | Check                                                                             |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Node.js          | current LTS                                                | `node -v`                                                                         |
| pnpm             | latest 9 or 10                                             | `pnpm -v` (install: `corepack enable && corepack prepare pnpm@latest --activate`) |
| Git              | any recent                                                 | `git --version`                                                                   |
| Android Studio   | latest stable, with one emulator (Pixel, recent API level) | open AVD Manager                                                                  |
| Java JDK         | 17 (bundled with Android Studio is fine)                   | `java -version`                                                                   |
| Expo / EAS CLI   | via `npx` and `npm i -g eas-cli`                           | `eas --version`                                                                   |
| Optional: Docker | only if you want local Supabase instead of cloud           | `docker -v`                                                                       |

Android notes:

- Set `ANDROID_HOME` to the SDK folder and add `platform-tools` to `PATH`. Check with `adb devices`.
- A physical phone is better for the acceptance test: enable Developer options, USB debugging, then `adb devices` should list it.
- Windows: use PowerShell or WSL2 consistently; do not mix. Keep the repo outside OneDrive-synced folders (Metro and pnpm struggle there).

## 2. Accounts **(you)**

- GitHub (repo + CI)
- Supabase
- Expo (for EAS builds)
- One host for the API: Railway, Render or Fly.io
- Later (Milestone 2 onward): an LLM provider API key
- Later (Milestone 4 onward): a managed Redis (for example Upstash)

## 3. Repository

```
mkdir monthly-productivity && cd monthly-productivity
git init
# copy the kit contents here, save your spec as docs/SPEC.md
git add . && git commit -m "docs: add spec, agent rules and prompt kit"
```

Then run prompt `P00`. After P00, `pnpm install` works at the root.

## 4. Supabase **(you)**

Create three projects: `mp-dev`, `mp-test`, `mp-prod` (prod can wait until deployment). Pick the region closest to you and your API host; use the same region for all three. Save each database password in a password manager.

For each project:

1. **Authentication**: make sure the Email provider is enabled.
   - `mp-dev` and `mp-test`: turn "Confirm email" OFF so sign-up works instantly.
   - `mp-prod`: leave email confirmation ON. Note in `docs/PROGRESS.md` that the mobile app needs an email-confirmation screen before production use.
2. **API keys** (Project Settings, API): copy the project URL, the anon (public) key, and the service role key.
3. **Database connection strings** (Project Settings, Database, Connection string):
   - Pooler / transaction string, port 6543 -> `DATABASE_URL` (append `?pgbouncer=true&connection_limit=1`).
   - Direct or session string, port 5432 -> `DIRECT_URL` (used only for migrations).
4. **JWT signing**: check which method the project uses (Project Settings, JWT keys / API). New projects use asymmetric signing keys: use the JWKS URL and set `JWT_VERIFY_MODE=jwks`. Older projects use a shared secret: copy it and set `JWT_VERIFY_MODE=hs256`. Menu names change between dashboard versions; look for "JWT".

Never paste the service role key or database URLs into the mobile app, chat messages, screenshots, or commits.

## 5. Environment files

Files are never committed. Only the `.env.example` files are.

### `apps/api/.env` (dev)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_VERIFY_MODE=jwks            # or hs256
SUPABASE_JWKS_URL=              # when jwks
SUPABASE_JWT_SECRET=            # when hs256
THROTTLE_WRITES_PER_MINUTE=60
GROUP_MEMBER_CAP=12
```

### `apps/api/.env.test`

Same keys, pointing at `mp-test`. `NODE_ENV=test`. The reset script refuses to run unless the database name contains `test`.

### `apps/mobile/.env`

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` is how the Android emulator reaches your computer's `localhost`. For a physical phone use your computer's LAN IP (for example `http://192.168.1.20:3000/api/v1`) with both on the same Wi-Fi, or use the deployed API URL. Everything prefixed `EXPO_PUBLIC_` is visible to anyone who unpacks the app: only the URL and the anon key belong there.

## 6. Verify the database connection

After prompt P01:

```
pnpm --filter api tsx scripts/check-db.ts
```

It prints the Postgres version and database name and no secrets.

## 7. Database migrations

```
pnpm --filter api prisma migrate dev       # applies to mp-dev (uses DIRECT_URL)
pnpm --filter api test:e2e                 # applies to mp-test and runs tests
```

Rules:

- Never run `migrate reset` or `db push` against `mp-prod`.
- For triggers, constraints and RLS, create migrations with `--create-only` and edit the SQL (see `docs/DATABASE.md`).
- Production migrations: `pnpm --filter api prisma migrate deploy` with prod `DIRECT_URL`, run from your machine or from the deploy pipeline, after the same migration passed on `mp-test`.

## 8. Run everything locally

Terminal 1:

```
pnpm --filter api start:dev
curl http://localhost:3000/api/v1/health
```

Terminal 2:

```
pnpm --filter mobile start       # then press "a" for the Android emulator
```

Physical phone: install a development build (see EAS below) or Expo Go if all your dependencies are supported by Expo Go; scan the QR code on the same network.

## 9. Seed development data (optional)

`pnpm --filter api seed:dev` creates three fake users through the Supabase admin API, one group, and one cycle. It must refuse to run when `NODE_ENV=production`. Passwords for the fake users are printed once to the terminal and never stored in the repo.

## 10. CI

`.github/workflows/ci.yml` runs install, lint, typecheck and unit tests on every push. E2E tests need `mp-test` secrets; add them as GitHub repository secrets (`TEST_DATABASE_URL`, `TEST_DIRECT_URL`, `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, JWT settings) only if you want e2e in CI. Otherwise run them locally before merging.

## 11. Deploy the API (after prompt P08)

The Dockerfile at `apps/api/Dockerfile` is multi-stage and runs as a non-root user. Generic steps for Railway, Render or Fly.io:

1. Create a service from the GitHub repo, build context = repo root, Dockerfile path = `apps/api/Dockerfile`.
2. Set environment variables from section 5, using `mp-prod` values: `NODE_ENV=production`, `DATABASE_URL`, `DIRECT_URL`, Supabase URL and keys, JWT settings, `PORT` as the host requires.
3. Run `prisma migrate deploy` as a release/pre-deploy command (not on every container start if you scale beyond one instance).
4. Health check path: `/api/v1/health`.
5. Verify: `curl https://<your-api-host>/api/v1/health`.
6. Restrict CORS to what the mobile app needs. React Native requests do not send browser origins, so CORS can stay closed for browsers.

Free tiers sleep when idle; expect a slow first request after inactivity.

## 12. Android builds with EAS (prompt P13)

```
npm i -g eas-cli
eas login
cd apps/mobile
eas build:configure
eas build --platform android --profile preview     # installable APK
```

- `eas.json` profiles: `preview` (APK, internal distribution) and `production` (AAB for the Play Store).
- Set `EXPO_PUBLIC_*` values for builds with `eas env` / EAS secrets (check current EAS docs for the exact command).
- The app's Android package id (for example `com.yourname.monthlyproductivity`) cannot be changed after you publish. Choose it deliberately.
- Install the APK on your phone from the build page link or with `adb install`.
- Keep the Android keystore that EAS generates backed up (`eas credentials`).

## 13. Secrets checklist

Before every commit: `git status` shows no `.env` files. Before every release: run `git ls-files | grep -i env` (only `.env.example` files may appear), and search the repo for your Supabase service key's first characters.

If a secret is ever committed: rotate it in Supabase immediately, then remove it from history; deleting it in a later commit is not enough.

## 14. Troubleshooting

| Symptom                                 | Likely cause and fix                                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1001 can't reach database`            | Wrong URL, or IPv6-only direct host from a network without IPv6. Use the pooler session string for `DIRECT_URL`.                                                                    |
| Prisma migrate hangs                    | Running it against the transaction pooler (6543). Use the direct/session string.                                                                                                    |
| `prepared statement already exists`     | Missing `?pgbouncer=true` on `DATABASE_URL`.                                                                                                                                        |
| API returns 401 for every request       | JWT mode mismatch (`jwks` vs `hs256`), wrong audience, or the phone sends an expired token. Decode the token at jwt.io (never paste production tokens) and compare `iss` and `aud`. |
| Emulator cannot reach the API           | Use `10.0.2.2` not `localhost`. Physical phone: use LAN IP and allow the port in your firewall.                                                                                     |
| Metro cannot resolve `@mp/shared`       | `.npmrc` must contain `node-linker=hoisted`; delete `node_modules` and reinstall; make sure Expo's monorepo config is picked up (restart with `--clear`).                           |
| White flash on app start                | Splash and root background not `#000000`. See `docs/DESIGN.md`.                                                                                                                     |
| Fonts show as system font               | Fonts not loaded before first render; keep the splash until `useFonts` returns.                                                                                                     |
| Sign-up needs email confirmation in dev | "Confirm email" is still ON in that Supabase project.                                                                                                                               |
| Tests touch real data                   | They must use `.env.test`. Check `NODE_ENV=test` and the project URL.                                                                                                               |

## 15. Done criteria for the environment

- [ ] `node -v`, `pnpm -v`, `adb devices` all work
- [ ] Three Supabase projects exist; dev and test sign-up works without email confirmation
- [ ] `check-db` prints a Postgres version for dev and test
- [ ] API health endpoint answers locally
- [ ] Emulator or phone opens the mobile app and reaches the API
- [ ] No `.env` file is tracked by git
