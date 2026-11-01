# Database

Interprets SPEC section 3. The SQL in SPEC.md is the intended schema. Prisma models must match it.

## The three-record principle

| Record | Tables | Mutability |
| --- | --- | --- |
| Submitted | `monthly_submissions`, `submission_goals` | Editable until locked, then frozen |
| Approved | `plan_versions`, `plan_items` | Content frozen at creation; only approval fields change once |
| Actual | `tasks`, `task_logs`, `xp_transactions` | Logs and XP append-only |

Reports (M6) read all three and never write back into them.

## Migration strategy (Prisma + raw SQL)

Prisma cannot express partial unique indexes, CHECK constraints, triggers, RLS or the FK to `auth.users`. So:

1. `apps/api/prisma/schema.prisma` defines tables, columns, relations, plain indexes. Use `@@map`/`@map` so the database uses snake_case plural names exactly as in SPEC.
2. Each Prisma migration that creates tables is followed by a hand-written migration (`prisma migrate dev --create-only`, then edit the SQL) that adds:
   - CHECK constraints (statuses, priority range, month range, report-type rule)
   - partial unique index `one_baseline_per_member_cycle`
   - FK `profiles.id -> auth.users(id) ON DELETE CASCADE`
   - immutability triggers (below)
   - RLS enablement and policies (below)
3. Never edit an applied migration. Add a new one.
4. `DIRECT_URL` is used for migrations; `DATABASE_URL` (pooler, `?pgbouncer=true`) for runtime.
5. Statuses stay `TEXT + CHECK` in the database; TypeScript mirrors them as string-literal unions in `packages/shared` (lowercase, as in SPEC SQL).

## Immutability triggers (write in the raw SQL migration)

| Trigger | Rule |
| --- | --- |
| `submission_goals` BEFORE UPDATE/DELETE | Reject if the parent submission status is `locked` |
| `submission_goals` BEFORE INSERT | Reject if the parent submission status is `locked` |
| `monthly_submissions` BEFORE UPDATE | If OLD.status = `locked`, reject any change to availability/constraints/status |
| `plan_versions` BEFORE UPDATE | Reject changes to `plan_snapshot`, `version_type`, `version_number`, `cycle_id`, `user_id`; allow `approval_status`, `approved_at`, `is_baseline` only from the allowed transition |
| `plan_versions` BEFORE INSERT/UPDATE | If `version_type <> 'initial'` then `is_baseline` must be FALSE |
| `plan_items` BEFORE UPDATE/DELETE | Always reject |
| `task_logs` BEFORE UPDATE/DELETE | Always reject |
| `xp_transactions` BEFORE UPDATE/DELETE | Always reject |

Write a SQL test (or e2e test) for each trigger that proves the rejection.

## Row Level Security

The API connects with a privileged role, so Prisma bypasses RLS. RLS therefore protects against any direct PostgREST/client access, not the API. The API's own authorization (SECURITY.md) is the primary control. Still:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table.
2. Policies (using `auth.uid()`):
   - `profiles`: select/update own row.
   - `groups`, `group_members`: select where the user is a member of that group.
   - `monthly_cycles`: select where the user belongs to the group.
   - `monthly_submissions`: select/insert/update own row (update only if not locked).
   - `submission_goals`: select own; select others' only when the parent submission is `submitted`/`locked` AND the cycle status is `group_review` or later.
   - `review_comments`: select if member of the cycle's group; insert only as `author_id = auth.uid()`.
   - everything else: own rows only (`user_id = auth.uid()`).
3. The mobile app does not query tables with supabase-js. Do not add `anon`/`authenticated` grants beyond what policies need.

## Indexes beyond SPEC

- `group_members (user_id)`
- `monthly_cycles (group_id, status)`
- `monthly_submissions (cycle_id)`
- `submission_goals (submission_id)`
- `review_comments (submission_goal_id, created_at)`
- `groups (invite_code)` is already unique.

## Additions to SPEC schema (also recorded in DECISIONS.md)

- `group_reviews`: `UNIQUE (cycle_id)` (one review session per cycle).
- `monthly_submissions`: add `locked_at TIMESTAMPTZ`.
- `submission_goals`: add `position SMALLINT NOT NULL DEFAULT 0` for display order.
- `groups`: member cap enforced in the service (default 12).

## Seeds and test data

- No seed data in production.
- Dev seed script creates three fake users via the Supabase admin API, one group, one cycle. Tests create their own data and clean it up.
