# Agent handoff: CSV expense direction defect

## Objective

Fix **QA-001 / F-019c**: importing Ledger's own exported CSV must not turn an expense into income. This handoff prioritizes the financial defect from the QA report. Other findings are listed below for context, not as a requirement for unrelated changes.

This document does not implement a fix. Follow the repository's current AGENTS.md and preserve existing user changes. The preceding QA work intentionally left application code unchanged.

### Shared artifact scope

The handoff commit includes the QA runner and its pinned dependency lockfile, consolidated results, runs 09–13, the final visual matrix, and the QA retro. Older exploratory runs, local logs, environment files, dependency caches and Google-account screenshots are intentionally excluded. Historical OAuth screenshot/log references in the reports refer to local-only evidence and will not resolve in a fresh checkout. All artifacts needed for the CSV defect reproduction above are included. Install QA dependencies and configure local Supabase before rerunning; retained fixture IDs do not imply those records exist in another developer's database.

## Confirmed reproduction

Tested revision: `d687826b0da6f4aba5fa186ba2a5ad54b8695b7a`. Windows, Chrome 154.0.8037.94, local Vite at `http://127.0.0.1:5173`, local Supabase at `http://127.0.0.1:54321`.

1. Create an expense of 7 in a disposable local QA account.
2. Export transactions from Reports as CSV, including Type and Amount.
3. Create an empty destination test account with opening balance 0.
4. Import the export's header and expense row through the CSV import dialog.
5. Inspect the preview, saved transaction, account balance and state after reload.

Observed export header: `Date,Description,Category,Account,Type,Amount,Currency,Standing Balance`. The `QA split first` row has Type `expense` and Amount `7`.

**Actual:** persisted type is `income`; account balance becomes +7. **Expected:** type remains `expense`; balance becomes −7. This changes the result by 14 relative to the expected balance and misclassifies income/spending.

Evidence:

- [Actual export](runs/QA-20261006-09/report.csv)
- [Failed assertion](runs/QA-20261006-13/results.json)
- [Screenshot showing incorrect positive balance](runs/QA-20261006-13/F-019c.png)
- [Consolidated findings](runs/QA-20261006-summary.md)

## Code entry points and diagnosis

- [csvImport.ts](../../src/lib/csvImport.ts): `buildRows` derives direction from the amount sign (`value < 0 ? 'expense' : 'income'`). Positive absolute exported expense amounts therefore become income. Inspect format detection and column mapping before changing this branch.
- [transactionCsv.ts](../../src/lib/transactionCsv.ts): `buildReportCsv` exports chosen columns; `buildTransactionsCsv` exports the fuller schema. Both write transaction amounts alongside explicit type when that column is present. Reports can omit or reorder columns, so not every report is sufficient for a lossless import.
- [ImportCSVDialog.tsx](../../src/components/transactions/ImportCSVDialog.tsx): inspect preview, mapping, validation and persistence to ensure the corrected type reaches the saved record.
- Relevant helpers: `src/lib/importTransfer.ts`, `importCurrency.ts`, `importDuplicates.ts` and `importCategories.ts`.
- Existing regression files: `tests/csvImport.test.mjs`, `transactionCsv.test.mjs`, `importTransfer.test.mjs`, `importCurrency.test.mjs`, `importDuplicates.test.mjs` and `importCategories.test.mjs`.

Suggested approach: recognize supported Ledger export semantics and consume an explicit valid Type rather than infer direction solely from sign. Preserve generic bank statement signed-amount behavior. Define handling for invalid/missing types, conflicting signs and incomplete schemas. Do not silently coerce transfers into income/expense or guess destination/currency information. If a row cannot be represented safely, show an actionable blocking validation error. A warning alone is insufficient if proceeding would corrupt its financial meaning.

Keep the change focused. Do not assume the Reports export is a full backup format or add a schema migration unless the investigation demonstrates one is needed. Do not repair previously imported user records automatically: the original intent cannot safely be inferred from positive amounts alone.

## Acceptance criteria

