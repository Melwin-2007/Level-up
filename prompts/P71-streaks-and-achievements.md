# P71: Streaks, Achievements, and Mobile You Tab

## Goal

Implement pure streak calculations, achievement evaluations with idempotent XP awards, and the gamification section on the mobile "You" tab. Streaks and achievements are derived purely from immutable actuals (`task_logs`, `tasks`, and cycle history). Each newly unlocked achievement awards an immutable `xp_transactions` ledger entry (`idempotency_key = achievement:id:1`). Mobile displays level, streak, and achievements on the "You" tab, styled small and secondary per DESIGN.md.

## READ

- `docs/DATABASE.md` (Actuals: tasks, task_logs, xp_transactions append-only)
- `docs/DESIGN.md` (Design tokens, no hex literals, typography, rows, secondary elements)
- `docs/DECISIONS.md` Decision 55

## Scope

1. `packages/shared/src/gamification/`:
   - `streaks.ts`: Pure function `calculateStreak(completedDates: string[], todayDateStr: string)` determining current and longest streaks.
   - `achievements.ts`: Achievement definitions, criteria evaluators, and Zod schemas (`gamificationOverviewSchema`, `achievementItemSchema`, `streakDataSchema`).

2. `apps/api/src/xp/`:
   - `achievements.service.ts`: Queries user's completed tasks and dates in their IANA timezone, evaluates achievements, awards ledger entries for newly unlocked achievements (`idempotency_key = achievement:${id}:1`), and returns summary.
   - `xp.controller.ts`: Add `GET /me/gamification`.
   - `xp.module.ts`: Register `AchievementsService`.

3. `apps/mobile/`:
   - `hooks/use-gamification.ts`: Hook for `GET /me/gamification`.
   - `app/(tabs)/you.tsx`: Expand "You" tab to display Level with XP progress bar, current execution streak, and secondary achievements list under dark design tokens.

4. Tests:
   - Unit tests for streak calculations (gaps, consecutive days, leap days).
   - Unit tests for achievement evaluator and idempotent ledger awards.
   - Mobile tests for You tab rendering and dark token compliance (`no-hex-outside-tokens.test.ts`).
