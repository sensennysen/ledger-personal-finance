# Ledger Material 3 redesign — blue/indigo handoff

Implemented from `~/Downloads/Application redesign project.zip`
("design_handoff_dark_theme", from Claude Design), on top of the existing
React + Tailwind v4 + Base UI + Supabase app. This supersedes the earlier
gold M3 pass. Reference `.dc.html` mockups + screenshots are in that bundle;
they were recreated with the app's own primitives, not embedded.

Delivered in 11 committed phases on the `redesign-v1` branch. Every capability
that was removed or trimmed to match a mockup is listed in
[`REDESIGN_LOSSES.md`](./REDESIGN_LOSSES.md), grouped by phase.

## Design system

- **Palette:** M3 blue/indigo — `--primary` `#55659A` light / `#B7C1EC` dark —
  replacing the gold seed. Cool neutral surfaces; a full validated dark scheme;
  tonal semantic roles `--income` / `--expense` / `--transfer` / `--gold`, each
  with a `-container`. All values are the handoff's exact hex.
- **Tokens** (`src/index.css`): existing shadcn variable names keep their roles
  (so components inherit for free); added M3 role aliases
  `--primary-container`, `--surface-container(-high)`, `--nav-container`,
  `--outline(-variant)`, `--gold(-container)` and elevation `--el1` / `--el3`,
  each with a matching Tailwind `--color-*` / `--shadow-*` utility.
- **Type:** Roboto (sans + headings), DM Mono (`.money`, tabular-nums) — unchanged.
- **Shape/elevation:** surface cards 16–24px radius with `--el1`; pill buttons,
  chips, tabs, nav items; modals `rounded-[28px]` + `--el3`; 56px FAB.
- **Custom accent:** the Settings colour picker still regenerates
  primary / primary-container from a seed via `@material/material-color-utilities`;
  money colours stay fixed.

## Screens

| Screen | Notes |
|---|---|
| Navigation | 240px desktop rail / 80px tablet icon rail (no collapse); 5-item mobile bottom nav (Home / Accounts / Activity / Budgets / **More**); More sheet = Categories / Reports / Settings + dark mode + sign out; 56px FAB. |
| Home | Net Worth hero + income/expense container tiles, Cash Flow card (Daily/3mo/12mo segmented), Credit Card card, Recent Transactions. Fixed layout — the configurable widget system is gone. |
| Accounts | Assets − Liabilities = Net Worth breakdown; Assets list card; Liabilities cards (accent stripe, utilisation bar, "Due in Nd" chip, loan schedule). Add Account modal. |
| Account Detail | Outlined back button + type tile; solid-fill hero (account colour / `--expense` / `--gold`); credit-card payment panel; loan Summary/Purchases/Activity tabs; hero ⋯ = Edit / Delete account. |
| Activity | Pill search, All/Income/Expense/Transfer segmented, month stepper, Select; day-grouped rows in one surface card; single ⋯ row menu (Edit / Split / Save as template / Delete). |
| Budgets & Goals | Budgets / Budget History / Savings Goals pill tabs; budget + goal cards with thin progress bars + status chips; all modals retained. |
| Reports | Overview / Analytics / 13th Month pill tabs; single Export button → CSV / PDF menu; flat stat cards with tinted delta lines; charts + account balances + recent-in-period. |
| Settings | Sticky section rail (labels desktop / icons tablet / none mobile) with scroll-spy + jump; single ≤640px column; 7 sections unchanged; type-DELETE confirm. |
| Transaction entry | Amount-first bordered block (`$` + large tinted decimal field + currency pill), Account/Category + Description/Date grids, collapsible "More details" (notes / tags / goal / recurring / receipt). |

## Validation

- `npm ci` restores the lockfile (`@material/material-color-utilities` is required
  and was not present in the pre-existing `node_modules`).
- `npm run build` (tsc -b + vite) — passes.
- `npm run lint` — passes.
- `npm run test:redesign` — passes (cycle boundaries, keypad editing, transaction
  validation; `src/lib/{utils,budgetCycle,entryAmount}.ts` and
  `transactionFormSchema.ts` semantics untouched).
- No authenticated visual pass was possible (Google OAuth gate); each phase was
  verified against build + lint + the dev-server transform only.
