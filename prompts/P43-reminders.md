# P43: Reminders and Notifications

READ: AGENTS.md, docs/PROGRESS.md, docs/API.md.

## Goal

Expo push token registration, notification settings, and timezone-aware reminder jobs scheduled via BullMQ.

## Tasks

1. Token & Settings:
   - Endpoint `PUT /me/push-token` with `{ token: string, platform?: 'android' | 'ios' | 'web' }`.
   - Store push token in profile or metadata.
   - User notification preferences: daily summary enabled, reminder time (default 09:00 local time).
2. Reminder Scheduling:
   - Schedule BullMQ jobs targeting member timezone for daily task summaries.
   - Deadline reminder dispatch before submission and review deadlines.
   - Notification content never reveals private goal text on lock screens (use generic copy: "You have 3 tasks scheduled today").
3. Tests:
   - Token registration validation.
   - Reminder scheduling computes correct UTC delay based on user IANA timezone.

## Verify

```
pnpm --filter api test
```

## Finish

Tick P43, commit `feat(reminders): push token registration and scheduled reminder jobs`.
