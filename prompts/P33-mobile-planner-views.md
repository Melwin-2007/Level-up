# P33: Mobile Weekly and Daily Planner Views

READ: AGENTS.md, docs/PROGRESS.md, docs/DESIGN.md.

## Goal

Mobile UI for weekly and daily schedule inspection during and after plan review.

## Tasks

1. In `apps/mobile/app/cycles/[id]/plan.tsx` or new calendar view:
   - Expand weekly breakdown to display scheduled daily tasks.
   - Show daily load markers on `MonthStrip`.
2. Tests:
   - Component rendering tests.
   - Design tokens compliance.

## Verify

```
pnpm --filter mobile test
```

## Finish

Tick P33, commit `feat(mobile): weekly and daily planner views with load strip`.
