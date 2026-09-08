# Ledger Material 3 redesign

Implemented from `redesign/Ledger M3 Mobile Design.zip`, using the existing React, Tailwind, Base UI, and Supabase application. The extracted HTML prototypes remain under `redesign/reference/` for comparison.

## Implemented

- Warm light/dark palettes using the handoff's exact hex values, Roboto headings/body text, DM Mono money values, tonal surfaces, rounded cards, pill controls, and semantic income/expense/transfer colors.
- Material color utilities generate matching primary/on-primary/container colors for custom accents; money colors stay fixed.
- Four mobile destinations: Home, Accounts, Activity, Budgets. Separate bottom-end FAB and an avatar menu with Reports, Categories, 13th Month, Settings, theme, and sign-out controls.
- Shared add/account/entry-detail sheet host with keyboard dismissal, focus management through Base UI, safe-area padding, and drag-handle dismissal.
- Amount-first quick entry with decimal keypad, frequently used categories, remembered account, expandable date/account/note fields, validation, and saving through the existing transaction hook. Receipts, recurring entries, loan repayment, and exchange-rate details remain available through the full form.
- Shared cycle state across Home, Activity, and Budgets. Budget totals and drill-down ranges use the selected cycle, including custom starts, historical periods, and year boundaries. Stale requests cannot overwrite a more recently selected cycle.
- Mobile balance overview with income/expense chips; desktop summary cards; bar-chart cash flow; widget drag handles; desktop dashboard and entry detail panes.
- Settings columns and appearance controls, report overview chart/category split, semantic transaction rows, login/legal-page typography, and a standalone 13th Month route with a result hero.
- Offline pending-entry count, a single sync subscription, persistent install-prompt dismissal, and updated PWA colors.

## Integration choices

- Detail panes start at 1024px, following `COVERAGE.md`; tablet layouts retain dialogs to avoid squeezing content.
- The install prompt sits above the mobile FAB so both remain usable.
- Account/category colors chosen by the user remain available. Semantic money colors describe transaction direction separately.
- Existing exports, report tabs, filters, bulk operations, receipts, recurring transactions, loans, savings goals, and account management are retained.

## Validation

- `npm ci` restores the exact lockfile dependencies. Material color utilities are the only added production dependency.
- `npm run build` performs TypeScript checking and builds the app/PWA.
- `npm run lint` checks the application.
- `npm run test:redesign` covers custom-cycle/leap-year/year-boundary ranges, budget periods, keypad editing and limits, and transaction validation without submitting transactions.
- The authenticated mobile dashboard and quick-entry keypad were inspected at 428px. A horizontal sheet overflow found during that check was corrected.

Browser automation became unavailable after the session changed. Final desktop/tablet/light-theme visual comparison and real-device install/offline testing remain unverified. No test transactions were submitted to the user's account.
