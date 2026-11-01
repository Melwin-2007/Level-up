# P13: Milestone 1 acceptance and Android build

READ: AGENTS.md, docs/SPEC.md (7.4), docs/TESTING.md (Mobile tests), docs/DESIGN.md (Accessibility floor).

## Goal

Milestone 1 is demonstrably complete and installable.

## Tasks

1. Write `docs/ACCEPTANCE-M1.md`: the SPEC 7.4 scenario as a numbered checklist with the exact steps, expected result, and a blank "result / date" column.
2. Configure EAS: `eas.json` with `preview` (APK, internal) and `production` profiles. App name, package id, icon and adaptive icon using the palette (a black field with a single `flare` glyph; no gradient), splash `#000000`.
3. Production environment variables via EAS secrets (`EXPO_PUBLIC_*` only; remember these are public). Point the preview build at the deployed API.
4. Run `eas build --platform android --profile preview`. Install on a real phone.
5. Execute the checklist with three accounts, record results in ACCEPTANCE-M1.md.
6. Fix every failure found, each with a test first when it is logic.
7. Visual pass: screenshot every screen; compare against docs/DESIGN.md. Remove anything generic. Check contrast rules (no `flare` small text, no `signal` text, no `oxblood` text).
8. Privacy pass: confirm with two accounts that member B can never see member A's availability, constraints or drafts, by inspecting actual API responses.
9. Tag `m1-done`. Write the M2 starting notes in PROGRESS.md (open questions from DECISIONS.md that need answers).

## Verify

All items in ACCEPTANCE-M1.md pass on a physical device. `pnpm test` and `pnpm --filter api test:e2e` green.

## Finish

Tick P13. Do not begin Milestone 2 in this session.
