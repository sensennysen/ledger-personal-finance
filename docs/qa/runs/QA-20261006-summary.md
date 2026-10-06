# Ledger QA results — 2026-10-06

**Release assessment: not ready for sign-off.** A CSV import direction defect can reverse the effect of an exported expense. Three further browser defects and two Windows test-infrastructure failures remain. No application fixes were made.

## Environment and scope

- Revision: `d687826b0da6f4aba5fa186ba2a5ad54b8695b7a`; Windows, Node 24.12.0, pnpm 12.4.2, installed Chrome 154.0.8037.94. Browser tests used Asia/Shanghai where configured. Dates are relative to 2026-10-06, not a frozen production clock.
- App: `http://127.0.0.1:5173`; Supabase: `http://127.0.0.1:54321`. No hosted database tests or remote migration pushes.
- Google sign-in was completed by the user, then callback/session persistence and logout were verified. Subsequent mutations used local seeded or dedicated QA accounts, not the user's Google account.
- The local database initially ended at migration `20261004120000`. With explicit user approval, all ten pending repository migrations through `20261006140000` were applied without resetting data. Database lint passed. Fresh-database replay was not performed on this existing database.
- Local services were restarted after being found stopped. There is no captured evidence attributing that outage to an application crash. One visual navigation aborted; the remaining cases were resumed, with the original log retained.
- Added QA scripts, pinned QA-only dependencies, screenshots, CSV exports, and reports. `src/`, `supabase/`, and the application package manifest were not edited. Local QA accounts/records were retained for investigation.

## Results

| Check | Outcome |
|---|---|
| Local Google OAuth happy path | Pass: provider sign-in, local callback, authenticated profile, reload persistence, and logout/protected-route redirect |
| Automated browser cases | **44 Pass / 4 Fail across 48 distinct cases**, using the latest valid execution of each case; see [case results](QA-20261006-case-results.md) |
| Visual scan | **60 combinations completed; 0 detected text-contrast failures and 0 page-level horizontal overflows**; 10 routes × 3 viewports × 2 themes |
| `pnpm lint` | Pass |
| `pnpm build` | Pass; large-bundle warning remains informational |
| `pnpm test` | **1,113 Pass / 2 Fail** in the Node test stage; both failures are Windows file-path handling |
| Redesign checks | Pass when executed separately as `node tests/redesign.mjs`; the combined test command skipped this stage after the preceding failures |
| Local database function lint | Pass after approved migrations |
| Firefox / WebKit / physical devices | Not verified; Playwright browser download failed, and real mobile/Safari devices were unavailable |

The browser cases cover basic account creation, transaction creation/edit/delete/undo, transfer balances/fees, card-payment linkage, an explicit cross-currency transfer, a loan repayment/allocation, splitting, scheduled disclosure, offline save/reconnect, concurrent recurrence, read/write failure recovery, account RLS isolation, budget/category/goal creation, import/export, templates, salary inclusion persistence, theme/profile preferences, and keyboard dialog dismissal. These are selected scenarios from larger test families, not complete coverage of every family.

## Confirmed failures and suggested fixes

### QA-001 — P1: Reimporting a Ledger CSV reverses expense direction

**Case:** F-019c. **Status:** Open. **Impact:** incorrect account balance and income/spending reports.

1. Export transactions using Reports > Export > CSV.
2. Use the actual export header and an expense row (`QA split first`, Type `expense`, Amount `7`).
3. Import that CSV into an empty local test account.
4. The saved transaction is `income`; the account becomes **+$7 instead of −$7**.

Evidence: [browser screenshot](QA-20261006-13/F-019c.png), [assertion result](QA-20261006-13/results.json), and [original export](QA-20261006-09/report.csv).

The inspected importer determines direction from amount sign and does not consume the exported Type column; the exporter writes positive absolute amounts plus an explicit type. Suggested fix: recognize Ledger's export schema and preserve type, account/destination, fee and currency semantics. If a schema is unsupported, block or clearly warn instead of silently interpreting it as a signed-amount bank statement. Add expense, income, transfer, fee, and multicurrency export/import round-trip tests. No importer change was made.

The earlier F-019a test only checked row persistence and numeric amount. Its pass does **not** establish correct direction; F-019c adds the missing financial assertion and makes the import family fail.

### QA-002 — P2: Form labels target non-input wrapper elements

**Case:** V-007a. **Status:** Open. **Impact:** unreliable label activation and missing programmatic field names for assistive technology.

Open Accounts > Add Account. The Account Name label's `for` attribute resolves to a `DIV`, while the nested input has a different ID. An accessible-name locator cannot find the field by that label. The shared `FormControl` implementation applies ID, invalid state, and description attributes to its wrapper rather than the control.

Evidence: [assertion result](QA-20261006-09/results.json), [form screenshot](QA-20261006-09/V-007a.png). Source: [shared form component](../../../src/components/ui/form.tsx).

Suggested fix: forward the field ID and ARIA attributes onto the actual input/select/button using a suitable composition/render mechanism; retest label click, screen-reader names, error associations, and every shared form. Do not solve this only by adding test selectors.

### QA-003 — P2: Unknown authenticated route renders a blank page

