# LED-115 · Gold token trio and GOLD repoint — retro (2026-09-25)

`GOLD` was `var(--primary)`, which was gold until LED-100 re-seeded `--primary` to indigo. No solid gold token existed, only the `--warning` ink and tint.

## What shipped
- `src/index.css`: `--gold` in `:root` and `.dark`, `--color-gold` in `@theme inline` (`bg-gold`, `border-gold`, `text-gold`). A comment states the rule: gold is for borders, fills, meters and icon tiles; text uses `--warning`.
- `constants/colors.ts`: `GOLD = 'var(--gold)'`, a new `WARNING_INK = 'var(--warning)'`, and a corrected header comment. `utilizationTone.ts` comment corrected.
- `tests/themeContrast.test.mjs`: gold >= 3:1 on page and card in both themes, plus `--warning` on `--card` at 4.5:1. The `--warning` on `--warning-container` pair already existed.
- `knowledge/patterns/semantic-token-aliases.md`, linked from `theme-token-contrast.md`.

## Deviation from the design
Light `--gold` is `#917738`, not the design's `#9A7F3D`. The design value measures 2.84:1 on the page (`#DEDDE3`), which fails criterion (c); `#917738` is 3.18 on the page and 4.08 on the card. Dark is the design's `#C9AC6A` (8.51 / 6.92). Same approach as LED-100: the nearest step of the same hue, with a comment naming the original.

## Acceptance
- (a) `--gold` in both themes with utilities: PASS. Live: computed `#917738` light, `#c9ac6a` dark.
- (b) GOLD resolves to `var(--gold)`: PASS.
- (c) Contrast test: PASS.
- (d) `hardcodedColors` clean: PASS.
- (e) Stale comments fixed, pattern added: PASS.
- (f) Lint, build, test: PASS.

## Backlog
- Gold as text is not allowed (3.65:1 on the card in light). Anything new that wants gold text must use `--warning`.
- `--warning` on the page (not a card) is 4.21:1 in light. Nothing renders it there today, so it is not in the test; add the pair if a warning ever sits on the bare page.
- The design's gold page tint (`#FBF4E8`, dark `#2A2519`) has no token. Add one when LED-139 or LED-141 first needs it.
