# Ledger E2E test tracker

Created: 2026-10-06. Scope: functional correctness, visual quality, and user-facing recovery.

This is the reference inventory for writing tests and recording release verification. **Local Google sign-in passed. Selected browser scenarios: 44 Pass / 4 Fail; the four failures were fixed and retested in [QA-20261006-fixes](runs/QA-20261006-fixes/report.md). The visual scan completed 60 combinations; required coverage remains incomplete.** Existing unit/source checks and historical sweeps do not establish a pass here. An untested feature is unknown, not broken or complete.

## Status and update rules

Track test implementation separately from application behavior:

- **Coverage:** Planned, In progress, Automated, Manual. Automated requires a linked executable test; Manual requires recorded steps and evidence.
- **Result:** Not run, Partial, Pass, Fail, Blocked, Needs rerun. Partial means selected children ran but required variants remain unverified. Pass requires all listed checks and required variants to pass. Fail means an observed mismatch with the expected outcome. Blocked must name the missing prerequisite. Use Needs rerun after a relevant code, schema, or environment change.
- **Evidence:** Link the run ID, test file, artifacts, and defect when applicable. A blank evidence cell must never accompany Pass or Fail.
- **P0:** release-critical financial integrity, access, persistence, and recovery. **P1:** complete feature and visual coverage. Priorities indicate execution order, not permission to ignore failures.

Each inventory row is a test family. When implementing it, split independently failing scenarios into stable child IDs (for example F-004a create, F-004b edit). Record each child and browser/device variant in the run log. Never mark the parent Pass while a required child is failing, blocked, or untested.

A feature is **verified** only for the recorded commit and environment when every required case passes. It is **broken** when a relevant case fails; after a fix, keep that failure in history and record a successful retest before closing the defect. A passing automated test does not replace the required visual or device review.

## Environment and execution methods

1. Use local Vite and local Supabase with all migrations applied. Confirm the target is local before fixture creation or cleanup; do not reset a developer database without checking whether its data must be preserved. Never run remote database pushes for this suite.
2. Use the seeded demo account for exploration, a fresh user for onboarding, a second user for isolation, and disposable users for deletion. Keep test data isolated with unique identifiers and deliberate cleanup. Credentials belong in local configuration, not artifacts.
3. Automate browser journeys with Playwright. Exercise real authenticated Supabase reads/writes and RLS; privileged fixture setup must not become the application's access path. Use request interception only for deliberate failure scenarios, not normal success flows.
4. Calculate expected financial values independently of the application helpers. Verify the UI, authenticated persisted records, and results after reload. Include edits, deletes, undo, and double-submit prevention where relevant.
5. Fix or record the clock, timezone, locale, exchange rates, and fixtures. Seed dates are relative to the database date; keep browser and database dates aligned for recurrence and cycle tests.
6. Run P0 browser journeys on Chromium, Firefox, and WebKit. Record exact versions. Run visual checks at 390x844, 768x1024, and 1920x1080 in light and dark themes, plus narrow-phone and breakpoint checks. Add system theme, accent, and font-size variants where relevant.
7. Use real iOS Safari and Android devices for keyboard, safe-area, touch, and installed-PWA checks. Emulation/WebKit results do not count as physical-device or actual Safari results. Mark unavailable checks Blocked.
8. Retain failure traces, screenshots, relevant request/console errors, and reproduction data without tokens or personal data. Review visual baselines against the design handoff before accepting them; do not auto-accept changed screenshots.

## P0 functional inventory

