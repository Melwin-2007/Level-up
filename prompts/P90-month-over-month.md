# P90: Month-over-Month Advanced Analytics

## Goal

Implement multi-cycle month-over-month advanced analytics derived strictly from historical, immutable `monthly_reports` rows. When a member has at least 2 completed cycles, compute longitudinal trends: estimation accuracy progression, consistency & active-day trends, priority-weighted achievement rates, and goal category success breakdowns. Expose via `GET /me/analytics/trends` and render trends on mobile under dark design tokens.

## READ

- `docs/DATABASE.md` (Three-record principle: reports are immutable actuals, never recomputed from mutable state)
- `docs/SPEC.md` (Sections 5 & 6)
- `docs/DECISIONS.md` (Decisions 51, 52, 54)

## Scope

1. `packages/shared/`:
   - `analytics/trends.ts`: Pure function `calculateMonthOverMonthTrends(cycleReports: StoredCycleReportSummary[])`.
   - `analytics/schemas.ts`: Zod schemas for `MonthOverMonthResponse`, `MetricTrendItem`, `CategorySuccessRate`.
   - Export in `packages/shared/src/index.ts`.

2. `apps/api/src/analytics/`:
   - `analytics.service.ts`: Queries completed individual `monthly_reports` for user. If < 2 completed cycles, returns `{ status: 'insufficient_data', completedCyclesCount, requiredCyclesCount: 2 }`. If >= 2, computes trends and optional evidence-backed AI observations citing trend metric keys.
   - `analytics.controller.ts`: `GET /me/analytics/trends` behind `JwtAuthGuard`.
   - `analytics.module.ts`: Wire into API.
   - Tests: Unit tests for trends calculation (2 cycles, 3 cycles, 1 cycle edge case).

3. `apps/mobile/`:
   - `hooks/use-analytics.ts`: React Query hook for `GET /me/analytics/trends`.
   - `components/analytics/trends-card.tsx` or section on `app/(tabs)/you.tsx` displaying trends (accuracy, achievement, consistency, categories) with SVG mini-gauges and dark design tokens.
   - Tests: Mobile unit tests and token guard verification (`no-hex-outside-tokens.test.ts`).
