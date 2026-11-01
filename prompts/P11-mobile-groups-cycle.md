# P11: Mobile groups and monthly cycle overview

READ: AGENTS.md, docs/API.md (Groups, Cycles), docs/DESIGN.md (Layout wireframes, Motion), docs/COPY.md, docs/CONVENTIONS.md.

## Goal
Create or join a group, share the invite code, start a monthly cycle, and see the cycle overview with the month strip.

## Tasks
1. Hooks in `hooks/`: `useGroups`, `useGroup(id)`, `useCreateGroup`, `useJoinGroup`, `useCurrentCycle(groupId)`, `useCycle(id)`, `useCreateCycle`, `useAdvanceCycle`, using TanStack Query with the key scheme in CONVENTIONS.md and invalidation after mutations.
2. Tabs: Today (placeholder that shows the next required action based on cycle phase), Month, Group, You.
3. Group tab: empty state per COPY.md; list of my groups; create group sheet; join with code (uppercase transform, 8-character input, paste friendly). Group detail: member rows with `Avatar`, role as plain text; owner/admin see the invite code with a Share action using the native share sheet.
4. Month tab: title is the month name; subline "2 of 3 submitted"; `MonthStrip` with deadline markers; phase rows (Submitting goals / Group review / Planning) with dates in the member's timezone; one primary action that changes with the phase ("Add your goals", "Review goals", etc.). Owner/admin see "Start November" when no cycle exists and "Move to group review" when allowed (with the confirm sheet from COPY.md).
5. Member status list per cycle: name plus `StatusSquare` and a word (Not started, Draft, Submitted, Locked). No goal content.
6. Pull to refresh on both tabs. Loading uses a plain 1px `rule` placeholder row, not shimmer. Error state uses `ErrorBar` with a Retry button.
7. Date formatting helpers in `services/dates.ts` using the profile timezone (Intl). Unit-tested.

## Constraints
- No local copy of server data in Zustand.
- Screens contain no business rules; phase-dependent buttons come from a pure `getNextAction(cycle, role, mySubmissionStatus)` function that is unit tested for every phase.

## Verify
Manual on a device with two accounts: A creates a group, B joins with the code, A starts the cycle, both see it. Test with font scale 130%.

## Finish
Tick P11, commit `feat(mobile): groups and cycle overview`.
