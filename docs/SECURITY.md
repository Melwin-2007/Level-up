# Security rules

## Authorization matrix (Milestone 1)

| Resource | Who | Condition |
| --- | --- | --- |
| Own profile | self | always |
| Group + member list | members | membership row exists |
| Invite code | owner, admin | membership role |
| Create cycle / advance / create review / complete review | owner, admin | role |
| Own submission (all fields) | self | always |
| Others' submitted goals | any member | cycle >= `group_review`, submission `submitted`/`locked`, never availability/constraints |
| Others' drafts | nobody | never |
| Review comments | members | same group |
| Comment authorship | author id from JWT | never from body |

Non-members receive 404 for any group, cycle, submission or review id.

## Checklist for every new endpoint

1. Identity from JWT only.
2. Resource loaded by id AND scoped through the caller (membership or ownership) in the same query where possible.
3. Cycle state checked via `CycleStateService`.
4. Zod validation including UUID path params and max lengths (title 120, description 2000, comment 1000, goals per submission 25).
5. A test proves a non-member and a different member are denied.
6. Response contains only fields the caller may see (explicit response mappers; never return raw Prisma rows).

## Operational rules

- Rate limit: `POST /groups/join` (5 per minute per user), all writes (60 per minute per user). Use `@nestjs/throttler`.
- Invite codes: 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, generated with `crypto.randomInt`. Regenerate on collision. Owner can rotate (later).
- Helmet, CORS limited to what the mobile app needs, body size limit 100 kB.
- Logs: request id, user id, route, status, duration. Never tokens, passwords, goal text, or comment text.
- Environment validated at boot with zod; the API refuses to start with missing config.
- Secrets live in env only. `.env*` in `.gitignore` from the first commit. Commit `.env.example` with names and no values.
- Supabase `service_role` key never goes into the mobile app. The mobile app has only the project URL and anon key.
- Dependencies: pin via lockfile; run `pnpm audit` before each release.
