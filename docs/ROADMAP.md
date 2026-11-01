# Roadmap

One milestone at a time. Do not start the next until the previous one's definition of done is met and tagged in git (`m1-done`, `m2-done`, ...).

| M   | Scope                                                                  | Definition of done                                                                                                                                                      |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auth, groups, cycles, submissions, locking, group review, Android flow | SPEC 7.4 scenario passes on two real devices; all API tests in TESTING.md pass; APK installs                                                                            |
| 2   | AI goal analysis and monthly plan generation                           | Structured plan JSON validated by schema; stored as `plan_versions` (pending); explanation shown; no direct DB access for the model; tests use a mocked LLM             |
| 3   | Scheduling engine (monthly, weekly, daily)                             | Pure function `schedule(input) -> { scheduled, unscheduled, violations }`; all hard constraints from SPEC 4.3 tested; AI plan passes through it before the user sees it |
| 4   | Task tracking, execution logs, reminders, BullMQ                       | Tasks derive from the approved baseline; logs append-only; notifications fire; automatic cycle transitions run                                                          |
| 5   | Mid-month reoptimization and version history                           | New version created, baseline untouched, completed work untouched, diff explanation shown, approval required                                                            |
| 6   | Individual reports and group summary                                   | Numbers reproduced by a pure calculator; baseline and current-plan performance both shown; group report respects sharing settings                                       |
| 7   | XP, levels, streaks, achievements                                      | Backend-only awards, idempotent ledger, no client authority                                                                                                             |
| 8   | Offline sync                                                           | SQLite + outbox + idempotency keys; conflict policy documented first                                                                                                    |
| 9   | Advanced analytics                                                     | Month-over-month only after M6 data exists                                                                                                                              |

Rules for the solo developer:

- Ship Android to yourself and two friends at the end of M1, M4 and M6. Real use beats more planning.
- Keep a `docs/PROGRESS.md` checklist; tick items only after verification commands pass.
