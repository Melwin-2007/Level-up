# P25: Mobile AI Plan Review

READ: AGENTS.md, docs/PROGRESS.md, docs/DESIGN.md, docs/SPEC.md.

## Goal

Build the mobile "Plan Review" and "AI Assistant" screens for inspecting AI-generated plans, reviewing feasibility summaries, approving plans, or requesting plan regeneration with adjustments.

## Tasks

1. Screen `apps/mobile/app/cycles/[id]/plan.tsx`:
   - Header with cycle title, phase badge (`PLANNING`), and prominent tag "Proposed by AI" on any unapproved plan version.
   - Feasibility Summary card: verdict badge (`FEASIBLE`, `TIGHT`, `INFEASIBLE`), total hours vs available capacity bar, conflict alerts if any.
   - Weekly Breakdown: accordion or list of milestones and tasks grouped by week (Week 1 to Week 4/5).
   - Sticky action footer: "Approve Plan" primary button (triggers `POST /cycles/:id/approve-plan`), "Request Changes" secondary button (opens AI adjustment sheet).
2. AI Assistant Sheet / Tab:
   - Plain-row question and answer layout (no chat-bubble styling, per DESIGN.md and AGENTS.md).
   - "Explain plan" / "Why this pacing?" insights.
   - Regeneration form: multi-line input for adjustments note (e.g. "Shift Week 1 load to Week 2"), "Regenerate Plan" button calling `POST /cycles/:id/generate-plan` with `adjustmentsNote`.
3. Plan approval confirmation and success animation:
   - Sets baseline plan, updates cycle status badge.
   - If cycle advances to `execution`, prompts user to start week 1.
4. Unit and component tests:
   - Screen renders feasibility verdict and weekly milestones.
   - "Proposed by AI" label is visible on unapproved plans and absent once approved.
   - Approve action calls API and invalidates cycle/plan queries.
   - Zero raw hex tokens outside `theme/tokens.ts`.

## Verify

```
pnpm --filter mobile test
pnpm typecheck && pnpm lint
```

## Finish

Tick P25 in `docs/PROGRESS.md`, tag `m2-done`, commit `feat(mobile): ai plan review and approval screens`.
