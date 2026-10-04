# Live sweep · rendered contrast on Login, Settings, the account page, the deletion page and the ranked card (LED-207) — retro (2026-10-02)

Tree tested: branch `epics-15-19` at `ff0066c` (no source changed). Scans the screens that LED-144, LED-151 and the phase 10 and 11 retros left unscanned, plus the sidebar and ring tokens.

## Method
`knowledge/patterns/rendered-contrast-scan.md`, both themes, on a local Supabase with headless Chromium (Playwright). No live account was touched.

**Contrast walker.** Every visible text node in the page body is checked. Ancestor backgrounds are composited until one is opaque. The minimum is 4.5:1, or 3:1 for large text. Disabled controls are listed but exempt (LED-119, 3:1).

**Users and widths.**
- Signed-out pages at 1280 and 390.
- Settings and the card, checking and loan account pages with the demo user at 1280.
- The ranked Home card with `empty@ledger.local`, given 14 spending categories so the card switches from pie to ranked (more than 12), at 1280 and 390, with Other closed and open.

**The disabled Google button.** Clicking it starts sign-in. The provider redirect (`/auth/v1/authorize`) was answered with HTTP 204, so the browser stays on `/login` and shows the button in its "Signing in…" state. Two other attempts failed:
- With an expired stored session the login page renders blank while auth loads, so no button appears.
- Holding the redirect leaves Playwright waiting on the navigation.

**Tokens.** For the default accent and all 15 swatches, in both themes, the computed custom properties were read from the rendered root (32 runs). Each run also walked the top bar. The bottom nav was walked at 390 for four accents.

**Focus rings.** Rendered focus rings were measured on controls reached with the keyboard (`:focus-visible` true).

## Results
**9 PASS · 2 FAIL · 0 not checkable** (1 notes)

### FAIL (each has a new ticket in `epic-20-phase-4-sweep-findings-tasks.csv`)

| Ticket | Item | Evidence |
|---|---|---|
| LED-228 | Account page, light: inactive tab labels are 3.55:1 | Light 1280: card and checking pages "Income", "Expense", "Transfer" and loan page "Purchases", "Activity" at 3.55:1 (text oklab(0.288 … / 0.6) on rgb(222,221,227)); every other text node passes (412, 328 and 38 scanned). The shared TabsTrigger (src/components/ui/tabs.tsx:61) sets inactive labels to text-foreground/60 in light (dark uses text-muted-foreground and passes). The same 3.55:1 was noted by LED-116, LED-139, LED-152 and the phase 9 retro (Weekly / 3 months / 12 months, Ranked, Goals, Analytics, Income) but no ticket was ever filed. Screenshot: `knowledge/retros/shots/207-account-card-light-1280.png`. |
| LED-229 | A saved filter row has only the half-opacity ring for focus | Saved filters dialog, the row button (SWEEP-207 groceries) focused by keyboard (:focus-visible true): its only indicator is a 3px ring of --ring at 50% ("oklab(0.516872 0.000613749 -0.086429 / 0.5) 0px 0px 0px 3px"), 2.07:1 against the dialog in light and 2.94:1 in dark; outline none, no border. Expected 3:1 (WCAG 1.4.11). src/components/transactions/SavedFiltersDialog.tsx:222 uses focus-visible:ring-ring/50 with outline-none. Screenshot: `knowledge/retros/shots/207-saved-filter-focus-light-1280.png`. |

### PASS

