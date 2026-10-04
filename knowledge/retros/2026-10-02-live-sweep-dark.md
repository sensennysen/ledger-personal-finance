# Live sweep · dark theme (LED-205) — retro (2026-10-02)

Tree tested: branch `epics-15-19` at `2595d06` (no source changed). Covers the surfaces the three phase 12 sweeps and the phase 12 retro had viewed only in the light theme. Theme set to `dark` through the app's own stored preference (`ledger-theme`); every check asserted that `<html>` carried the `dark` class. An emulated `prefers-color-scheme` was not used.

## Method
`knowledge/patterns/live-sweep-method.md` and `rendered-contrast-scan.md`. Local Supabase and the seeded demo user (`demo@ledger.local`), plus a user with nothing (`empty@ledger.local`) for the first-run checklist. Headless Chromium through Playwright on the Vite dev server. No live account was touched.

For each surface:
- **Contrast walker.** Every visible text node in the surface's root (`main`, the open dialog, the docked aside, or the banner) is checked. Ancestor backgrounds are composited until one is opaque. The minimum is 4.5:1, or 3:1 for large text. Disabled controls are listed but exempt (LED-119 token, 3:1).
- **Light-surface pass.** Flags any element of at least 24×16px whose opaque fill has a relative luminance above 0.5, i.e. a light panel in the dark theme.
- **A screenshot.**

Widths were 1280, plus 390 for phone surfaces, 1920 for the docked pane, and 375, 390 and 768 for import.

Seeded state:
- One row marked `SWEEP-205 concert` puts Entertainment over budget for the Overspending card. It is deleted at the end of the phase.
- Flagged queue items (an edit conflict, a failed insert, an expired edit) were written straight into `ledger_offline_queue` to render the review sheet.
- The pending banner came from a queued insert whose write the driver cut off.

## Results
**14 PASS · 0 FAIL · 0 not checkable**

### PASS

