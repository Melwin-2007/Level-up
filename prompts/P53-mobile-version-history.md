# P53: Mobile Version History

READ: AGENTS.md, docs/PROGRESS.md, docs/DESIGN.md, docs/DECISIONS.md.

## Goal

Mobile UI in `apps/mobile`:
Version history screen / sheet showing plan versions, plain diff view (what moved, what was added/removed, why), and action to approve reoptimized plan or discard.

## Tasks

1. In `apps/mobile`:
   - Add plan version history navigation and hook (`usePlanVersions`).
   - Plain diff component: shows added tasks (+), removed tasks (-), rescheduled tasks (date $\to$ date).
   - Follow DESIGN.md: dark tokens only, zero hex literals outside `theme/tokens.ts`.
   - Reoptimization trigger sheet from Today or Month view when tasks have slipped.
2. Unit tests in `apps/mobile`:
   - Renders plan version history and diff rows.
   - Triggers approval / discard mutations.

## Verify

```
pnpm --filter mobile test
```

## Finish

Tick P53, commit `feat(mobile): plan version history and reoptimization diff view`.
