# P24: Plan Approval API (`POST /cycles/:id/approve-plan`)

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md, docs/DATABASE.md (three-record principle).

## Goal

Create `POST /cycles/:id/approve-plan` allowing a member to approve a pending plan version, making it the immutable baseline plan (`is_baseline = true`), and triggering cycle advance to `execution` when all participating members have approved.

## Tasks

1. Endpoint `POST /cycles/:id/approve-plan`:
   - Input: `{ planVersionId: string }`.
   - Allowed only in `planning` state (`CycleStateService.assertAllows(cycle, 'plan.approve')`).
   - Verifies ownership (`plan_version.user_id === req.user.userId`).
   - Verifies `approval_status === 'pending'`. Rejects if already approved or rejected.
2. Baseline promotion transaction:
   - Sets `approval_status = 'approved'`, `approved_at = now()`.
   - Sets `is_baseline = true` if no prior baseline exists for `(cycle_id, user_id)` (enforced atomically; relies on partial unique index or transaction isolation).
   - Once marked `is_baseline = true`, database triggers / application logic prevent any update or delete of this row.
3. Cycle phase auto-advance check:
   - Inspects whether all members with locked submissions in the cycle have an approved plan version.
   - If all participating members approved, transitions cycle phase from `planning` to `execution`.
   - Group owner/admin can also advance manually via `POST /cycles/:id/advance`.
4. Endpoint `GET /cycles/:id/plan`:
   - Returns the member's current approved plan or latest pending plan version with `plan_items`.
   - For other members: returns 403 / private data blocked per non-negotiable rule 5.
5. Tests in `apps/api/test/plan-approval.e2e-spec.ts`:
   - Successfully approves pending plan version and marks baseline.
   - Double-approve race condition handled safely.
   - Approving already approved or foreign user's plan is rejected.
   - All members approved -> cycle transitions to `execution`.

## Verify

```
pnpm --filter api test:e2e -- plan-approval
```

## Finish

Tick P24 in `docs/PROGRESS.md`, commit `feat(api): plan approval endpoint and baseline plan immutability`.