**Case:** F-029b. **Status:** Open.

Sign in and visit `/qa-page-does-not-exist`. After navigation settles, the document body contains no visible content. There is no Not Found message or route back into the app.

Evidence: [screenshot](QA-20261006-09/F-029b.png), [result](QA-20261006-09/results.json). Source: [route definitions](../../../src/App.tsx).

Suggested fix: add an explicit fallback route inside the protected route set, with a meaningful message and Home navigation. Cover stale bookmarks and missing account IDs separately.

### QA-004 — P2: Filtered-empty message implies the cycle has no transactions

**Case:** F-016b. **Status:** Open.

With three current-cycle transactions, search for `nothing-matches-qa`. The page says **“No transactions in Oct 2 – Nov 1”**, even though its action says “Show all 3.” Records are not lost, but the explanation attributes the empty view to the period instead of the search.

Evidence: [screenshot](QA-20261006-09/F-016b.png), [visible text](QA-20261006-09/F-016b.txt). Source: [Activity page](../../../src/pages/TransactionsPage.tsx).

Suggested fix: distinguish “No transactions match your filters” from a genuinely empty cycle, retaining a clear-filter action. Test combinations of search, type, account, category, and tags.

### QA-005 — P2 test infrastructure: Two existing tests fail on Windows

**Check:** S-003. **Status:** Open; not evidence of a product color/disabled-state failure.

`disabledStates.test.mjs` and `hardcodedColors.test.mjs` derive a filesystem root using `new URL(...).pathname`, producing `C:\C:\Users\...\src\` when traversed on Windows. Both fail with ENOENT before reaching their intended checks.

Suggested fix: convert file URLs with Node's `fileURLToPath`, then rerun the existing suite on Windows and Linux. Source: [disabled-state test](../../../tests/disabledStates.test.mjs), [color test](../../../tests/hardcodedColors.test.mjs). Evidence: local `QA-20261006-02/unit.log` (logs are Git-ignored).

## Resolved setup issues and excluded harness failures

- Google initially returned `401 invalid_client` because the client ID was an unresolved environment reference. The user supplied the root `.env` values; restart and retest succeeded. This is not an outstanding application defect.
- Missing local migrations caused setup/preference persistence failures. The approved migration application resolved the missing-schema condition; later profile/setup persistence checks passed.
- Early harness attempts used labels affected by QA-002, incorrect menu/Quick add selectors, and an account-row role the page does not expose. Corrected selectors were retested; these do not count as extra product defects.
- Navigation remains locked until **account + transaction + pay-cycle** setup is complete, unless setup is skipped. The early assertion expecting unlock after only account + cycle was corrected.
- Card history is written asynchronously after the transfer. Polling for the completed history row passed; the initial immediate-read failure is not counted as a defect.
- Scheduled transactions intentionally affect stored balances immediately, with a scheduled amount disclosed separately. The initial “stored balance must remain unchanged” expectation was invalid. The stored effect and visible scheduled column were subsequently verified.
- Earlier debug runs `03`–`08` and superseded cases remain as investigation history. The consolidated case file uses runs `09`–`13` with later valid results taking precedence.

## Visual verification limits

The final [scan data](QA-20261006-visual-final/results.json) covers Home, Accounts, an account-detail route, Activity, Budgets, Categories, Reports, 13th Month Pay, Settings, and More at 390×844, 768×1024, and 1920×1080 in light/dark themes. Selected screenshots were inspected visually, including mobile Activity/Settings, tablet Accounts, desktop Reports, and transaction forms.

Zero scan failures does not establish complete aesthetic correctness. The reused scan omits SVG text and focus rings; internal scrolling/offscreen content, all dialogs, long-content variants, hover states, design-baseline parity, zoom, screen readers, physical keyboards, and real mobile keyboards need further checks. One `ERR_ABORTED` navigation occurred at tablet dark 13th Month Pay; the resumed case passed. Preserve that observation if it recurs.

## Remaining verification backlog

The tracker deliberately keeps partially covered families **Partial**, not Pass. Outstanding scenarios include:

- All account types and balance adjustments; card/loan edit-delete-undo combinations, statement boundaries, cross-currency liability repayments, interest/overpayment/date-allocation edge cases.
- Offline conflicts/expiry/keep-mine/keep-theirs, partial synchronization, multiple tab races beyond the recurring occurrence tested, session expiry and cancellation, receipt cleanup/access isolation, and comprehensive two-user isolation across every entity.
- Budget rollover/deficit history, category merges/deletion, saved filters and bulk operations, rule behavior, goal contributions, dashboard ordering/hidden widgets and fault isolation, notifications, and destructive user-deletion behavior.
- Invalid and partial CSV imports, transfer mapping and full export round trips, more than 1,000 rows across every paged consumer, recurrence month-end/leap-year variants, and full salary-year calculations.
- Production PWA/offline caching/service-worker upgrade, fresh-database migration replay, hosted OAuth, Firefox/WebKit, real iOS/Android/Safari, and the full visual/accessibility matrix.

Do not treat this run as a zero-bug guarantee or complete release approval. Prioritize QA-001, then retest fixes and execute the remaining P0 variants before release.
