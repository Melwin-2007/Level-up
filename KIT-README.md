# Monthly Productivity: solo build kit

This kit lets one person build the whole product with an AI coding agent (Claude Code, Cursor, Codex, etc.) without the agent drifting from your spec.

## 1. Set up the repo (10 minutes)

1. Create the folder `monthly-productivity/` and `git init`.
2. Copy everything from this kit into its root. You get `AGENTS.md`, `CLAUDE.md`, `docs/`, `prompts/`.
3. Save your original specification document as `docs/SPEC.md` (unchanged). It is the source of truth. Everything else in `docs/` interprets or extends it.
4. Commit: `docs: add spec, agent rules and prompt kit`.

## 2. How the files fit together

| File                           | Job                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `AGENTS.md`                    | Rules the agent reads every session. Canonical.                       |
| `CLAUDE.md`                    | Imports `AGENTS.md`; Claude Code specifics.                           |
| `docs/SETUP.md`                | Machine, accounts, Supabase, env files, deploy, EAS, troubleshooting. |
| `docs/SPEC.md`                 | Your original spec. Never edit casually.                              |
| `docs/ARCHITECTURE.md`         | Modules, request flow, auth flow, hosting.                            |
| `docs/DATABASE.md`             | Three-record principle, migrations, triggers, RLS.                    |
| `docs/API.md`                  | Endpoint contract, state matrix, error format.                        |
| `docs/SECURITY.md`             | Authorization rules and checklist.                                    |
| `docs/DESIGN.md`               | Colour, type, layout, components. The non-generic look.               |
| `docs/COPY.md`                 | Voice and exact strings.                                              |
| `docs/TESTING.md`              | What must be tested and how.                                          |
| `docs/CONVENTIONS.md`          | Code style, structure, git.                                           |
| `docs/DECISIONS.md`            | Gaps in the spec, and the answer chosen for each.                     |
| `docs/ROADMAP.md`              | Milestones and definition of done.                                    |
| `docs/PROGRESS.md`             | Agent's handoff notes. Updated at the end of every prompt.            |
| `prompts/00-MASTER-KICKOFF.md` | Paste once in your very first session.                                |
| `prompts/P00 ... P13`          | Milestone 1, one prompt per session.                                  |
| `prompts/UTILITY.md`           | Bugfix, review, audit, resume prompts.                                |
| `prompts/LATER-MILESTONES.md`  | Milestones 2 to 9.                                                    |

## 3. The working loop (one prompt = one session = one branch)

1. Open a fresh agent session (the very first time, paste `prompts/00-MASTER-KICKOFF.md`). Paste the prompt file's contents (or say "Execute prompts/P03-profiles.md").
2. Let it plan, then build. Answer only questions about security or data model.
3. Run the verification commands yourself. Do not trust "done" without them.
4. Run the review prompt from `prompts/UTILITY.md` in a second fresh session.
5. Merge, tick the box in `docs/PROGRESS.md`, start the next prompt.

Rules for yourself:

- Never run two prompts at once.
- Never skip a prompt's verification.
- If the agent gets stuck for more than two attempts, stop, use the bugfix prompt in a clean session.
- The mobile prompts (P09 to P13) come after the backend is passing its tests. This order is deliberate.

## 4. Things only you can do

- Create the Supabase project and copy the keys (P01 walks you through it).
- Install Android Studio or use a physical Android phone with Expo Go / a dev build.
- Create an Expo (EAS) account for the APK build in P13.
- Make the acceptance test (P13) with two real phones or one phone plus one emulator.
