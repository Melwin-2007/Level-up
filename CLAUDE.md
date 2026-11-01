@AGENTS.md

# Claude Code specifics

- Use plan mode for the first reply of each session, then proceed.
- Prefer editing existing files over creating new ones. Never create files outside the repo map in AGENTS.md without a reason in DECISIONS.md.
- Use sub-agents only for read-only investigation (for example, "find every place that checks cycle status"). Do the edits yourself in the main session.
- When a verification command fails, read the full error before changing code.
- Do not run destructive commands (`prisma migrate reset`, `git reset --hard`, `rm -rf`) without stating what will be lost and getting a yes.
- Keep context small: at ~60% context use, write a handoff into `docs/PROGRESS.md` and suggest starting a new session.
