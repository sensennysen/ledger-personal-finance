# LED-211 · Sweep drivers as a repo script — retro (2026-10-03)

Branch `epics-15-19` at `2f135d6`. Decision OD-12 (a): yes, as a dev-only script.

## What was built
**`scripts/sweep.mjs`** (Node 22, `pnpm sweep`) is the committed form of `live-sweep-method.md`, `browser-check-with-local-user.md` and `rendered-contrast-scan.md`.

**Sign-in and scope**
- It signs in through the DEV form as the seeded demo user and sets `ledger-first-run` to confirmed.
- For each theme (set through `ledger-theme`) and width, it visits the routes. The defaults are:
  - every app route plus `/login`, `/privacy`, `/terms` and `/data-deletion`;
  - widths 390x844 and 1280x900;
  - light and dark.

**Checks on each page**
- **Contrast scan.**
  - It covers every visible text node in `body`.
  - Colours are parsed through a 1x1 canvas, so oklab and color-mix work.
  - Ancestor backgrounds are composited until opaque, and element opacity is applied.
  - The minimum is 4.5:1, or 3:1 for large text.
  - Disabled controls and the "." of the "Ledger." wordmark are listed as exempt.
- **Dark only: light-surface pass.** Flags elements of at least 24x16px with luminance above 0.5, as a NOTE.
- **Overflow.** Sideways scroll is a FAIL.
- **Screenshot.** One full-page screenshot.

**`--home-fold`.** At 390x844 it reads the Home widgets (the grid children `DashboardPage` orders 10+) and checks each against the top of the visible bottom nav.

**Output**
- One PASS/FAIL/NOTE line per check, plus `results.json` in `--out` (default `sweep-out/`, git-ignored).
- The exit code is 1 when anything fails.

**Other flags:** `--base-url`, `--routes`, `--widths`, `--themes`, `--email`/`--password`, and `--relay-fonts` (Google Fonts through Node `fetch`, for containers whose proxy Chromium does not trust; `docs/claude-cloud.md`).

**Playwright**
- It is loaded at runtime from `node_modules`, else from the global install. No dependency, lockfile or bundle change.
- It launches with `{ channel: 'chromium' }` and falls back to the default launch.
- It never passes Playwright's `proxy` option.

**Wiring**
- `package.json` gets a `sweep` script, which is not part of `test`, so CI never runs it.
- `.gitignore` gets `sweep-out/`.
- README gets a "Sweep script" section (prerequisites, examples, flags, blind spots).
- `live-sweep-method.md` item 2 points to it.

## Acceptance
- **(a) OD-12 answered: PASS.** (a), dev only, `4ab1d00`.
- **(b) A script under `scripts/` that runs against a local Supabase and a seeded test user, with no dependency added to the app bundle: PASS.**
  - The full default run against a fresh `pnpm db:reset` and the dev server: 12 routes × 2 widths × 2 themes plus the fold took 2m24s and gave 42 PASS · 7 FAIL.
  - `package.json` gains only the script line; `pnpm-lock.yaml` and `dependencies` are unchanged; nothing in `src/` imports Playwright.
- **(c) CI does not run it: PASS.** `pnpm test` is `node --test tests/*.test.mjs && node tests/redesign.mjs`, and `ci.yml` is unchanged. ESLint lints only `**/*.{ts,tsx}`, and `tsc` includes only `src`.
- **(d) README says how to run it: PASS.**

## What the first runs found
- **Run 1: 40 PASS · 9 FAIL.** The two new contrast failures were hover states. The pointer was left where "Sign in with email" was clicked, so the card or row under it was measured hovered:
  - Budgets at 390: "View covered transactions" at 4.26:1 on `hover:bg-accent/20`.
  - Activity at 1280: a transfer amount at 4.4:1 on `hover:bg-accent/50`.
  - The script now parks the pointer at (0,0) before each scan. Re-run, both routes are 0 below the minimum at 390 and 1280 in light.
  - The hover states are real states, so they are filed as **LED-246** (epic 21, Low).
- **Run 2: 42 PASS · 7 FAIL.**
  - Six were the wordmark ".": `Ledger<span style="color: var(--primary)">.</span>` in `LegalPage.tsx:36`, at 4.19:1 in light. LED-207 recorded it as an exempt logotype, so the script now lists it as exempt.
  - The seventh is the Home fold, below.
- **Home fold at 390x844, demo user, default order.** This is LED-202's starting point, recorded for that ticket.

  | Widget | Top | Bottom | Height | Above the fold (756) |
  |---|---|---|---|---|
  | Upcoming Bills | 176 | 340 | 165px | yes |
  | Net Worth | 356 | 548 | 192px | yes |
  | Credit Card Monitor | 564 | 751 | 187px | yes |
  | Budget Progress | 767 | 1024 | 257px | **no** |

  The cash flow chart is sixth.
- **NOTE (dark, light surfaces).** The Settings switch thumb and the 13th Month coverage bars, both by design (LED-205).

## Backlog
- **No area drivers yet.** The script covers contrast, overflow, screenshots and the fold. Offline cuts, held reads, form flows and psql comparisons are still per-sweep drivers (`browser-check-with-local-user.md`).
- **Hover, focus and SVG.** No hover pass, no focus-ring measurement (LED-229's method) and no SVG text: the blind spots listed in `rendered-contrast-scan.md`.
- **Fold check scope.** The `--home-fold` PASS/FAIL checks "first four fully above". It does not decide what LED-202 accepts.
- **New pages.** The default route list needs the two new legal pages once LED-189 adds them.