| ID | Feature and actions | Expected outcome | Coverage | Result | Evidence |
|---|---|---|---|---|---|
| F-001 | Authentication: valid/invalid login, logout, refresh, expiry, protected deep links, auth failures; separate production OAuth success/cancel/error cases | Correct access and session state; useful errors; no private data after logout; production flow verified independently of dev login | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-001c, F-001d, F-001e; remaining variants unverified |
| F-002 | Fresh-user setup: confirm cycle, complete/dismiss checklist, refresh, open second browser, fail profile save | Navigation unlocks only after successful required setup; completion belongs to the user and persists across browsers | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-002a, F-002b, F-002c; remaining variants unverified |
| F-003 | Accounts: create/edit each supported type, required fields, opening balance, adjustment, default selection, deletion with linked records | Correct persisted fields and balances; invalid inputs rejected; linked-data behavior is explicit and consistent | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-003a, F-003b, F-003c; remaining variants unverified |
| F-004 | Income/expense: create, edit amount/date/account/category/type, delete, undo, reload; repeat from each entry point | Exact balance deltas; consistent Activity, account detail, Home, budget, and report values; no duplicate writes | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-004a, F-004b, F-004c, F-004d, F-004e; remaining variants unverified |
| F-005 | Transfers: create with/without fee, reject same account, edit source/destination/amount, delete and undo | Both account balances and fees reconcile; principal does not inflate income or spending | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-005a, F-005b; remaining variants unverified |
| F-006 | Card payment: dedicated form and transfer entry, partial/full payment, edit destination/amount, delete, undo | Transfer, debt, statement paid amount, and payment history agree; no duplicate payment or spending entry | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-006a; remaining variants unverified |
| F-007 | Loans: financed purchase create/edit/delete, schedules, rate limits, installment override/recalculate, repayment on/before/after due date | Schedule and stored allocation match independently calculated expectations and preview; repayment date determines split; balances reconcile | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-007a; remaining variants unverified |
| F-008 | Multiple currencies: income/expense, transfer, card/loan payment, explicit received amount, missing rates, rounding | Correct native/converted amounts and destination credit; missing rates disclosed; no silent 1:1 conversion or misleading totals | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-008a; remaining variants unverified |
| F-009 | Scheduled/recurring entries: before/on due date, end date, month end/leap year, refresh, simultaneous browsers, delete generated occurrence | Scheduled balance behavior is correct; each due occurrence posts once; card statements update once; deleted occurrence stays deleted | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-009a, F-009b; remaining variants unverified |
| F-010 | Split transaction: valid/invalid totals, categories, rounding, scheduled/recurring source, failed save | Split conserves the amount and correct balance/budget effects; schedule retained; invalid or failed operation leaves no partial corruption | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-010a; remaining variants unverified |
| F-011 | Offline queue: supported create/edit/delete, reload, reconnect, retry, conflicts, expired items, keep mine/theirs, unsupported actions | Changes survive and sync once; conflicts/expiry remain visible for review; unsupported actions explain their disabled state; no silent loss | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-011a; remaining variants unverified |
| F-012 | Failure recovery: initial and refresh reads, slow/failed saves, disconnect after submit, rapid double click, partial delete/undo | Error differs from empty; stale data and form input retained appropriately; retries do not duplicate successes; partial results accurately reported | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-012a, F-012b, F-012c; remaining variants unverified |
| F-013 | Two-user isolation: UI and authenticated requests for other user's records/receipts; same-browser account switch with cache/queue | RLS prevents unauthorized reads/writes; cached state and queued mutations never leak or apply to the wrong user | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-013a; remaining variants unverified |

## P1 functional inventory

