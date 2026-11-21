# P62: Group Report

READ: AGENTS.md, docs/PROGRESS.md, docs/DATABASE.md, docs/DECISIONS.md, docs/API.md.

## Goal

Implement privacy-preserving aggregated group report generation and retrieval in `apps/api`:

1. Aggregate group-level productivity statistics (average achievement rate, total completed tasks, consistency).
2. Respect each member's granular `sharingSettings` (`shareAchievementRate`, `shareCompletedTasksCount`, `shareConsistencyScore`, `shareGoalTitles`).
3. Guarantee that private fields (goals, unshared metrics, availability) never leak into the group report for any sharing setting combination.
4. Enforce database invariant: `report_type = 'group'` has `user_id = null`.
5. Provide endpoints `GET /cycles/:id/reports/group` and `PUT /cycles/:id/reports/sharing`.

## Tasks

1. In `packages/shared/src/validation/reports.ts`:
   - Add Zod schemas:
     - `GroupMemberReportSummary`: userId, displayName, achievementRate (nullable), tasksCompleted (nullable), consistencyRate (nullable), goalTitles (string[]).
     - `GroupReportMetrics`: totalMembers, participatingMembers, averageAchievementRate, totalCompletedTasks, averageConsistency, memberSummaries: GroupMemberReportSummary[].
     - `GroupReportResponse`: id, cycleId, reportType ('group'), metrics: GroupReportMetrics, createdAt.
   - Export schemas and types.

2. In `apps/api/src/reports/`:
   - Add methods to `ReportsService`:
     - `getGroupReport(cycleId: string, callerUserId: string): Promise<GroupReportResponse>`:
       - Validate caller membership in cycle's group.
       - Assert allowed operation `report.read`.
       - Query all individual reports for this cycle, joining member profiles.
       - Filter and aggregate values according to each member's individual `sharingSettings`.
       - Upsert / persist in `monthly_reports` with `reportType: 'group'`, `userId: null`.
       - Return `GroupReportResponse`.
     - `updateSharingSettings(cycleId: string, userId: string, settings: MemberSharingSettings): Promise<MemberSharingSettings>`:
       - Update `sharing_settings` in caller's individual `monthly_reports` row.
   - Add routes in `ReportsController`:
     - `GET /cycles/:id/reports/group` -> `{ report: GroupReportResponse }`
     - `PUT /cycles/:id/reports/sharing` -> `{ sharingSettings: MemberSharingSettings }`

3. Unit Tests in `apps/api/src/reports/__tests__/group-report.spec.ts`:
   - Aggregates metrics accurately across multiple members.
   - Respects `shareGoalTitles: false`: goal titles array is empty for that member.
   - Respects `shareAchievementRate: false`: member's achievement rate is null and excluded from public average.
   - Respects `shareCompletedTasksCount: false`: member's completed tasks is null.
   - Enforces `user_id = null` on group report rows in database.
   - Non-members receive 404.

## Verify

```
pnpm --filter api test
pnpm lint
pnpm typecheck
```

## Finish

Commit `feat(reports): group aggregated reports with granular privacy sharing controls`.
