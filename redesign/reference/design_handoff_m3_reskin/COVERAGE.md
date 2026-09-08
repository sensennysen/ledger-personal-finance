# Coverage — every route, specified

All 13 routes are now specified. The token layer covers the app automatically;
layout specs cover every screen.

| Route | Surface | Where |
|---|---|---|
| `/` | desktop | `SCREEN-MAP.md` A1/B1 · dark + light |
| `/` | mobile | `SCREEN-MAP.md` A3/B3 · dark + light |
| `/settings` | desktop | `SCREEN-MAP.md` A2/B2 · dark + light |
| `/settings` | mobile | `Ledger M3 Coverage.dc.html` **M1** |
| `/accounts` | mobile | `Ledger M3 PWA.dc.html` |
| `/accounts` | desktop | `Ledger M3 Coverage.dc.html` **D1** |
| `/accounts/:id/transactions` | mobile | `Ledger M3 Coverage.dc.html` **M5** |
| `/transactions` | mobile | `Ledger M3 PWA.dc.html` |
| `/transactions` | desktop | `Ledger M3 Coverage.dc.html` **D2** |
| `/budgets` | mobile | `Ledger M3 PWA.dc.html` |
| `/budgets` | desktop | `Ledger M3 Coverage.dc.html` **D3** |
| `/categories` | mobile | `Ledger M3 Coverage.dc.html` **M2** |
| `/reports` | mobile | `Ledger M3 Coverage.dc.html` **M3** |
| `/reports` | desktop | `Ledger M3 Coverage.dc.html` **D4** |
| `/thirteenth-month` | mobile | `Ledger M3 Coverage.dc.html` **M4** |
| `/privacy`, `/terms`, `/data-deletion` | mobile | `Ledger M3 Coverage.dc.html` **M7** (one layout, three routes) |
| `/login` | mobile | `Ledger M3 Coverage.dc.html` **M6** |
| Mobile shell — nav, app bar, cycle, FAB, sheets | — | `NAV-REWORK.md` §1-3 |
| Offline + install banners | — | `NAV-REWORK.md` §5 |

Frame ids (M1, D2…) are the badges above each frame in the file.

## Themes

`Ledger M3 App Reskin.dc.html` specifies its 4 screens in **both** dark and
light. Everything else is drawn in dark, with four light frames covering the
screens where the dark→light mapping is a judgement call rather than a lookup:

| Light frame | Why it needed drawing |
|---|---|
| **M2-light** `/categories` | container-filled tiles on a light card |
| **M4-light** `/thirteenth-month` | the hero stays `primary-container`; filled primary would out-shout the page |
| **M6-light** `/login` | the only screen on `surface` rather than `surface-dim` — the page is the card |
| **D4-light** `/reports` | chart bars take full-strength tones, not containers; tracks use `outline-variant` |

Every other frame maps 1:1 through the colour-role table in `README.md`: no
frame in this bundle uses a colour outside that table, so each dark value has a
stated light pair. Where a dark screen fills a shape with a `*-container` tone,
the light screen uses the light `*-container` — except in charts, where the
container tones are too pale to read and the full tone is correct.

## Desktop breakpoints

Desktop frames are drawn at 1280×800 with the 220px drawer. Between `md` and
`lg`, drop multi-column grids to one column and hide the right pane (detail
returns to a dialog) — the same rule the Dashboard already uses.

## Screens that reuse rather than introduce

Only `/reports` has genuinely new structure (see the implementation notes at the
bottom of the Coverage file). Everything else is assembled from patterns already
specified elsewhere in this bundle: the 40px container-tile list row, the card
header, the segmented button, the chip row, the 340px detail pane, the drawer
pill. If an implementation needs a pattern that isn't in that list, that's a
signal to stop and ask rather than invent.

## Not designed, deliberately

Empty states, skeletons and error states are specified as rules rather than
frames — README "Interactions & behaviour": skeletons keep layout position in
`--muted`, empty states use `--muted-foreground` at body size, errors use
`--expense`.