| ID | Feature and actions | Expected outcome | Coverage | Result | Evidence |
|---|---|---|---|---|---|
| F-014 | Budgets: CRUD, spending, custom cycles, surplus/deficit rollover, reset/carry, nonmonthly periods, Add from last cycle | Correct base/carried/effective limits; deficit clamps at zero with remainder disclosed; nonmonthly rollover disabled; no duplicate budget rows | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-014a; remaining variants unverified |
| F-015 | Categories/subcategories: CRUD, duplicate names, merge, reorder, linked data | Valid hierarchy and uniqueness; merges preserve transaction associations; budgets and ordering remain consistent after reload | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-015a; remaining variants unverified |
| F-016 | Activity: combined filters, saved filters, clearing, selection, bulk actions, partial failures | Rows/counts/totals match criteria; saved state restores; bulk actions affect only intended records and report partial outcomes | In progress | Partial | [Results](runs/QA-20261006-summary.md): QA-004 failed; [Fix run](runs/QA-20261006-fixes/report.md): F-016b retest Pass; remaining variants unverified |
| F-017 | Large datasets: over 1,000 rows, desktop/mobile rendering windows, scroll to end, search, selection, duplicates, export | No silent API truncation or missing rows; full-dataset totals and exports; stable usable scrolling | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-017a; remaining variants unverified |
| F-018 | Global search: descriptions/accounts/categories/amounts, cycle/account scope, result navigation, quick actions, shortcuts | Correct grouped results and explicit scope; actions open correct forms; keyboard navigation and focus return work | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-018a; remaining variants unverified |
| F-019 | CSV import: mapping, dates/amounts, invalid rows, warnings, duplicates/override, categories, transfers/card payments, partial retry | Invalid data blocked; duplicates skipped by default; accurate preview and writes; retries do not duplicate imported successes | In progress | Partial | [Results](runs/QA-20261006-summary.md): QA-001 failed; [Fix run](runs/QA-20261006-fixes/report.md): F-019c retest Pass, exported transfers now blocked; remaining variants unverified |
| F-020 | Report/full-data exports: download, date scope, Unicode, delimiters/quotes, large dataset | Downloaded contents and totals match known records; valid encoding/escaping, meaningful filename, no truncation | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-020a; remaining variants unverified |
| F-021 | Reports: Overview/Analytics, selected cycle, independent chart lookback, empty/many-category/unrated data | Cards/table/breakdown reconcile; lookback affects only trend chart; appropriate chart forms and warnings | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-021a; remaining variants unverified |
| F-022 | Dashboard: totals, drilldowns, forecasts, upcoming bills, card health, mutation refresh, widget order/visibility, widget failure | Values and destinations correct; preferences persist; one failed widget does not break the page | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| F-023 | Savings goals: CRUD, contribution association, edit/delete contribution | Progress and pace recalculate correctly and persist | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-023a; remaining variants unverified |
| F-024 | Templates/rules: create/use/edit/delete, suggestions, deleted account/category references | Correct fields/categories applied; stale references handled visibly without invalid saves | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-024a; remaining variants unverified |
| F-025 | Receipts: attach/view/replace/remove, invalid upload, failed upload, transaction deletion | Correct attachment persists; failures recover; authorized access only; cleanup matches record lifecycle | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-025a; remaining variants unverified |
| F-026 | 13th-month pay: year, salary classification, include/exclude records, reload, second user | Correct selected-record totals; selections persist per user/year without leaking | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-026a; remaining variants unverified |
| F-027 | Preferences: currency, date/number format, pay cycle, theme/accent/font, failed saves, second browser | Correct rendering and persistence for each setting's intended scope; failures do not falsely report saved state | In progress | Partial | [Results](runs/QA-20261006-summary.md): F-027a; remaining variants unverified |
| F-028 | Notifications: permission allowed/denied, reminders, repeated sessions, Retry/Undo | Permission respected; reminders do not duplicate; notification actions perform exactly the intended operation | Planned | Not run | — |
| F-029 | Navigation: all routes, account deep links, refresh/back/forward, More, public legal pages, unknown/deleted record | Correct destination and active navigation; public pages accessible logged out; missing records/routes handled intentionally | In progress | Partial | [Results](runs/QA-20261006-summary.md): QA-003 failed; [Fix run](runs/QA-20261006-fixes/report.md): F-029b retest Pass; missing account IDs unverified |
| F-030 | Account/data deletion on disposable user: cancel, confirmation, failure, successful deletion | Cancel leaves data intact; confirmation removes user-owned records/receipts and session; failure is explicit and recoverable as supported | Planned | Not run | — |
| F-031 | PWA: install, cached startup, offline navigation, reconnect, service-worker update | Supported install works; accurate offline state; update does not lose queued data or leave incompatible stale UI | Planned | Not run | — |

