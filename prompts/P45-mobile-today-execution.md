# P45: Mobile Today and Daily Execution

READ: AGENTS.md, docs/PROGRESS.md, docs/DESIGN.md.

## Goal

Mobile "Today" tab becomes the daily planner with task list, timer, status updates, postpone dialog with reason, and MonthStrip completion fill.

## Tasks

1. In `apps/mobile/app/(tabs)/index.tsx`:
   - Display today's date and scheduled tasks for today.
   - Status indicators: pending (outlined square), in_progress (half-filled square), completed (solid flare square), postponed (ash square with diagonal cut).
   - Task action sheet / controls: Start timer, Pause, Complete (with optional duration and note), Postpone to another date.
   - MonthStrip at the top of the Today tab reflects daily completion ratio.
2. Hook `useTasks`:
   - Fetch today's tasks via `GET /tasks?date=...`.
   - Mutation `useLogTaskActionMutation` calling `POST /tasks/:id/log`.
3. Tests:
   - Component rendering test for Today task list.
   - Status toggling and completion interactions.
   - Design tokens compliance (zero raw hex outside `theme/tokens.ts`).

## Verify

```
pnpm --filter mobile test
```

## Finish

Tick P45, commit `feat(mobile): today daily execution view with tasks and timer`.
