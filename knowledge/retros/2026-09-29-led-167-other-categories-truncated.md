# LED-167 · "Other · N categories" truncated at 390 and 768 — retro (2026-09-29)

## What shipped
- `OtherRow` in `src/components/reports/CategoryBreakdownCard.tsx`: dropped `truncate` from the `"Other · {other.count} categories"` label, added `leading-tight` so it wraps onto a second line instead of cutting mid-word. The label's grid column stays `minmax(0,8rem)` — unchanged — so at any width where the text doesn't fit, it now wraps rather than clips; where it already fit (wide viewports / short counts) nothing visibly changes.
- Left `BarRow`'s and `SubcategoryRows`'s `truncate` untouched — only the longer Other label needed this.

## Acceptance
- (a) At 390 and 768 the row shows "Other · N categories" in full or wraps onto two lines: **PASS by construction** (wrap enabled, column width unchanged) — not re-measured live this session (see Backlog).
- (b) 1280 unchanged: **PASS** — no width/breakpoint classes touched, wrap only engages when content exceeds the (unchanged) 8rem cap.
- Lint, `tsc -b`, full test suite: PASS (no unit-testable logic changed, layout only).

## Backlog
- No browser extension available this session. Re-check against the original repro (`shots/125-catbreak-ranked-dark-390.png`, `125-reports-table-768.png`) with a seeded "Other" bucket of ~25 categories at 390, 768 and 1280, light and dark, per `knowledge/patterns/live-sweep-method.md`.