- A positive-amount exported expense imports as an expense of the same magnitude; a positive-amount exported income remains income.
- The UI preview and persisted record agree. Reload preserves the type, amount and correct balance delta; spending/income classification is correct.
- Generic signed-amount bank CSV behavior remains unchanged, including supported debit/credit column formats.
- Reordered supported headers work. Missing/unknown Type, sign conflicts and incomplete Ledger exports have explicit tested behavior with no silent financial reinterpretation.
- Transfer, fee and multicurrency rows either retain their supported semantics or are clearly blocked before writes when required information is unavailable. Test both supported and rejected paths.
- Duplicate detection/default skipping and partial retry remain correct; the fix does not create duplicate transactions or weaken validation.
- Add pure regression tests for the parser/export interaction and rerun the real browser case F-019c. Do not weaken its type or balance assertions to make it pass.

## Local setup and retest

All ten previously pending repository migrations through `20261006140000` were applied locally with user approval. Data was preserved. Check service/migration status again rather than assuming services remain running. Use `pnpm dev` and the repository's local database commands as needed. Do not reset the developer database or push remote migrations.

The QA runner uses `.env.development.local` for the local public API key and rejects a nonlocal API URL. Keep secrets out of logs. The repository also has hosted configuration; verify every test target is local. Google sign-in already passed and does not need to be repeated for this defect.

See [runner instructions](runner/README.md). From the repository root, use new output directories to retain original evidence:

```powershell
pnpm --dir docs/qa/runner install
$env:QA_OUT = 'docs/qa/runs/csv-fix-primary'
node docs/qa/runner/run.mjs

$env:QA_BASE_RUN = 'docs/qa/runs/csv-fix-primary/results.json'
$env:QA_OUT = 'docs/qa/runs/csv-fix-retest'
$env:QA_ONLY = 'F-019c'
node docs/qa/runner/features.mjs
```

The primary run creates isolated fixtures and the actual export consumed by F-019c. It may exit nonzero for unrelated known defects; inspect its results and ensure the required fixture/export completed before running the feature case. Feature runs mutate fixtures, so use fresh primary fixtures for independent full reruns. Installed Google Chrome is used; browser installation downloads previously failed. QA records are retained for investigation.

Run targeted regression tests, then `pnpm lint`, `pnpm build` and `pnpm test`. The baseline Node suite had 1,113 passes and two unrelated Windows path failures in `disabledStates.test.mjs` and `hardcodedColors.test.mjs` (`URL.pathname` produces `C:\C:\...`; suggested correction is `fileURLToPath`). Report baseline failures separately; do not hide them. Run `node tests/redesign.mjs` separately if the earlier test stage prevents it from running.

## Evidence and completion requirements

Record the fix revision, commands, browser version and results in a new QA run. Update [the tracker](e2e-test-tracker.md) and link the successful F-019c regression. Preserve the original failure and explain the resolution. Passing this child does not complete the entire F-019 family; list remaining variants honestly. Include a retro with an explicit unverified backlog as required by AGENTS.md.

## Other open findings (separate follow-up scope)

| Finding | Location | Required follow-up |
|---|---|---|
| QA-002 / V-007a: labels target wrappers instead of inputs | `src/components/ui/form.tsx` | Forward IDs/ARIA to actual controls; verify accessible names, label activation and error associations. |
| QA-003 / F-029b: unknown authenticated route is blank | `src/App.tsx` | Add intentional missing-route handling with usable navigation. |
| QA-004 / F-016b: filtered-empty wording implies no cycle transactions | `src/pages/TransactionsPage.tsx` | Distinguish no matching filters from an empty period. |
| QA-005: two Windows test path failures | Existing tests named above | Use platform-correct URL-to-path conversion and retest. |

The baseline has 44 passing and four failing browser cases plus 60 visual scans with no detected text-contrast or page-level overflow failures. This is partial coverage, not a zero-bug guarantee or complete release sign-off. Firefox/WebKit, physical devices and additional edge cases remain outstanding in the tracker.
