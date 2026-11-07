# P31: Timezone and Calendar Handling

READ: AGENTS.md, docs/PROGRESS.md, docs/DECISIONS.md.

## Goal

Compute the member's available minutes per local date for the cycle month, handling month length, weekdays, dated exceptions, and DST transitions.

## Tasks

1. Create availability calendar calculator in `@mp/scheduler` (or `@mp/shared`):
   - Given cycle year, month, member timezone (IANA string), weekly availability rule, and dated exceptions:
   - Generate DayAvailability for every day in the cycle month (28-31 days).
   - Correctly map local dates `YYYY-MM-DD` and day of week.
   - Subtract dated exceptions (full days off, modified hours).
2. Tests:
   - Non-DST zone: `Asia/Kolkata`.
   - DST zones: `America/New_York`, `Europe/London` across transitions.
   - Leap year handling for February (e.g. 2028).

## Verify

```
pnpm --filter @mp/scheduler test
```

## Finish

Tick P31, commit `feat(scheduler): calendar and timezone availability calculator`.
