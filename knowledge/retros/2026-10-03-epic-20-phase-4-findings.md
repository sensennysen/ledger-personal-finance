# Epic 20 · Phase 4 sweep findings (LED-224 to LED-231) — retro (2026-10-03)

Branch `claude/jolly-faraday-swv39i`, from `a76e1f6` (the phase 4 retro, same commit as `epics-15-19`). One commit per ticket, in the order the phase 4 retro suggested: money first, then the written-rule break, then layout and contrast.

## What shipped
| Ticket | Commit | Change |
|---|---|---|
| LED-225 | `3f05803` | `matchDuplicates` also keys a transfer or loan repayment that carries `original_amount`/`original_currency` on those values, by direction, and tries that bucket right after the expense originals. The converted-amount bucket stays for rows with no original. |
| LED-230 | `90ef5db` | Migration `20261003100000_card_payment_from_an_edit.sql` replaces `sync_card_payment_on_transfer_update`: when an edit makes a row a transfer into a credit card it was not already paying, the trigger inserts the linked payment row, shifts the statement and points `last_payment_*` at the card's latest payment. An edit to a transfer that already went to the same card adds nothing, so an unlinked pre-LED-191 payment is never recorded twice. TransactionsPage now refreshes accounts and card payments after such an edit, as the account page does. Rule `card-payment-is-a-transfer.md` item 5 updated. |
| LED-224 | `0e4353b` | `useDashboardData` keeps the category breakdown's `excludedCurrencies` (it kept only `.rows`). The Home card (ranked, pie and empty states) and its detail dialog show `UnratedCurrencyNotice` ("Excludes … expenses — no exchange rate set."). |
| LED-228 | `6c8a80d` | `TabsTrigger` inactive labels use `text-muted-foreground` in both themes, not `text-foreground/60` in light. Test: the trigger carries no foreground opacity. |
| LED-231 | `40a9425` | The account page's list and side column sit side by side from `xl`, not `lg`. Below 1280 the side column stacks above the list; the loan summary keeps its own two columns from `lg`. |
| LED-226 | `a1e8167` | The base `DialogContent` drops `sm:w-full`: it stays `100vw - 2rem` and each dialog's `max-w-*` caps it. |
| LED-227 | `c12bca1` | `topCategories` shows a single leftover category by name, so Other always stands for two or more. Tests for five and six categories, and that `rollupBreakdown`'s Other never holds fewer than two. |
| LED-229 | `b47ff45` | The saved filter's name button uses the solid `ring-ring`. Test: a `ring-ring/50` always comes with `border-ring` (ScrollArea's viewport exempt, LED-207 Backlog). |

The plan offered LED-230 either as a client step in `useCardPayment` or as a trigger branch; the trigger was taken. It covers the online edit, a queued edit draining, and a destination moved between two cards, in the same statement as the edit, and leaves `useTransactions` untouched.

## Checks
`pnpm lint`, `pnpm build` and `pnpm test` (825 passing, plus `tests/redesign.mjs`) are green at `b47ff45`. The new tests in `importDuplicates`, `themeContrast`, `categoryBreakdown` and `focusRing` each fail on the code before their fix. `supabase db lint --local --level warning --fail-on error` finds nothing, and `db reset` replays every migration and the seed onto an empty database.

Browser checks ran on a local Supabase (fresh `db:reset`), the Vite dev server and headless Chromium (Playwright), signed in as the seeded demo user with a token in `localStorage`. Drivers and raw output stayed in the session scratchpad; screenshots are in `shots/`.