| Item | Evidence |
|---|---|
| Account detail: card, checking and loan pages | account-card@1280: 407 text nodes, 0 below the minimum, no light surface. account-checking@1280: 323 text nodes, 0 below the minimum, no light surface. account-loan@1280: 33 text nodes, 0 below the minimum, no light surface. |
| Entry detail: docked pane at 1920 and the sheet at 1280 and 390 | entry-pane-docked@1920: 24 text nodes, 0 below the minimum, no light surface. entry-sheet@1280: 24 text nodes, 0 below the minimum, no light surface. entry-sheet@390: 24 text nodes, 0 below the minimum, no light surface. |
| Split dialog | split-dialog@1280: 24 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. The disabled item is "Split into 2" (4.17:1) before the lines add up; disabled controls use the LED-119 3:1 token. |
| Settings | settings@1280: 80 text nodes, 0 below the minimum, light surfaces: pointer-events-none block rounded-full b rgb(230, 228, 234). The light 24px span is the switch thumb on its dark track, by design. |
| 13th Month | 13th-month@1280: 122 text nodes, 0 below the minimum, light surfaces: w-full rounded-sm h-12 bg-income rgb(166, 217, 176). The light spans are the bg-income coverage bars (chart marks, no text). |
| Home widgets at 1280 and 390 | home@1280: 147 text nodes, 0 below the minimum, no light surface. home@390: 137 text nodes, 0 below the minimum, no light surface. |
| Search palette | search-palette@1280: 18 text nodes, 0 below the minimum, light surfaces: inline-flex min-h-8 shrink-0 items-cente rgb(230, 228, 234). The light button is the selected "All 3" filter chip: light fill with dark text, which passes contrast, the selected state by design. |
| Queue review sheet (conflict, failed and expired items) at 1280 and 390 | queue-sheet@1280: 30 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. queue-sheet@390: 30 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. The disabled item is "Sync now" (4.17:1) with nothing pending. Items were written into the queue in localStorage to render the sheet; the queue logic itself was not under test. |
| First-run checklist (a user with nothing) at 1280 and 390 | first-run@1280: 61 text nodes, 0 below the minimum, no light surface. first-run@390: 56 text nodes, 0 below the minimum, no light surface. |
| Offline banner: offline, offline with a queued entry, back online with a queued entry, flagged changes; 1280 and 390 | offline-banner@1280: 1 text nodes, 0 below the minimum, no light surface. banner-offline-queued@1280: 1 text nodes, 0 below the minimum, no light surface. banner-pending@1280: 5 text nodes, 0 below the minimum, light surfaces: ml-1 inline-flex items-center gap-1.5 ro rgb(232, 206, 146). banner-flagged@1280: 7 text nodes, 0 below the minimum, no light surface. banner-offline-queued@390: 1 text nodes, 0 below the minimum, no light surface. banner-pending@390: 5 text nodes, 0 below the minimum, light surfaces: ml-1 inline-flex items-center gap-1.5 ro rgb(232, 206, 146). banner-flagged@390: 7 text nodes, 0 below the minimum, no light surface. Texts: "Offline — you're not connected", "Offline — 1 entry will sync when you reconnect", "Back online — 1 change still queued / Sync now", "3 changes didn't sync and need your review / Review". The light button is "Sync now" (warning fill, dark text, passes). |
| Sticky bar stack and month rail (Activity, Sep 2026 scrolled 900px) at 1280 and 390 | 1280: result bar pinned at y=120..176, day headers stick under it with a 95% opaque surface fill; month rail beside the list; 320 text nodes, 0 below the minimum, no light surface. 390: bar at 160..206; 286 text nodes, 0 below the minimum, no light surface. Also at 1280 on the short current cycle: 68 text nodes, 0 failures. |
| Reports header and stat cards | reports@1280: 132 text nodes, 0 below the minimum, light surfaces: absolute top-0 right-0 w-24 h-24 rounded rgb(166, 217, 176); absolute top-0 right-0 w-24 h-24 rounded rgb(230, 228, 234); absolute top-0 right-0 w-24 h-24 rounded rgb(232, 206, 146); absolute top-0 right-0 w-24 h-24 rounded rgb(242, 184, 174). The light divs are the 10%-opacity decorative circles on the stat cards (the scan reads the fill without the opacity). A full-page scan including the page header (outside main): 145 text nodes, 0 below the minimum. |
| Overspending card (an overspent category) | overspending@1280: 20 text nodes, 0 below the minimum, no light surface. Card: "Entertainment $420.00 of $194.56, over $225.44, 1st"; total over $225.44. |
| Import summary and causes panel at 375, 390 and 768 | import-summary@375: 96 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-causes@375: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-table@375: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-summary@390: 96 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-causes@390: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-table@390: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-summary@768: 96 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-causes@768: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. import-table@768: 90 text nodes, 0 below the minimum (+1 disabled, exempt), no light surface. A six-row file with a duplicate, an unparseable date, a bad amount and three unmatched payees. The disabled item is the import button, "Fix or skip 2 error rows" (4.17:1), while errors block it. |

## Notes
- Every surface has a result, and there is no FAIL, so LED-205 is Done.
- The light-surface pass flagged only:
  - the switch thumb;
  - the 13th Month coverage bars;
  - the 10%-opacity decorative circles on the Reports stat cards (the pass reads the fill, not the opacity);
  - the selected filter chip in the palette;
  - the "Sync now" pill.

  Each carries dark text that passes contrast, or carries no text.
- The scans cover the text the walker can see. Charts drawn as SVG (axis labels, the pie) are left out by the walker and were judged on the screenshots only.
- The demo loan shows "Next payment Jan 15, 2027" with 15 of 48 installments paid. The seed books 12 opening installments from Oct 2025 *and* repayments in Jul to Sep 2026, so the tracker counts 15. This is seed data, not an app fault.

## Backlog
- At 768 the import dialog is 768px wide in a 768px viewport (`max-w-3xl`), so it touches both edges. That is a layout point for LED-206, recorded there.