| Item | Evidence |
|---|---|
| Login, signed out (1280 and 390, light and dark) | light 1280: 22 nodes, 0 below; light 390: 19 nodes, 0 below; dark 1280: 22 nodes, 0 below; dark 390: 19 nodes, 0 below. The scan covers the whole page, the Google button and the dev-only seeded login included. |
| The disabled Google button is screenshotted (light and dark) | Disabled by starting sign-in with the provider redirect answered 204, so the page stays (1 request to /auth/v1/authorize, URL still /login). Enabled: "Continue with Google" 16.48:1 light, 14.47:1 dark. Disabled: "Signing in…", disabled=true, cursor not-allowed, text rgb(122, 120, 131) on rgb(231, 229, 234) = 3.47:1 light; rgb(150, 148, 158) on rgb(52, 51, 60) = 4.17:1 dark. Disabled controls are held to the LED-119 3:1 token, which both meet. Screenshots knowledge/retros/shots/207-google-disabled-light-390.png and 207-google-disabled-dark-1280.png. |
| Settings (light and dark) | light 1280: 85 nodes, 0 below; dark 1280: 85 nodes, 0 below |
| Account page, dark (card, checking and loan) | Dark: card 412 nodes, checking 328, loan 38; 0 below the minimum on each. |
| Deletion page, signed out and signed in (light and dark) | light 1280: 47 nodes, 1 below — "." 4.19:1; light 390: 46 nodes, 1 below — "." 4.19:1; dark 1280: 47 nodes, 0 below; dark 390: 46 nodes, 0 below; signed in: light 1280: 57 nodes, 1 below — "." 4.19:1; dark 1280: 57 nodes, 0 below. The one light-theme node is the "." of the "L." logotype in --primary on the page header (4.19:1 at 18px); a logotype is exempt (WCAG 1.4.3). Dark: 0. |
| Ranked Home card (14 categories), Other closed and open, 1280 and 390, light and dark | light 1280: 31 nodes, 0 below; light 390: 31 nodes, 0 below; dark 1280: 31 nodes, 0 below; dark 390: 31 nodes, 0 below; Other open: light 1280: 43 nodes, 0 below; light 390: 43 nodes, 0 below; dark 1280: 43 nodes, 0 below; dark 390: 43 nodes, 0 below |
| Sidebar tokens for the default accent and all 15 swatches (light and dark) | 32 runs (16 accents × 2 themes), read from the rendered root. Lowest light / dark: --sidebar-foreground on --sidebar 12.31 / 13.26; --sidebar-accent-foreground on --sidebar-accent 8.97 / 7.18; --sidebar-primary-foreground on --sidebar-primary 5.65 / 7.69; --sidebar-primary on --sidebar 4.9 / 8.16. Rendered top bar: active nav pill 8.97 / 7.18, inactive link 12.31 / 13.26; the walker over the whole top bar found 0 failures in all 32 runs; the bottom nav at 390 (default, #eab308, #22c55e, #84cc16, both themes) 0 failures. |
| Ring tokens: the solid focus ring against every surface it sits on | --ring (and --sidebar-ring) at 3:1 or more for every accent: lowest light / dark on --background 4.19 / 9.09, --card 5.39 / 7.39, --sidebar 4.9 / 8.16, --popover 5.39 / 7.39. Most controls use the solid ring (focus-visible:ring-ring, 24 sites). |
| Ring tokens: the half-opacity ring where a solid border also shows focus (input, select, textarea, switch, badge, tabs) | ring-ring/50 composited is below 3:1 (lowest light 1.89 on --background, 2.07 on --card; dark 2.95 on --card for the default accent). These components also set focus-visible:border-ring (tabs add outline-ring), and that border carries the contrast: the Activity search input focused shows a 1px rgb(85, 101, 154) border at 4.19:1 light and 9.09:1 dark. |

### Notes

| Item | Evidence |
|---|---|
| scroll-area focus | The ScrollArea viewport also relies on ring/50 plus outline-1, and the base layer sets outline-ring/50 (src/index.css:237), so it too is under 3:1. It never shows: the Reports table viewport (the only one on these screens) has tabindex -1 and 80 Tab presses from the top of Reports never reach it, light or dark. Not ticketed. |

## Notes
- Every listed screen was scanned in light and dark, each failing pair has a ticket (LED-228, LED-229), and the disabled Google button is screenshotted. LED-207 is Done.
- LED-228 is not new. LED-116 first measured the 3.55:1 inactive tab label in light, and LED-139, LED-152 and the phase 9 retro each said it needed a ticket. This sweep files it.

## Backlog
- `outline-ring/50` is the global outline colour (`src/index.css:237`). Any control that shows focus with an outline alone would be under 3:1. None was found on these screens beyond LED-229.
