# P61: Individual Report Generation

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md, docs/API.md.

## Goal

Implement individual monthly report generation in `apps/api`:

1. Calculate metrics via `@mp/scheduler` (`calculateCycleMetrics`).
2. Generate evidence-backed AI insights citing computed metric IDs via `LlmClient`.
3. Reject any insight without metric citations or containing ungrounded causal claims.
4. Persist immutable report in `monthly_reports` table (`report_type = 'individual'`).
5. Enforce single-generation idempotency (never regenerate silently; require explicit regeneration note).
6. Provide `GET /cycles/:id/reports/me` and `POST /cycles/:id/reports/me/regenerate`.

## Tasks

1. In `packages/shared`:
   - Ensure `reportInsightSchema` and `monthlyReportResponseSchema` in `validation/reports.ts` are exported.
   - Add `'report.read'` and `'report.generate'` to `CYCLE_OPERATIONS` in `status.ts`.

2. In `apps/api`:
   - Update `STATE_MATRIX` in `src/cycles/cycle-state.service.ts` to allow reports in `execution` and `completed` phases.
   - Create `src/reports/reports.service.ts`:
     - `generateIndividualReport(cycleId, userId, regenerationNote?)`:
       - Fetch member's goals, tasks, task logs, baseline plan items, and current plan items.
       - Run pure `calculateCycleMetrics` from `@mp/scheduler`.
       - Generate AI insights using `LlmClient` with prompt version `report-insights-v1.0`.
       - Post-validation: ensure every insight cites valid metric IDs (`weighted_achievement`, `task_execution`, `estimate_accuracy`, `consistency`, `plan_comparison`).
       - Store in `monthly_reports` (`report_type: 'individual'`).
     - `getIndividualReport(cycleId, userId)`:
       - Retrieve most recent report for caller.
   - Create `src/reports/reports.controller.ts`:
     - `GET /cycles/:id/reports/me` -> returns `MonthlyReportResponse`.
     - `POST /cycles/:id/reports/me/regenerate` -> accepts `{ note: string }` and creates new report version.
   - Register `ReportsModule` in `app.module.ts`.
   - Update `CycleTransitionsWorker` in `src/jobs/cycle-transitions.worker.ts`:
     - When advancing cycle to `completed`, automatically generate individual reports for all participating members.

3. Unit Tests in `apps/api/src/reports/__tests__/reports.service.spec.ts`:
   - Stored report contains all 5 calculated metrics matching scheduler output.
   - Insights strictly cite metric IDs; insights without citations are rejected.
   - Cannot regenerate silently without explicit note.
   - Non-members receive 404.

## Verify

```
pnpm --filter api test
pnpm lint
pnpm typecheck
```

## Finish

Commit `feat(reports): individual report generation with metric-cited ai insights`.