| Ticket | Criterion | Result | Evidence |
|---|---|---|---|
| LED-225 | (a) same file at another rate flags its transfer rows | PASS | A EUR statement imported into Everyday Checking at 1.17 (row 1 transfer to High-Yield Savings, row 2 transfer from it, row 3 Cafe Paris), then opened again at 1.05: "Import row 1/2/3 anyway" all unticked, "Matches 2026-09-28 · transfer to High-Yield Savings · $117.00", "· transfer from High-Yield Savings · $58.50", "· Cafe Paris · $23.40"; button "Import 0 rows". `shots/225-reimport-rate-105.png` |
| | (b) inbound transfer still matched by the amount that arrived | PASS | Unit test, and row 2 above |
| | (c) unit tests, outbound and inbound | PASS | 3 tests; 2 fail before the fix |
| | (d) re-run LED-188 3c | PASS | The run above is 3c on the demo user (USD account, EUR statement) |
| LED-230 | (a) Expense → Transfer to a card creates one linked payment and moves last payment and statement | PASS | 390, "Visa payment" 650.00: Transfer → Expense: linked 1 → 0, Visa last 650.00 2026-09-10 → 2026-08-10; Expense → Transfer to Visa Platinum: linked 0 → 1, last back to 2026-09-10; the card page shows "Last payment: $650.00 on 2026-09-10" and the 09-10 history row. `shots/230-card-after-390.png`. psql matrix case 2 with a locked statement of 1,000: paid 0 → 650.00 |
| | (b) savings → card adds the payment; card → savings removes it | PASS | psql matrix cases 4 and 6: a 120.00 transfer moved onto the Visa gets one linked row, paid 120.00, last 120.00 2026-09-20; an amount edit to 150 moves the same row (case 5); moved back to savings the row goes and last returns to 650.00 2026-09-10. Case 3, Visa → a second card: the Visa row goes, the other card gets one, its paid amount clamps at its 400 statement |
| | (c) a queued edit gets the same result on drain | PASS | Real network cut (`context.setOffline`), both edits queued as `update` items; before drain nothing moved, after drain: Expense linked 0 / last 2026-08-10, Transfer linked 1 / last 2026-09-10 |
| | (d) balances unchanged from today | PASS | Checking 6101.90 throughout; Visa -1158.74 → -1808.74 → -1158.74; psql case 9 round trip equal |
| | (e) re-run LED-208 kind switch | PASS | The 390 run above |
| | legacy unlinked payment | PASS | psql case 7: unlink the 09-10 payment, edit the amount: still one row for 2026-09-10, no insert |
| LED-224 | (a) ranked, pie and dialog name the left-out currency | PASS | A JPY wallet with a ¥3,000 Food & Dining expense on 2026-10-02, no stored rate, feed aborted. Pie (one USD category): card and dialog read "Excludes JPY expenses — no exchange rate set."; ranked (14 USD categories): the same on the card and dialog. `shots/224-card-ranked.png`, `shots/224-detail-pie.png` |
| | (b) absent when every currency has a rate | PASS | Override JPY 150: no notice on Home; Food & Dining includes the converted $20.00 |
| | (c) re-run LED-188 4c | PASS | As (a), on the demo user (USD default, JPY in place of EUR/USD) |
| | (d) single-currency user sees no change | PASS | JPY rows removed: no notice anywhere on Home |
| LED-228 | (a) inactive tab labels 4.5:1 on every tab list, both themes | PASS | 1280, rendered colour on the rendered background: light 5.55:1 (card, checking, loan, Activity, Reports, Budgets, Categories), 7.13:1 (Reports view switch, Home cash flow); dark 6.38 to 7.85:1. Before: 3.55:1. `shots/228-account-card-light-1280.png` |
| | (b) active tab still reads as active | PASS | Active label 8.97:1 (light) / 8.3:1 (dark) on the accent fill `rgb(228,231,245)` / `rgb(51,60,92)`; inactive tabs have no fill |
| | (c) token test | PASS | `themeContrast.test.mjs` |
| | (d) re-run the LED-207 account page scan | PASS | Text walker on the card, checking and loan pages, light and dark: 327, 417 and 32 text elements, none below its threshold |
| LED-231 | (a) list ≥ 560px at 1024, result bar one or two lines | PASS | 1024: list 688px (was 344), result bar 56px tall (one row of count and actions). `shots/231-card-1024-top.png` |
| | (b) search shows its placeholder | PASS | Search 454px (was 110), placeholder fits |
| | (c) 1280 and 1920 unchanged | PASS | 1280: list 600 + side 320, side by side (LED-209 measured 600); 1920: 760 + 320 |
| | (d) loan and checking at 1024 | PASS | Same 688px list for checking and the loan's Activity; the loan Summary keeps its two 468px columns |
| | (e) re-run LED-209's 1024 measurement | PASS | As above |
| LED-226 | (a) ≥ 16px each side at 640, 700, 768, 799 | PASS | Import dialog: 16px at 639, 640, 700, 768, 799 and 800 (was 0 from 640 to 768) |
| | (b) 375 and 1280 unchanged | PASS | 375: 343 wide, 16px; 1280: 768 wide, 256px |
| | (c) the other capped dialogs at the width that equals their cap | PASS | The live popup's cap swapped for each one the app sets (`max-w-sm`, `-md`, `-lg`, `-2xl`, `sm:max-w-md`, `sm:max-w-[720px]`, the card payment's `min(720px, 100vw-3rem)`, `lg:max-w-3xl`), measured at the cap and 16 and 32px past it: every gutter ≥ 16px (24px for the card payment). `shots/226-import-768.png` |
| | (d) re-run LED-206's import item | PASS | As (a) |
| LED-227 | (a) five categories, five named rows | PASS | Activity at 1024, search SWEEPFIVE: Education, Entertainment, Food & Dining, Groceries, Health & Medical. `shots/227-rail-sweepfive-1024.png` |
| | (b) six or more show Other with the right count | PASS | SWEEPSIX: four rows and "Other, 2 categories $90.00" |
| | (c) unit test | PASS | `categoryBreakdown.test.mjs` |
| | (d) the Reports card agrees | PASS | `rollupBreakdown` only rolls up above 12 rows, so its Other holds at least 5; test added |
| LED-229 | (a) focus indicator ≥ 3:1 against the dialog, light and dark, default and `#eab308` | PASS | Keyboard focus (`:focus-visible` true), 3px solid ring: light 5.39:1 (default) / 6.14:1 (`#eab308`), dark 7.39:1 / 8.9:1. Before: 2.07:1 and 2.94:1. `shots/229-focus-light-default.png` |
| | (b) no layout shift on focus | PASS | Bounding box identical before and after focus |
| | (c) re-run the LED-207 focus check | PASS | As (a) |

