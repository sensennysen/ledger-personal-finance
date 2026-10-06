# QA fixes and retest — 2026-10-06

Fixes for the four product findings and one test-infrastructure finding in [QA-20261006](../QA-20261006-summary.md). The original failures are preserved in runs 09–13.

## Environment

- Branch `qa-fixes`, based on `5756277` (the QA handoff) on top of `d687826`.
- macOS, Node 22.22.3, Google Chrome 154.0.8037.98 (Claude desktop in-app browser). Local Vite at `http://localhost:5173`, local Supabase at `http://127.0.0.1:54321`. No hosted database used.
- Signed in as the seeded demo user. The retests were run by hand in the browser, not through `docs/qa/runner`. That runner targets the Windows/PowerShell setup in the handoff and was not run.

## Fixes

| Finding | Fix | Regression |
|---|---|---|
| QA-001 / F-019c | `csvImport.ts` recognises a Ledger export by exact `Type`, `Amount` and `Currency` headers (any order). Direction comes from Type, not from the amount's sign. Transfers (`transfer-row`), missing or unknown Types (`bad-type`), negative amounts (`sign-conflict`) and rows in a currency other than the statement's (`other-currency`) are blocking errors. A Ledger export missing Type or Currency (one that has `Standing Balance`, `To Account`, `Amount Received` or `Transfer Fee`) is refused before the preview. The dialog presets the statement currency to the file's single currency. Bank formats are unchanged. | `tests/csvImport.test.mjs`: format detection, expense/income direction, reordered headers, blocked transfer, bad type and sign conflict, incomplete export, mixed currency, bank direction unchanged, Reports and full-export round trip |
| QA-002 / V-007a | `FormControl` no longer renders a wrapper `div`. It clones its one child with `id`, `aria-describedby`, `aria-invalid` and `aria-labelledby`, and `FormLabel` gets an id. Wrapped controls were moved to the real control: the description combobox input and the emoji triggers. `AccountCombobox` and `ColorPicker` (`role="group"`) forward the props. Label-only items (account Type radiogroup, Payments Due, goal Color) now use `FormControl`. | Browser DOM checks below |
| QA-003 / F-029b | Catch-all `*` route in the signed-in layout renders `NotFoundPage` with a Home link. | Browser check below |
| QA-004 / F-016b | `filteredEmpty.ts`: a filtered-empty cycle reads "No transactions match your filters" and names the search, type and tag. The "Show all N" action is kept. | `tests/filteredEmpty.test.mjs` |
| QA-005 / S-003 | `disabledStates.test.mjs` and `hardcodedColors.test.mjs` use `fileURLToPath`. | Passes on macOS; Windows not rerun |

## Results

| Check | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm build` | Pass (large-bundle warning only) |
| `pnpm test` | Pass: 1,126 Node tests, then redesign checks |
| F-019c | **Pass.** The actual export header plus `QA split first` (Type `expense`, Amount `7`) previewed as **−$7.00** under "Ledger export" ([preview](F-019c-preview.jpg)). After import into a new USD account with 0 opening balance and a reload, the balance was **−$7.00** ([accounts](F-019c-accounts.jpg)). Database row: `type = expense`, `amount = 7.00`, account `balance = -7.00`. |
| F-019 (full QA export) | Preview only, nothing written: 4 expenses and 1 income ready; the 4 transfer rows were blocked as "Transfer needs its other account" until skipped. |
| V-007a | **Pass.** In Add Account, every `label[for]` resolves to the control: INPUT, the currency BUTTON (combobox), the colour group, TEXTAREA and the Type radiogroup. Clicking "Account Name" focuses its input. After an empty save, the input has `aria-invalid="true"` and its `aria-describedby` resolves to "Name is required". |
| F-029b | **Pass.** `/qa-page-does-not-exist` shows "Page not found" with a "Go to Home" link inside the app layout ([screenshot](F-029b.jpg)). |
| F-016b | **Pass.** Searching `nothing-matches-qa` shows "No transactions match your filters" and "Nothing in Oct 1 – Oct 31 matches “nothing-matches-qa”." with "Show all 6" ([screenshot](F-016b.jpg)). |

The local test account `QA F-019c` and its imported transaction were kept for investigation.

## Not verified

- The rest of the F-019 family: invalid and partial files, transfer mapping for bank statements, partial retry, and more than 1,000 rows. Exported transfers are blocked, not imported; a lossless round trip for transfers, fees and cross-currency rows is not supported.
- Duplicate detection was unchanged and is covered only by existing unit tests. It was not re-run in the browser for Ledger-format files.
- Screen-reader announcement of the new label wiring; every shared form other than Add Account.
- Missing account IDs (`/accounts/<unknown>`) as a separate F-029 variant.
- QA-005 on Windows.
