# Design system

Brief: a monthly accountability app for a small group of friends. Dark only. Palette is fixed by the owner: `#000000`, `#830000`, `#BC0202`, `#FF0000`. It should look made by a person with a point of view, not assembled from a UI kit.

## The idea

A month is a physical thing you fill. The memorable element is the **month strip**: one tall cell per day of the cycle month, each cell a vertical gauge that fills from the bottom as that day's planned work gets done. Everything else is quiet and typographic.

Before Milestone 4 (no tasks yet) the strip shows the month's phases instead: days elapsed, the submission deadline and review deadline as notches, today outlined.

## Colour tokens

| Token | Hex | Use |
| --- | --- | --- |
| `void` | `#000000` | Every screen background. True black, no tinted near-black. |
| `oxblood` | `#830000` | Structure: gauge fill (low), selected-row bar, section underlines, borders that matter, pressed states |
| `signal` | `#BC0202` | Primary buttons, gauge fill (mid), the active tab marker |
| `flare` | `#FF0000` | Today, gauge fill (full), the one number that matters on a screen, errors |
| `ink` | `#F2F2F2` | Primary text |
| `ash` | `#A8A8A8` | Secondary text |
| `rule` | `rgba(255,255,255,0.16)` | Hairline dividers and input borders |
| `wash` | `rgba(255,255,255,0.05)` | Pressed/selected row fill |

Contrast facts (do not break these):
- `ink` and `ash` on `void`: above 8:1. Safe for all text.
- `flare` on `void`: about 5.3:1. Allowed for text of 18px or larger, bold 14px or larger, and icons. Never for small body text.
- `signal` on `void`: about 3.1:1. Never as text. As a fill it carries `ink` text (about 6.7:1).
- `oxblood` on `void`: about 2:1. Never text, never the only thing distinguishing two states. It is a surface and structure colour.
- Never use `flare` as a fill with `ink` text (about 4:1, too low). On `flare` fills use `void` text.

No other hues. No green for success, no amber for warning. State is carried by shape and label, with colour as reinforcement:

| State | Shape | Colour |
| --- | --- | --- |
| Done | solid filled square | `flare` |
| In progress | half-filled square | `signal` |
| Pending | outlined square | `rule` |
| Postponed | square with a diagonal cut | `ash` |
| Error | left bar 3px + sentence | `flare` bar, `ink` text |

Gradients, glow, blur, glass: none. Shadows: none. Depth comes from hairlines and from `wash` fills.

## Typography

Two families, clearly different, both from Google Fonts via `@expo-google-fonts/*` (confirm package names when installing):

- Display: **Archivo Narrow** 600/700. Month names, screen titles, big numerals. Tight tracking (-0.5).
- Text: **Public Sans** 400/500/600. Everything else.

No monospace for labels. Numerals in lists and stats use `fontVariant: ['tabular-nums']`.

Scale (px / line-height): display-xl 64/60, display 40/42, title 26/30, heading 20/26, body 16/24, small 14/20, micro 12/16 (use sparingly, never below 12).

Rules:
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings.
- No single-word colour accents inside a headline.
- Line length under 60 characters in body copy. Left-aligned everywhere; never centre paragraphs.
- Titles say what the screen is for ("November goals"), not the feature name.

## Layout

- Spacing unit 4. Screen padding 20. Row min height 56 (touch target >= 48).
- Left-aligned, single column. A screen has one focal element at most; the rest is rows separated by hairlines.
- Rows, not cards. A bordered panel is used only for the "Today" block and for sheets. Do not wrap every list item in a rounded container.
- Radius is by role, not one value: gauge cells 2, inputs 4, buttons 4, bottom sheets 16 on the top corners only, avatars full circle.
- Bottom tabs: Today, Month, Group, You. Active tab: `flare` 2px bar above the label; inactive label `ash`. No icon-only tabs. Icons are line icons from one set (Phosphor or Lucide), 22px, 1.5 stroke. No emoji anywhere.
- Priority 1 to 5 is five small squares (filled = priority). Not stars, not coloured chips.

```
Month screen
+--------------------------------------+
| November                      (title)|
| 2 of 3 submitted             (ash)   |
|                                      |
| |||||||||||||||||||||||||||||||||    |  <- month strip, 30 gauges
|  1                    ^dl      30    |
|                                      |
| Submission     closes Nov 3, 9:00 pm |
| Review         Nov 4 to Nov 6        |
| Planning       not started           |
| ------------------------------------ |
| [ Add your goals ]            (fill) |
+--------------------------------------+
```

```
Group review (goal rows grouped by person, comments as plain rows)
+--------------------------------------+
| Asha                                 |
| ------------------------------------ |
| Finish DSA course        ■■■■□  40 h |
|   Ravi  Ten hours a week fits.  2d   |
|   Meera  Needs a deadline.      1d   |
|   [ Add comment ]                    |
| ------------------------------------ |
| Ship portfolio site      ■■■□□  25 h |
+--------------------------------------+
```

## Components (build these once in `apps/mobile/components/ui`)

`Screen`, `Title`, `Text` (variants), `Row`, `Divider`, `Button` (primary = signal fill, secondary = rule outline, quiet = text), `Input` (underline-less, 1px `rule` border, focus = `flare` border), `Field` (label above, hint and error below), `Sheet`, `MonthStrip`, `PriorityMarks`, `StatusSquare`, `EmptyState`, `ErrorBar`, `Avatar` (initial in `oxblood` circle, `ink` letter).

Buttons: height 52, label 16/600 sentence case, no trailing arrows, no icons unless the action is not obvious. Pressed = darken to `oxblood`.

## Motion

- No entrance animations on screens or lists. No hover/press scaling.
- Motion that answers an action is fine and must be short (150 to 250 ms): a gauge filling when a task is completed, a sheet rising, a submission locking (the member's strip notch fills).
- One orchestrated moment: when a member locks their submission, their line in the cycle list fills left to right in `oxblood` once.
- Respect reduced-motion: replace with an instant state change.

## Accessibility floor

Contrast rules above; touch targets >= 48; every icon button has an accessibility label; focus order follows reading order; text scales with system font size up to 130% without clipping; state never conveyed by colour alone.

## What makes it look generated (avoid)

Identical rounded cards with soft grey shadows; gradient washes; purple or teal accents; emoji as icons; "Hey there" greetings; stat tiles with a big number, small label and a trend arrow; chat-bubble UI for comments; tracked-out all-caps eyebrows; centred hero text; skeleton shimmer everywhere (use a plain 1px `rule` placeholder row instead).
