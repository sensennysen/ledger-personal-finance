# Density & verbosity pass — retro (2026-10-06)

Applied the `design_handoff_density_and_verbosity` handoff (sections 1a–4a) directly on `main`. Client only: no migrations.

## What was built
- **1a Accounts.** The page cap goes from `max-w-6xl` to `max-w-[1600px]` (`lg:px-8`). From lg (`useMediaQuery('(min-width: 1024px)')`), Assets and Liabilities share one table with one column template (`TABLE_COLS`): Account · Type · Currency · Share · Usage · Scheduled · Balance · actions. Liability cards become rows with an inline Pay / Repay button. The View button is gone because a row click opens the account. Group headers are Assets/Liabilities (flat view) or one per type (grouped view), with the total in the Balance column. The summary strip drops its sub-lines. The rates footnote is shared by both layouts. Below lg the stacked layout is unchanged.
  - The handoff's widths (minimum about 1262px) do not fit at 1024, so lg–2xl uses narrower fixed columns (96/60/112/136/108px, gap 12). 2xl uses the handoff's widths exactly. Checked at 1024: no horizontal scroll.
  - Phones: the summary figures are `text-lg`, and `sm:text-[22px]` from sm up. At 22px, "−$16,336.69" wrapped.
- **2a Account detail.** The ResultBar is one line on every width: `N` / `N of M` · net. Gone: range, "Sum", the scheduled note and the 2px top rule. "Export match" becomes "Export". The band is Balance · Scheduled · This cycle for assets. Cards and loans get a Scheduled cell, and the "owed", "No countdown", "Add one to track utilisation" and "Subtracted from net worth" subs are dropped. The band grid is `gap-px` on `bg-border/60`, so it takes any cell count. The side panel heading is "This cycle"; the "+N more" line is removed.
- **3a Activity compact.** Desktop Compact renders `TransactionRow variant="table"`: 36px rows with Description (flags), Category, Account and Amount. There are no badges or buttons; a row click opens the entry detail. Each day is one surface with a sticky `bg-surface` header (`TransactionDayList table`). The flat/amount sort uses `TableSurface`. On the Account page the Account column is dropped, and a transfer's direction fills the Category cell. Day headers show the net only, at every density.
- **4a Helper text.** Removed: kind menu descriptions and fallbacks; `kindDialogSubtitle` / `LIABILITY_DIALOG_SUBTITLES` ("Change kind" now sits beside the title); and the TransactionForm, AccountForm, LoanPurchaseForm, LoanPurchaseTracker, Budgets goals, Net Worth dialog, `REFRESH_FREQUENCIES` and first-run checklist copy listed in the handoff. Also cut: restating EmptyState descriptions, Settings card descriptions that restate the title (Browser storage, Exchange rates and Budgets are kept), and `SCHEDULE_CONTROL_HINTS`. The Treemap's keyboard note is now `sr-only` rather than deleted (LED-148). `scheduledSumNote` was left with no caller and is deleted.

## Verified
`pnpm lint`, `pnpm build` and `pnpm test` (1115 pass, plus the redesign checks). Viewed in the browser pane against local Supabase:
- Accounts at 1920, 1024 and 375.
- Activity Compact and Comfortable at 1920.
- The Account detail page and the Transfer dialog at 1920.

## Backlog (not verified)
- Rearrange mode (drag and group drag) inside the wide table was not exercised by hand.
- Dark theme only. Light theme was not screenshotted.
- Bulk select inside the compact table was not exercised.
- The optional hover ⋯ menu on compact rows (3a) was not built. A row click opens the entry detail pane, which holds the actions.