**Total: 34 PASS · 0 FAIL · 0 not checkable.** One new finding, filed as LED-232 (below).

## New finding → LED-232
Recurring rows are posted again by every browser that has not posted them. `generateDueRecurring` remembers what it posted only in `localStorage` (`ledger-recurring-generated`). Each fresh Playwright context in this validation, signed in as the demo user on 2026-10-03, posted another "Gym membership" for that day: three copies after three runs. A second device, a private window or cleared site data does the same. Each copy is `is_recurring` itself, so the copies post their own next dates too. Not caused by this epic: the code dates from before it. Filed as LED-232 (High, 5 pts) in the epic 20 CSV and the build order's findings table. The three rows were deleted by id, and later runs pre-set the marker so the checks ran on stable data.

## What went well
- Every acceptance criterion was re-run in the environment its sweep used. Each FAIL from phase 4 now has a measured PASS beside the number it failed with.
- The LED-230 trigger was proven in psql against nine cases before the UI run. The UI run and the offline run then matched psql exactly.
- Each new unit test was run against the old code first and failed there.

## What to change
- **The sweeps never opened Ledger in two browsers.** One context per sweep hides anything stored per browser. LED-232 surfaced only because this validation opened a context per check. Added to `browser-check-with-local-user.md`.
- **Computed colours are not always `rgb()`.** Chromium reports a `ring-ring/50` shadow as `oklab(…)`, so a regex for `rgb()` reads nothing. The contrast helper now parses any colour through a 1×1 canvas. Added to `rendered-contrast-scan.md`.
- **The transaction form's labels do not name their Base UI comboboxes,** so `getByLabel('Kind')` finds nothing. The driver tagged the combobox next to the label. This is an accessibility gap only if a screen reader also misses the name; not checked here (LED-179 owns the screen-reader pass).

## Backlog
- **LED-232** (above) is To Do.
- **Imported transfers into a credit card** (phase 4 Backlog, still open): the import's transfer picker lists "Transfer to Visa Platinum". An import inserts, and the LED-230 trigger runs only on update, so such a row gets no payment row. Not checked.
- **The transaction form's comboboxes and their labels** (above): check them in the LED-179 screen-reader pass.
- **The sticky result bar runs 24px past the list column** on the account page (736 against 688 at 1024; 648 against 600 at 1280). It did so before LED-231. Layout looks intended; not measured against the design.
- **`last_payment_*` after an edit follows the card's latest payment by date** (the trigger's `card_statement_refresh_last`), while a create sets it to the new payment. The two agree except when an older-dated transfer becomes a payment; then the edit leaves the newer payment showing, which is the more correct reading.
