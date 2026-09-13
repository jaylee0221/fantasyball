---
name: fantasyball
version: 1.0
audience: agents editing beatball.html (repo root); read before any UI change
colors:
  bg: "#0E1013"       # page
  panel: "#16191E"    # panels, court floor, sheets
  panel2: "#1D2127"   # bar tracks, inactive tiles
  line: "#2A2F36"     # court lines, dividers
  ink: "#F5F6F7"      # text, primary button fill, active tab underline
  muted: "#8A9099"    # secondary text, labels, the opponent in charts
  hot: "#FF5A1F"      # flat orange — ONLY on a stat/line you lead, and the "now" tile
fonts:
  display: "Archivo Narrow"   # 600 default, 700 only for the record numeral
  body: "Archivo"             # 400 / 500 / 600
tracking:
  display_caps: 0.08em        # tabs, section labels, CTA
  wordmark: 0.18em
weights_max: 700
radius:
  panel: 16
  pill: 999
  card: 14                    # v2 .kc only
---

# Fantasyball — design contract

Fantasyball is a roguelike basketball card game: draft a five, run the bracket,
chase the ring. Played on phones by a Korean fantasy crew. The look is
**modern sportswear, not arcade**: graphite and white, tracked uppercase,
one flame-ball logo that is the only warm thing on the chrome. Colour comes
from two places only — the clubs (jerseys, cards, score bug) and a flat hot
orange on the numbers you're winning.

If a screen has a gradient, a glow, or a weight above 700 on the chrome,
it is wrong.

## 0. Where the references live

- **Nike** — the type and the restraint. Tracked uppercase labels, big tight
  numerals, generous panels, one action per screen.
- **NBA 2K** — the information design. Attribute bars, head-to-head radar,
  score bug, matchup layout.
- **NBA Jam** — the flame ball and the "on fire" call. Nothing else. No chrome
  text, no fire gradients, no cabinet.
- **v2 (beatball.html)** — three components are kept verbatim: `jerseySVG()` +
  `SPOT` (the lineup on the half court), the `.kc` tier card, and the flame
  logo webp + FANTASYBALL wordmark layout.

Rule: **loud on the moments, quiet on the work.** The wheel, the pack, the
on-fire call, the ring. Draft rows and stat sheets stay flat.

## 1. Colour

| Pair | Ratio | Use |
|---|---|---|
| ink on bg | 17.61 | text |
| ink on panel | 16.28 | text in panels |
| muted on panel | 5.48 | labels, ≥12px |
| hot on bg / panel | 6.11 / 5.65 | leading stats, "now" tile, on-fire accent |
| bg on ink | 17.61 | primary button label |

- Page is `bg`, panels are `panel` at radius 16 with **no border, no shadow**.
  Sections separate by background shift only.
- `hot` is never a fill for a button or a surface. Text on `hot` doesn't exist
  (ink on hot is 2.88 — fails).
- Team colours appear only inside jerseys, `.kc` cards, and as the 10px dot on
  the score bug. Never as a panel background.
- Charts: you = `ink`, opponent = `muted`. The bar you lead turns `hot`.
- Tiers (from `tierOf()`, unchanged): holo ≥90, gold ≥82, silver ≥74, bronze.
  Tier colour lives on the card frame only.

## 2. Type

- **Archivo Narrow 600** for display: wordmark, tabs, team names, section
  labels, jersey numbers, court names, CTA. Uppercase with 0.08em tracking
  (0.18em on the wordmark). **700 only for the record numeral** (73-9, scores)
  because Narrow 600 thins out above ~48px.
- **Archivo 400/500** for body and stat rows; 600 for a row's primary value.
- Scale (×1.25 from 16): 12.8 · 16 · 20 · 25 · 31 · 39 · 49; record numeral 72.
  Nothing below 12.8 except the v2 card's own internal sizes.
- `font-variant-numeric: tabular-nums` on every stat sheet, bar value, score.
- Never: Outfit outside the `.kc` card, Inter/Roboto/system-ui, any 800/900,
  italics, letter-spacing above 0.24em, monospace on numbers.

## 3. Layout

390px first. 16px gutters, 8px unit. One primary action per screen: a white
pill (`ink` fill, `bg` text, Narrow 600 caps). Tab bar is an underline, not
pills: muted caps, active = ink + 2px ink underline.

```
┌────────────────────────────┐
│ ● FANTASYBALL        meta  │  ← flame ball 32px + wordmark; logo → start screen
│ TEAM  RUN  TONIGHT  YOU    │  ← underline tabs
│ WARRIORS            73-9   │  ← name left, record numeral right, ring glyph under
│ ┌────────────────────────┐ │
│ │  half court + jerseys  │ │  ← panel, radius 16
│ └────────────────────────┘ │
│ attribute bars (panel)     │
│ ( PLAY THE RUN )           │  ← white pill
└────────────────────────────┘
```

## 4. Components

