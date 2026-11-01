# P12: Mobile goal submission and group review

READ: AGENTS.md, docs/API.md (Submissions, Reviews), docs/DECISIONS.md (12, 13, 22), docs/DESIGN.md (all, wireframes), docs/COPY.md.

## Goal
Members write, save and submit goals, lock them, review each other's goals and comment. The finishing flow matches SPEC 7.4.

## Tasks
1. Goal submission screen (`app/cycles/[id]/submission.tsx`):
   - List of goal rows with `PriorityMarks` and hours; add/edit goal in a `Sheet` with fields: title, description, category, priority (five tappable squares), estimated hours, deadline (date picker limited to the cycle month), success criteria (type picker: checklist / metric / binary, with the fields each needs).
   - Availability step: hours per weekday (seven steppers) plus fixed commitments list; max daily hours.
   - Save draft (PATCH/POST with `submit: false`) and Submit goals (`submit: true`), Lock goals with the confirm text from COPY.md. After lock the screen is read-only and says so in one line.
   - Form state kept in a Zustand draft store keyed by cycle id so a crash does not lose typing; cleared after a successful save.
   - Validation via the shared zod schema; inline errors under fields.
2. Group review screen (`app/cycles/[id]/review.tsx`): goals grouped by member, rows per wireframe in DESIGN.md. Tapping a goal expands its detail (description, deadline, success criteria) and comments inline as plain rows (author name, text, relative time). "Add comment" opens a `Sheet`. Own goals are labelled "Yours". Availability and constraints never appear.
3. Owner/admin actions on the review screen: "Create review" (if none) and "Finish review" with the COPY.md confirm. After finishing, comments are read-only with a one-line status.
4. Polling: use `refetchInterval` of 15 s only while the review screen is focused and the review is open.
5. The one orchestrated motion: when the member locks, the member's row in the status list fills left to right in `oxblood` once (respect reduced motion).
6. Error handling: `SUBMISSION_LOCKED`, `CYCLE_STATE_INVALID` and network errors map to COPY.md strings and refresh the cycle query so the UI reflects the real phase.
7. Tests: form-to-payload mapping, `getNextAction` additions, comment list rendering with correct author names.

## Constraints
- The UI never decides what is allowed; it shows what the API returns and handles rejections.
- No chat-bubble styling.

## Verify
Manual: run the full SPEC 7.4 scenario with two devices (or device + emulator) plus a third account.

## Finish
Tick P12, commit `feat(mobile): submission and group review`.
