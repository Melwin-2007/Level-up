# Decisions

Agents: if something is not covered here, take the simplest option, append a new numbered entry, continue.

## Stack choices

1. Package manager: pnpm workspaces. `.npmrc` contains `node-linker=hoisted` so React Native/Metro resolves packages inside the monorepo.
2. Mobile UI: NativeWind v4 with our own components (not React Native Paper). Paper gives a Material look, which conflicts with DESIGN.md.
3. Mobile server state: TanStack Query. Client state: Zustand (session, UI, form drafts only).
4. Validation: zod, schemas in `packages/shared`, used by API pipe and mobile forms.
5. JWT verification: `jose`. JWKS or HS256 secret depending on the Supabase project; fail closed.
6. API tests: Jest + Supertest. Mobile tests: Jest + React Native Testing Library.
7. Rate limiting: `@nestjs/throttler`.
8. Icons: Phosphor (`phosphor-react-native`) or Lucide, one set only.
9. Fonts: Archivo Narrow (display) + Public Sans (text).
10. Environments: Supabase `dev`, `test`, `prod`. Solo developer uses cloud projects, not local Docker, unless Docker is already comfortable.

## Gaps in the spec, and the answers

11. Prisma bypasses RLS because the API connects as a privileged role. API authorization is the primary control. RLS is defence in depth for any direct client access. The mobile app never reads tables directly.
12. Submission lifecycle: `draft` (editable) to `submitted` (still editable while cycle is `submission_open`) to `locked` (frozen). A member can lock their own submitted submission. Finishing the group review locks all remaining submitted ones. Revisions after lock are not implemented in M1; the API returns `SUBMISSION_LOCKED`. A revision workflow (new submission version) is a later decision, not an in-place edit.
13. Visibility during review (spec invariant 4 was undefined): from `group_review` onward, members see other members' goal fields (title, description, category, priority, estimated hours, deadline, success criteria, dependencies) for `submitted`/`locked` submissions. They never see availability, constraints or drafts.
14. Extra endpoints added: `PUT/GET /me`, `GET /groups`, `GET /cycles/:id/submission`, `GET /cycles/:id/submissions`, `GET /cycles/:id/review`, `GET /reviews/:id/comments`, `POST /cycles/:id/advance`, `POST /reviews/:id/complete`. Needed for the acceptance test.
15. One review per cycle: `UNIQUE (group_reviews.cycle_id)`.
16. Added columns: `monthly_submissions.locked_at`, `submission_goals.position`.
17. Group member cap: 12.
18. Profile creation: explicit `PUT /me` during onboarding (no DB trigger on `auth.users`). All other routes return 403 `PROFILE_REQUIRED` until it exists.
19. Cycle transitions in M1 are manual (`advance`) with the conditions in API.md. Automatic deadline transitions arrive with BullMQ in M4.
20. Non-members always receive 404, not 403, for group-scoped resources.
21. Statuses are lowercase strings in the database and TypeScript; SPEC diagram's uppercase is display only.
22. A member can comment on their own goals (self-notes are allowed). Review comments are immutable in M1 (no edit/delete).
23. Invite code format: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
24. Redis/BullMQ is not provisioned until M4; Milestone 1 has no background jobs.
25. `profiles.id` stores `auth.users.id` directly as UUID but does not define a cross-schema foreign key constraint in Postgres, preventing Prisma P4002/P3006 multi-schema migration conflicts with Supabase's managed `auth` schema.
26. Remote PgBouncer connections: use single-query nested creates (e.g. creating group + initial owner member, creating submission + goals) to avoid transaction timeouts over high-latency connections. Multi-statement interactive transactions specify `{ maxWait: 15000, timeout: 30000 }`.
27. Added `@nestjs/swagger` in `apps/api` (non-production only) per P08 Task 5 to generate and inspect OpenAPI specifications (`apps/api/openapi.json`).
28. Mobile design system: All hex colors reside strictly in `apps/mobile/theme/tokens.ts`. Tailwind configuration dynamically loads tokens via `load-tokens.cjs` to enforce single-source-of-truth. Enforced by automated test `apps/mobile/theme/__tests__/no-hex-outside-tokens.test.ts`.
29. Mobile MonthStrip cell sizing: On standard 360dp-wide screens (320dp container), cells are computed dynamically (8dp wide with 2dp gaps for 31 days) fitting cleanly without horizontal scrolling (`requiresScroll = false`). Horizontal scrolling is enabled only if cells would be under 8dp.
30. Mobile session storage: Session persistence uses an encrypted-AsyncStorage pattern with `aes-js` (CTR mode with counter). A 256-bit AES key is generated and stored in Expo SecureStore (bypassing the 2048-byte Android SecureStore limit), while the encrypted ciphertext is stored in AsyncStorage.
31. Web preview support: For visual inspection in web browsers, `react-native-web` and `@expo/metro-runtime` are supported. Metro resolver handles `.js` extensions on relative imports in monorepo packages (`@mp/shared`) during bundling. Static export (`expo export --platform web`) is served via local HTTP server for testing.
32. AI provider selection: `LlmClient` interface abstracts LLM calls. In testing and offline dev, `FakeLlmClient` provides deterministic fixtures. When `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`, API keys (`AI_API_KEY`) and models (`AI_MODEL`) exist only on the server, never exposed in client bundles or logged.
33. Excluded members in planning: Only members with `locked` submissions have plan versions generated during `planning`. Members with `draft` or `none` submission status are excluded from automated planning and do not block cycle progression.
34. Plan versioning & rate limits: Plan generation starts at version 1 (`initial`). Plan regenerations with feedback notes increment `version_number` with a hard limit of 3 generations per cycle per member. Earlier unapproved versions remain immutable for auditability.
35. Baseline plan immutability: First approval of a plan version atomically sets `is_baseline = true` and `approval_status = 'approved'`. Once baseline, the plan snapshot is immutable.
36. AI plan review UI: Follows DESIGN.md strictly (no chat bubbles). Plain row structure for questions and answers with high-contrast badge "Proposed by AI" on all unapproved plans.
37. Pure Scheduler package (`packages/scheduler`): A standalone, pure TypeScript library (`@mp/scheduler`) with no dependencies on NestJS or database ORMs. Solves task assignment over available slots with greedy Earliest Deadline First (EDF) + priority weights, hard constraint guarantees (no overlap, deadline satisfaction, dependency ordering, daily capacity), and full accounting of unscheduled tasks with explicit trade-off explanations. Verified with property-based testing via `fast-check`.
38. Timezone and calendar calculation (`packages/scheduler/src/calendar.ts`): Pure functions for month duration with leap-year support, local day-of-week mapping in IANA timezones, dated exception overrides, bidirectional local slot to UTC conversion, and day length detection across DST transitions (23h spring forward, 25h fall back) with capacity clamping.
39. Pipeline scheduler integration (`PlansService.generatePlan`): Chunks milestones into sequential daily tasks, schedules against member availability using `@mp/scheduler`, maps tradeoffs/conflicts to plan snapshot feasibility, and transactionally persists both milestone and daily task `plan_items`.
40. Mobile Weekly & Daily Planner Views: Integrates `MonthStrip` daily scheduled load gauges and active load markers, and expands weekly cards to show scheduled daily tasks with date badges, duration formatting, and zero hex literals outside `theme/tokens.ts`.
41. BullMQ & Redis infrastructure (`src/jobs/`): Redis connection uses `REDIS_URL` when provided. When `REDIS_URL` is omitted or in test environments, `JobsService` provides an in-memory queue provider supporting job addition, delayed jobs, and worker registration without requiring an external Redis daemon or Lua engine. Queues: `cycles` (for transition jobs) and `reminders` (for notification jobs). Non-production route `GET /admin/queues` reports real-time queue statuses behind `JwtAuthGuard`.

## Open questions for the owner (answer when convenient)

- Should owners be able to remove members or rotate invite codes in M1? (Default: not in M1.)
- Should a member who did not submit by review time be excluded from planning automatically? (Default: yes, recorded as `draft`.)
