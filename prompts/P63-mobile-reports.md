# P63: Mobile Reports and Retrospectives Screen

## Goal

Build the mobile monthly report experience for both individual and group retrospective reviews. Displays deterministic metrics computed in P60-P62, expandable calculation explanations showing formula derivations, baseline versus current plan performance tabs, group aggregated reports with privacy isolation, and AI insights with metric citations. All visual charts must be drawn with simple SVG using the fixed dark palette tokens only (`colors`), and every chart must have a text equivalent.

## READ

- `docs/SPEC.md` Section 5 (Success criteria and reports)
- `docs/DESIGN.md` (Design tokens, no hex literals, typography, rows, sheets)
- `docs/DECISIONS.md` Decisions 51, 52, 53

## Scope

1. `apps/mobile/hooks/use-reports.ts`:
   - `useIndividualReport(cycleId)` -> `GET /cycles/:id/reports/me`
   - `useGroupReport(cycleId)` -> `GET /cycles/:id/reports/group`
   - `useRegenerateReportMutation(cycleId)` -> `POST /cycles/:id/reports/me/regenerate`
   - `useUpdateSharingMutation(cycleId)` -> `PUT /cycles/:id/reports/sharing`

2. `apps/mobile/components/reports/`:
   - `metric-card.tsx`: Metric summary card with toggleable calculation details (formula string and inputs) and SVG progress gauge.
   - `plan-comparison-tab.tsx`: Baseline plan vs current plan execution performance comparison with completion ratios and divergence.
   - `group-report-tab.tsx`: Group averages and member summary cards respecting privacy settings.
   - `report-insights-list.tsx`: Evidence-backed AI insights with citation pills pointing to metric IDs.
   - `sharing-sheet.tsx`: Bottom sheet to adjust granular sharing preferences.
   - `regenerate-sheet.tsx`: Bottom sheet requiring regeneration note before regenerating.
   - `index.ts`: Barrel export.

3. `apps/mobile/app/cycles/[id]/report.tsx`:
   - Complete report screen featuring individual/group tab switching, dark design token adherence, and refresh control.
   - Register route in `apps/mobile/app/cycles/_layout.tsx`.

4. Tests:
   - `apps/mobile/components/__tests__/report-screen.test.tsx` testing calculation toggle, group summary privacy rendering, and tab navigation.
   - Run `no-hex-outside-tokens.test.ts` to ensure 0 raw hex literals.