## P1 visual and interaction inventory

Run across the viewport/theme matrix above. Inspect Home, Accounts, account detail, Activity, Budgets, Categories, Reports, 13th-month pay, Settings, More, Login, and all legal routes. Include loading, empty, filtered-empty, error, and populated states where applicable.

| ID | Checks | Expected outcome | Coverage | Result | Evidence |
|---|---|---|---|---|---|
| V-001 | Page screenshots against reviewed design references | Consistent spacing, alignment, hierarchy, typography, density, and semantic colors; no unexplained design deviations | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| V-002 | Narrow widths, breakpoints, landscape where supported, last row, fixed navigation/actions | No unintended horizontal scroll, overlap, clipped content, or unreachable controls | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| V-003 | Forms/dialogs/sheets/search/import/queue review with long content and mobile keyboard | Content scrolls correctly; fields and submit/cancel remain reachable; overlay stacking and dismissal work | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| V-004 | Long labels, large/negative amounts, many tags, Unicode, missing images, dense/empty content | No broken wrapping, encoding artifacts, overlapping text, or misleading truncation | Planned | Not run | — |
| V-005 | Charts: SVG labels, legends, tooltips, currencies, empty and many-category states | Readable, unclipped chart content with correct labels and totals in both themes | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| V-006 | Hover/focus/selected/disabled/loading/validation/notification states and contrast | States visibly distinct and legible; disabled reasons clear; chart text and focus rings checked beyond the existing sweep | In progress | Partial | [Results](runs/QA-20261006-summary.md): sampled visual/smoke coverage only; remaining variants unverified |
| V-007 | Keyboard-only journeys, skip link, names, focus trap/return, alerts, screen-reader spot checks | Controls reachable and operable; no keyboard trap; dialogs/errors announced; focus visible and restored | In progress | Partial | [Results](runs/QA-20261006-summary.md): QA-002 failed; [Fix run](runs/QA-20261006-fixes/report.md): V-007a retest Pass (DOM checks); screen-reader spot checks unverified |
| V-008 | Browser zoom/text enlargement, font sizes, reduced motion | Content remains usable without loss; motion preference honored | Planned | Not run | — |
| V-009 | Light/dark/system on initial load and reload; accents and OS-theme changes | No incorrect-theme flash or unreadable surfaces; theme changes propagate consistently | In progress | Partial | [Results](runs/QA-20261006-summary.md): V-009a; remaining variants unverified |
| V-010 | Real iOS Safari/Android: touch, keyboard, safe areas, scrolling, installed PWA | Controls usable on physical devices; fixed UI not obscured; results explicitly identify device/OS/browser | In progress | Blocked | [Results](runs/QA-20261006-summary.md): physical devices unavailable; remaining variants unverified |

## Supporting checks

These complement E2E results; they do not mark functional cases Pass automatically.

| ID | Check | Result | Evidence |
|---|---|---|---|
| S-001 | `pnpm lint` | Pass | [Results](runs/QA-20261006-summary.md): lint passed |
| S-002 | `pnpm build` | Pass | [Results](runs/QA-20261006-summary.md): build passed |
| S-003 | `pnpm test` | Needs rerun | [Results](runs/QA-20261006-summary.md): 1,113 passed; 2 Windows path failures (QA-005). [Fix run](runs/QA-20261006-fixes/report.md): 1,126 passed on macOS after the `fileURLToPath` fix; Windows rerun pending |
| S-004 | Local fresh-database migration/seed application, database lint, migration replay | Partial | [Results](runs/QA-20261006-summary.md): approved existing migrations and DB lint passed; fresh replay not run |
| S-005 | Existing `pnpm sweep`, including hover and Home-fold variants | Partial | [Results](runs/QA-20261006-summary.md): 60 adapted text-contrast/overflow scans; full sweep variants not run |

## Run log

