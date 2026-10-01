# LED-118 · Contrast leftovers — retro (2026-09-25)

## What shipped
- Home legend: amounts use `text-foreground` with a swatch dot in the category ink.
- 13th Month "–" uses `text-muted-foreground` (7.13:1 light, 6.38:1 dark, measured live); `thirteenthMonthEncoding` test updated.
- `categoryBreakdown.ts`: Uncategorized falls back to `var(--muted-foreground)`; no `#888` remains in `src`. Every consumer of a slice colour sets it as CSS `background` or `fill`, which takes `var()`.
- Treemap labels: `readableInk(bg)` in `lib/contrast.ts` picks black or white by the higher WCAG ratio; a non-hex colour gets `var(--card)`. The white fill and rgba halo are gone, and the `hardcodedColors` exception is deleted.
- `tests/contrast.test.mjs`: a light and a dark cell, all 34 palette hues and their dark tints at 4.5:1, and non-hex input.

## Deviation
The label inks are `#000000` and `#FFFFFF`, not the design ink `#2B2A30`. With `#2B2A30` seven palette hues were below 4.5:1 (as low as 3.78 on `#ef4444`). The better of black and white is at least 4.58:1 on any colour, so criterion (d) is met by construction.

## Acceptance
- (a) Legend amounts foreground ink with a dot, 4.5:1: PASS. Measured live: 13.55:1 light, 12.01:1 dark.
- (b) 13th Month placeholder 3:1 and not the border colour: PASS.
- (c) Uncategorized uses a token, no `#888`: PASS. `#888` is absent from `src` and the rendered DOM.
- (d) Treemap labels 4.5:1 on every cell, computed, unit-tested: PASS. Live: 9 labelled cells at 1280 and 6 at 390, lowest 4.70:1 (`#6366f1`).
- (e) Rendered scan clean at 1280 and 390 in both themes: PARTIAL. Dark is clean. Light has pre-existing failures outside these files (see LED-116 Backlog); nothing on 13th Month, the legend or the treemap.
- (f) Lint, build, test: PASS.

## Backlog
- The Uncategorized treemap cell was too small to show a label, so its `var(--card)` label on a `--muted-foreground` fill (about 7:1 light, 6:1 dark by the tokens) was not seen live.
- The wordmark dot in `public/l-black.png` and `l-white.png` is still yellow-green (LED-100 Backlog).
