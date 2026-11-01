# P09: Mobile scaffold and design system

READ: AGENTS.md, docs/DESIGN.md (all), docs/COPY.md, docs/CONVENTIONS.md (Mobile state), docs/DECISIONS.md (1 to 9).

## Goal

A running Expo app with the full design system and a hidden "kit" screen that shows every component in every state. No data, no auth yet.

## Tasks

1. Scaffold `apps/mobile` with the latest stable Expo SDK (`npx create-expo-app@latest`, TypeScript, Expo Router). Make it work inside the pnpm workspace (Metro resolves `@mp/shared`). Android is the target; do not configure iOS.
2. Install: NativeWind v4 + Tailwind, `@tanstack/react-query`, `zustand`, `expo-font`, `@expo-google-fonts/archivo-narrow`, `@expo-google-fonts/public-sans`, one icon set, `react-native-reanimated` (already bundled by Expo), `expo-secure-store`, `@react-native-async-storage/async-storage`. Use `npx expo install` for Expo-compatible versions.
3. `theme/tokens.ts` and `tailwind.config.js` exposing exactly the tokens in DESIGN.md (`void`, `oxblood`, `signal`, `flare`, `ink`, `ash`, `rule`, `wash`), type scale, spacing unit 4, radius-by-role. Force dark: set background `#000000` at app, navigation theme and status bar level (no white flash on startup; configure splash background `#000000`).
4. Load fonts before rendering; keep the splash visible until ready.
5. Build `components/ui`: `Screen`, `Text` (variants from the scale), `Title`, `Row`, `Divider`, `Button` (primary/secondary/quiet, loading, disabled), `Input`, `Field`, `Sheet`, `MonthStrip`, `PriorityMarks`, `StatusSquare`, `EmptyState`, `ErrorBar`, `Avatar`. Follow DESIGN.md precisely: no shadows, no gradients, no emoji, sentence case, no trailing arrows.
6. `MonthStrip`: props `{ year, month, today, markers: [{ day, label }], fills?: Record<day, 0..1> }`. Each day is a vertical gauge cell (radius 2). Fill rises from the bottom; colour tier by ratio (`oxblood` below 0.5, `signal` 0.5 to under 1, `flare` at 1); today has a 2px `flare` outline; marker notches shown under the cell with a short label. Layout must work for 28 to 31 days on a 360dp-wide screen (compute cell width, allow a horizontal scroll only if cells would be under 8dp).
7. Dev-only route `app/kit.tsx` rendering all components and states (also with font scale 1.3 simulation notes). Not linked from production navigation.
8. `jest-expo` tests for `MonthStrip` layout math and `Button` states.
9. Accessibility: labels on all pressables, 48dp minimum targets, reduced-motion respected (`useReducedMotion`).

## Constraints

- No component library (no Paper, no Tamagui, no Gluestack).
- Do not copy generic template styling; the Expo default tabs template is deleted.
- All colours must come from tokens; a lint rule or a grep test fails the build if hex literals appear outside `theme/tokens.ts`.

## Verify

```
pnpm --filter mobile typecheck && pnpm --filter mobile test
pnpm --filter mobile android      # open the kit screen, inspect each component
```

Take screenshots of the kit screen and review them against docs/DESIGN.md "What makes it look generated". Remove anything that matches.

## Finish

Tick P09, commit `feat(mobile): scaffold and design system`.
