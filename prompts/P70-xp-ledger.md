# P70: XP Ledger and Gamification Engine

## Goal

Implement the backend-only XP ledger and level derivation system. XP is awarded upon task completion using strict idempotency keys (`taskId:eventType:version`). XP rules and mathematical level thresholds are pure and deterministic. Levels are derived on-the-fly from the append-only ledger sum, never stored as mutable counters in database columns.

## READ

- `docs/DATABASE.md` (Actuals: tasks, task_logs, xp_transactions append-only, trigger `trg_xp_transactions_immutable`)
- `docs/DECISIONS.md`
- `prompts/LATER-MILESTONES.md` (P70)

## Scope

1. `packages/shared/src/gamification/xp.ts`:
   - Pure XP rules: base XP per task, bonus for estimated duration, criteria completion bonuses.
   - Level derivation formula: pure function `calculateLevel(totalXp)` and `calculateLevelProgress(totalXp)`.
   - Zod schemas: `xpTransactionSchema`, `userXpSummarySchema`, `xpSummaryResponseSchema`.

2. `apps/api/src/xp/`:
   - `xp.constants.ts`: Standardized event types and base reward values.
   - `xp.service.ts`:
     - `awardTaskCompletionXp(tx, userId, task)`: awards XP with idempotency key `${taskId}:task_completed:1`.
     - `getUserXpSummary(userId)`: aggregates sum of XP transactions, derives level, returns summary.
     - `getTransactions(userId, limit, offset)`: returns ledger rows.
   - `xp.controller.ts`:
     - `GET /me/xp`: returns user's XP summary and recent ledger transactions.
   - `xp.module.ts`: registered in `AppModule`.

3. `apps/api/src/tasks/tasks.service.ts`:
   - Hook into `logTaskAction`: when `input.action === 'complete'`, invoke `xpService.awardTaskCompletionXp` within the transaction.

4. Tests:
   - `apps/api/src/xp/__tests__/xp.service.spec.ts`:
     - Level progression calculations (level 1 at 0 XP, monotonic increasing thresholds).
     - Awarding XP for task completion.
     - Idempotent deduplication (same task completion does not double-award).
     - Ledger immutability check.
