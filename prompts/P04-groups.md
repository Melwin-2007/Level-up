# P04: Groups, membership and invite codes

READ: AGENTS.md, docs/API.md (Groups), docs/SECURITY.md, docs/DECISIONS.md (17, 20, 23), docs/TESTING.md (item 3).

## Goal
Users can create a private group, share an invite code, and join. Non-members cannot learn anything about a group.

## Tasks
1. `groups` module: `POST /groups`, `GET /groups`, `GET /groups/:id`, `POST /groups/join`.
2. Invite code generator in `common` using `crypto.randomInt` and the 8-char alphabet from DECISIONS 23; retry on unique collision (max 5).
3. Creation runs in one transaction: group row + owner membership.
4. Join: look up by code (case-insensitive, trimmed), reject if already a member (409 `ALREADY_MEMBER`) or group is at 12 members (409 `GROUP_FULL`). Throttle 5 per minute per user. Use the same generic 404-style error for unknown codes ("That code does not match a group").
5. `GroupMemberGuard` and `GroupAdminGuard`: load membership by (groupId, userId) from the DB; if missing return 404 `NOT_FOUND`. Export a `GroupsService.requireMembership(groupId, userId)` for other modules.
6. `GET /groups/:id` response mapper: group name, members `{ userId, displayName, role }`, `inviteCode` only for owner/admin.
7. Tests: TESTING.md item 3 in full (two users join the same group, cap enforced via a lowered cap in test config, non-member 404, invite code visibility).

## Constraints
- Responses use explicit mappers.
- No endpoints for removing members or rotating codes (see DECISIONS open questions).

## Verify
```
pnpm --filter api test:e2e -- groups
```

## Finish
Tick P04, commit `feat(groups): create, join, membership guards`.
