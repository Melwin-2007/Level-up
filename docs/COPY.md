# Copy and voice

Plain verbs, sentence case, no filler, no exclamation marks, no emoji. Name things by what the user does, not by how the system works. An action keeps the same name across button, toast and history ("Lock goals" > "Goals locked").

## Vocabulary

| Use | Not |
| --- | --- |
| Group | Squad, team |
| Cycle (shown as the month name: "November") | Sprint, round |
| Goals | Objectives, OKRs |
| Lock goals | Finalize, submit forever |
| Comment | Feedback item |
| Invite code | Join token |

## Key strings

| Where | Text |
| --- | --- |
| Empty: no groups | Create a group or join one with an invite code. |
| Empty: no cycle | Nobody has started a cycle for this month. Owners and admins can start one. |
| Empty: no goals | Add the goals you want to finish this month. Include how many hours each needs. |
| Button: new cycle | Start November |
| Button: save draft | Save draft |
| Button: submit | Submit goals |
| Button: lock | Lock goals |
| Confirm lock | Locked goals cannot be edited. Your group will see them for review. |
| Button: comment | Add comment |
| Button: finish review | Finish review |
| Confirm finish review | This locks every submitted goal. Members who have not submitted keep a draft and are left out. |
| Join field label | Invite code |
| Join error: bad code | That code does not match a group. Check it and try again. |
| Join error: full | This group is full. Ask the owner to make room. |
| Locked error | This submission is locked and cannot be edited. |
| Wrong phase error | This step is closed. The cycle is now in {phase}. |
| Network error | Could not reach the server. Check your connection and try again. |
| Session expired | Your session ended. Sign in again. |
| Validation: title | Give the goal a title (up to 120 characters). |
| Validation: hours | Enter hours as a number, for example 12 or 7.5. |

## Errors

State what happened and what to do next. Do not apologise, do not blame the user, do not use "oops" or "something went wrong". Error codes map to strings in `packages/shared/errors.ts`; mobile never prints server `message` verbatim unless it is a known code.

## Phase names shown to users

submission_open = "Submitting goals", group_review = "Group review", planning = "Planning", execution = "In progress", completed = "Finished", cancelled = "Cancelled".
