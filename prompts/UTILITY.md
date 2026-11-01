# Utility prompts

## U1: Resume after a break or a new session
Read AGENTS.md and docs/PROGRESS.md. Run `git status`, `git log --oneline -10`, `pnpm typecheck`, and the tests for the module named in PROGRESS "Current prompt". Report in 8 lines: what is done, what is half-done, what is failing. Do not change anything yet.

## U2: Independent review (run in a FRESH session after each prompt)
You are a skeptical reviewer, not the author. Review the diff of the current branch against `main`.
1. Check every rule in AGENTS.md "Non-negotiable rules" against the diff. List violations with file and line.
2. Check each route/function touched against the docs/SECURITY.md endpoint checklist.
3. Look for: user id taken from input, raw Prisma rows returned, missing cycle-state check, missing transaction around multi-step writes, untested branches, secrets or personal data in logs, `any`, hex colours outside tokens (mobile).
4. Run lint, typecheck, tests. Report failures.
Output: a table `severity | file:line | problem | suggested fix`. Do not edit code. If nothing is wrong, say what you checked.

## U3: Bugfix (clean session)
Bug: <describe what you did, what you expected, what happened, include error text>.
1. Read AGENTS.md and only the files relevant to the bug.
2. Write a failing test that reproduces it. Show the failure.
3. Find the root cause (explain in 3 lines). Fix the cause, not the symptom.
4. Run the full test suite. Add a line to docs/PROGRESS.md under Known issues if anything remains.

## U4: Security audit (before each release)
Audit the whole API against docs/SECURITY.md. For each route: identity source, scoping query, cycle-state check, response mapper, test that proves non-member and wrong-role denial. Flag any route that lacks one. Also check CORS, helmet, throttling, env validation, log contents, and that `.env*` files are not tracked (`git ls-files | grep env`). Report only; propose fixes as a list.

## U5: Design review (after any UI work)
Open every screen you touched on the Android emulator or request screenshots. Compare against docs/DESIGN.md.
1. List any use of: shadows, gradients, emoji, identical rounded cards, centred paragraphs, all-caps labels, trailing arrows, monospace labels, colours not in tokens.
2. Check contrast rules: no `flare` small text, no `signal` or `oxblood` text.
3. Check touch targets, font scale 130%, screen reader labels.
4. Propose the smallest changes that fix each problem, then apply them.

## U6: Spec drift check
Compare docs/SPEC.md with the current code and docs/DECISIONS.md. List every place where behaviour differs and whether it is recorded as a decision. Do not change SPEC.md.

## U7: Refactor guard
Refactor <module> for clarity only. Behaviour must not change. First run the tests and record the result. Make changes in steps of under 100 lines. Run the tests after each step. Stop if any test needs modification.

## U8: Write the migration safely
Add <change>. Use `prisma migrate dev --create-only`, show me the generated SQL, check that it will not drop or rewrite data, add any trigger/constraint SQL by hand, apply on `mp-test` first, run the e2e suite, then apply on `mp-dev`. Never touch prod.
