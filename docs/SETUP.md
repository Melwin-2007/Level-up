# Environment Setup Guide

Step-by-step instructions for provisioning and configuring Supabase environments for Monthly Productivity.

---

## 1. Create Supabase Projects

1. Log into [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new organization (if needed) and create two projects:
   - **`mp-dev`**: Primary local development environment.
   - **`mp-test`**: Isolated testing environment for automated end-to-end tests.
   - _(Optional)_ **`mp-prod`**: Production environment (provisioned before release).
3. Set strong database passwords and store them in your password manager.

---

## 2. Configure Authentication

In both `mp-dev` and `mp-test`:

1. Navigate to **Authentication > Providers > Email**.
2. Ensure **Email provider** is **Enabled**.
3. Toggle **Confirm email** to **OFF** for development so user registration is immediate without email verification friction.
   > [!NOTE]
   > "Confirm email" must be turned back ON in `mp-prod`.

---

## 3. Retrieve Project Keys and URLs

For each project, collect the following values from the Supabase Dashboard:

### A. API Credentials (**Project Settings > API**)

- **Project URL**: Used for `SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_URL`.
- **`anon` `public` key**: Used for `SUPABASE_ANON_KEY` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **`service_role` key**: Used for `SUPABASE_SERVICE_ROLE_KEY` (API backend only, never client).

### B. Database Connection Strings (**Project Settings > Database**)

- **Connection String (Transaction Pooler - port 6543)**:
  - Select URI mode and check "Use connection pooling".
  - Replace `[YOUR-PASSWORD]` with your database password.
  - Append `?pgbouncer=true`.
  - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
  - Assign to `DATABASE_URL`.
- **Connection String (Direct - port 5432)**:
  - Select Direct connection string (port 5432 or session pooler).
  - Format: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`
  - Assign to `DIRECT_URL`.

### C. JWT Configuration (**Project Settings > API / Auth**)

- Determine signing method:
  - If asymmetric keys (JWKS):
    - `JWT_VERIFY_MODE=jwks`
    - `SUPABASE_JWKS_URL=https://[project-ref].supabase.co/auth/v1/.well-known/jwks.json`
  - If symmetric secret (legacy HS256):
    - `JWT_VERIFY_MODE=hs256`
    - `SUPABASE_JWT_SECRET=[your-jwt-secret]`

---

## 4. Populate Local Environment Files

Create `apps/api/.env` from `apps/api/.env.example`:

```bash
PORT=3000
NODE_ENV=development

DATABASE_URL="postgresql://postgres.[ref]:[password]@...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"

SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

JWT_VERIFY_MODE=jwks
SUPABASE_JWKS_URL="https://[ref].supabase.co/auth/v1/.well-known/jwks.json"
```

Create `apps/mobile/.env` from `apps/mobile/.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
EXPO_PUBLIC_API_URL="http://localhost:3000/api/v1"
```

For test execution, duplicate `apps/api/.env` to `apps/api/.env.test` using `mp-test` project credentials.

---

## 5. Verify Setup

Run the connectivity check script:

```bash
pnpm --filter @mp/api run check-db
```

Expected output:

```
Validating environment configuration...
Environment configuration valid.
Testing direct database connection to DIRECT_URL...
✅ Successfully connected to PostgreSQL database!
Database: postgres
PostgreSQL version: PostgreSQL 15...
```