**Brand** — the v2 flame-ball webp at 32px beside FANTASYBALL (Narrow 600,
0.18em). Top-left, every screen, always returns to the start screen. The ball
is the only photographic or warm element on the chrome; it may scale up on the
start screen and the on-fire call, nowhere else.

**Lineup on court (TEAM)** — `jerseySVG()` and `SPOT` from v2 verbatim; floor
recoloured to `panel` with `line` markings, hoop at top. Under each jersey:
last name (Narrow 600 14px) and `POS · pts reb ast` (Archivo 500 10.5px,
`hot` if he leads his matchup line). Tap a jersey → the detail sheet. No OVR
on the court until the run's revealed it.

**Tier card `.kc`** — draft board only. v2 CSS verbatim with these edits:
portrait ratio and v2 colours (no team-colour background); DEF stays small
in `.ksml`, not in the header; a man appears in one position column only;
ⓘ button removed — tapping the card opens the sheet, signing happens there.

**Detail sheet** — panel, no card inside. Header: name, season, club, and the
per-game line (pts / reb / ast / stl / blk / 3pm) prominent in Narrow 600.
Below: 2K-style attribute bars grouped Scoring / Shooting / Playmaking /
Defence; bar length = league percentile, a `muted` tick at the position
average. Bars in `ink`, the ones above the tick in `hot`.

**Attribute bars (team)** — same bar language: label (muted) · track (panel2)
· value (Narrow 600, tabular). Scaled to the best of the current matchup, not
to the league; caption says so.

**Score bug (RUN)** — panel; club name with its colour dot, sub-line, score
in Narrow 700 48px; "Game N · Final" centred in muted. No borders between
sides.

**On-fire call** — panel with the flame ball at 40px, "X is on fire" (Narrow
600) and one muted line naming the anchor he beat. Fires only when a stat
clears its elite anchor. This is the one Jam moment; no gradient text.

**Radar** — six axes from real per-game sums; you in `ink` at 14% fill,
opponent in `muted` at 18%. Labels Archivo 600 11px. Legend uses club colour
dots only.

**Series strip** — seven tiles, radius 8: won = `ink` fill, upcoming = `panel`,
now = `hot` outline. Numbers Narrow 600.

**Wheel + LOCK** — the wheel spins on tap; LOCK (the white pill) stops it.
Stop-it-yourself is the mechanic. Only orange here is the pointer.

**Rings** — a 12px ring glyph (ink stroke) before the record's sub-line,
count not number, on the record card and trophy case only.

## 5. Motion

One orchestrated moment per screen (wheel stop, pack open, on-fire call,
ring). Nothing animates on load; no hover; no sheens. Respect
`prefers-reduced-motion`: instant swaps.

## 6. Copy

Sentence case in prose, uppercase only where the type system says so (tabs,
labels, CTA, team names). Plain verbs: Play the run, Play game 3, Lock,
Swap. Empty states say what to do next. No system language, no "sealed",
no "bracket #". Korean strings: same rules; Narrow for numbers only, Archivo
for Hangul.

## 7. Tells, by severity

**P0 — blocks commit**
- Any gradient, glow, `backdrop-filter`, drop-shadow on the chrome (the v2
  `.kc` holo sheen and card shadow are the sole exceptions)
- Any weight above 700; Outfit outside `.kc`; Inter/Roboto/system-ui
- A second primary button, or `hot` used as a fill or on something you don't lead
- Team colour as a panel or page background
- Cards where the contract says court, sheet, or rows; plain rows where it
  says wheel, pack, or score bug
- Real player faces or likenesses
- Pure white (#fff) or pure black (#000) surfaces — use `ink` / `bg`
- Chrome text, fire gradients, cabinet/arcade decoration

**P1 — fix before merge**
- 1px borders on panels; shadcn card grids of identical boxes
- Middle-dot meta strings outside the `POS · line` pattern; "→" on buttons;
  numbered 01/02 markers; icon-in-rounded-square; emoji anywhere
- Uniform spacing (every gap the same); fade-in on every element
- Off-scale type size; non-tabular numerals in a stat sheet
- Green/red delta text on cards or hero surfaces (allowed on draft rows only)
- On-fire call on a stat that didn't clear its anchor

**P2 — cosmetic**
- Tracking above 0.24em; italics; border-radius other than 8 / 16 / 999 / 14

## 8. Before you commit UI changes

1. Screenshot at 390px.
2. Zero P0, zero P1, or it doesn't merge.
3. Is the flame ball still the only warm thing on the chrome?
4. Big data-driven UI changes get a mockup reviewed first.

## 9. Running an audit

With `avoid-ai-design` installed, detect mode only — the direction is fixed by
sections 0–2:

    audit beatball.html for AI design tells, don't change anything.
    Score against DESIGN.md section 7, not your own aesthetic-directions list.

Fix P0s in one pass, P1s in a second, re-audit, then screenshot.