Append a run; never overwrite historical failures. Store detailed evidence under a linked artifact location. Results must identify individual child cases when only part of a family ran.

| Run ID | Date/time + timezone | Commit / dirty changes | Environment + migrations + fixture/clock | Browser/device + viewport/theme | Case IDs and outcomes | Evidence / defects / blocked reason |
|---|---|---|---|---|---|---|
| QA-20261006-01 | 2026-10-06, Asia/Shanghai | Revision not captured in first attempt | Local Vite/Supabase; before root OAuth variables were supplied | Codex in-app browser | F-001a Fail: Google 401 invalid_client | [Failure screenshot](runs/QA-20261006-01/google-invalid-client.png); literal env reference sent as client ID |
| QA-20261006-02 | 2026-10-06, Asia/Shanghai | d687826b0da6f4aba5fa186ba2a5ad54b8695b7a; QA docs and untracked .pnpm-store | Local services restarted; existing database preserved; user-provided root .env | Codex in-app browser; default viewport | F-001a/b Pass: Google sign-in, reload, logout; other auth variants unverified | [Report](runs/QA-20261006-02/report.md) |

| QA-20261006-09–13 | 2026-10-06, Asia/Shanghai | d687826; QA artifacts only | Local migrated Supabase; isolated QA users; relative dates | Chrome 154, desktop journeys | 44 Pass / 4 Fail; selected children | [Case results](runs/QA-20261006-case-results.md); QA-001–004 |
| QA-20261006-visual-final | 2026-10-06, Asia/Shanghai | d687826; QA artifacts only | Local Supabase; seeded demo | 390/768/1920 widths; light/dark | 60 scans; no detected text contrast or page overflow errors | [Raw results](runs/QA-20261006-visual-final/results.json); limitations in summary |

Suggested run ID: `QA-YYYYMMDD-NN`. For each failed case record: prerequisites, exact steps, expected result, actual result, severity, screenshot/trace, linked issue, fix commit, and retest run. Distinguish product failures from test infrastructure failures and flaky tests; a retry that passes does not erase the original failure.

## Release review

- [ ] Every P0 case and required browser variant passes on the candidate revision.
- [ ] P1 feature and visual cases are complete, or remaining gaps have an explicit owner, impact, and release decision.
- [ ] No unresolved financial-integrity, data-loss, or user-isolation defect.
- [ ] Visual baselines reviewed; physical-device gaps named rather than counted as passes.
- [ ] Supporting checks pass; observed fixes retested with regression coverage.
- [ ] Run evidence and remaining risks linked below.

Current release assessment: **Not ready for sign-off: CSV import reverses expense direction; three other browser defects and two supporting test failures remain. Coverage is partial.** See the [findings and suggested fixes](runs/QA-20261006-summary.md) and [individual results](runs/QA-20261006-case-results.md).

## References and known planning constraints

- [Repository commands and local seed](../../README.md)
- [Project rules](../../AGENTS.md) and [knowledge index](../../knowledge/README.md)
- [Design handoff](../../design_handoff_ledger_ui_audit/README.md), [UI audit](../../design_handoff_ledger_ui_audit/specs/ui-audit-spec.md), and [transaction specification](../../design_handoff_ledger_ui_audit/specs/add-transaction-spec.md)
- [Existing browser sweep](../../scripts/sweep.mjs) and [Safari manual checklist](../../knowledge/checklists/safari-desktop.md)
- [CI configuration](../../.github/workflows/ci.yml)

The README's browser-local first-run description is stale relative to [useFirstRunChecklist](../../src/hooks/useFirstRunChecklist.ts), which stores completion in the profile. F-002 must test actual cross-browser persistence; do not bypass onboarding with the documented localStorage shortcut and call that onboarding coverage.

Historical audit findings and retros identify risk, not the current pass/fail state. Confirm current behavior before filing a defect. Where intended behavior is unclear, record the ambiguity and resolve it before treating the screenshot or current implementation as the specification.
