# LED-152 · Categories desktop screen (8a) and the width caps — retro (2026-09-25)

## What shipped
- `lib/categoryUsage.ts` (pure): `buildCategoryUsage` (this cycle's spend by side, share base, all-time transaction count, per-subcategory spend, unrated currencies), `shareOf`, `unusedCategoryIds`, `subcategoryCounts`, `deleteCostSentence`.
- `useCategoryUsage`: every categorised transaction on narrow columns through `readAllPages`, plus subcategory counts. A failed read leaves `usable` false, so rows show a dash and never zero.
- `CategoriesPage`: rows carry Subcategories, Spend, Share and Transactions (md and up; a summary line on a phone). From xl the selected category opens in a pane beside the list; below xl the same `CategoryPane` opens under the row. Tabs are Expenses, Income, Unused. A labelled "Auto-categorize" button shows the rule count. The delete confirmation states how many transactions it will uncategorize. The page's cap is `max-w-3xl xl:max-w-6xl`.
- `useTransactionRules` now reports a failed read (`error`, `refetch`) and the page loads it on mount.

## Decisions
- "This cycle" is today's cycle: the Categories header has no stepper.
- A `both` category shows spend on the side of the active tab; Unused shows a dash for spend.
- The category Delete stays on the row; the pane does not repeat it.
- Merge and the single Reorder control stay Parked; the … menu keeps Rearrange.

## Width caps: keep or remove
| Page | Cap | Decision |
|---|---|---|
| Categories | `max-w-3xl` | **Changed**: `max-w-3xl xl:max-w-6xl`, list plus pane. |
| Activity (`TransactionsPage`) | `max-w-3xl` | **Keep.** At 1920 the list has a month-jump rail beside it (viewed live, light theme); the detail pane is LED-99's and was not opened in this check. |
| Account detail | `max-w-3xl lg:max-w-6xl` | **Keep.** It already widens and has a rail. Viewed at 1280 and 1920 (LED-289, 2026-10-06): the content is 1152px at both, a 480px list beside a 320px side column, no horizontal scroll. 4a's 400px column assumes no cap; at the cap it would shrink the list to 400px. Owner kept the cap. Screenshots: `shots/289-account-1280.jpg`, `shots/289-account-1920.jpg`. |
| Budgets | `max-w-6xl` | **Keep.** The tiles and table fit comfortably at 1152px (viewed live at 1920, light). |
| Settings | `max-w-6xl` | **Keep.** Two-column grid. Decided from the code; not viewed at 1920. |

## Acceptance
- (a) At 1280 and above a grid with a detail pane, rows show spend, share, transaction count, subcategory count: PASS live at 1440 (Groceries: 2 subs, $1,012.40, 41%, 5).
- (b) Auto-categorize labelled with the count, the category's rules in its pane: PASS live ("Auto-categorize 2"; "2 rules assign transactions to Groceries").
- (c) An Unused tab: PASS live (6 categories).
- (d) Delete states the count: PASS live ("...and its 2 subcategories. 5 transactions will become uncategorized."; "No transactions use it." for Education).
- (e) Each cap decided and recorded: PARTIAL. All five decided above; Account detail and Settings were not viewed at 1920.
- (f) 1920, 768, 390, both themes: PARTIAL. Viewed at 1440, 768 and 375 in dark; contrast scans at 1920 and 375 in light found only the inactive "Income" and "Unused" tab labels (3.55:1, the known Tabs issue from LED-116).
- (g) Lint, build, test: PASS (589/589).

## Backlog
- Screenshot Categories at 1920 in both themes.
- The all-history usage read is up to about 16k rows at the stated ceilings (paged, 1,000 per request). If it is slow, move it to an RPC.
- 8a's "Filter categories…" box, the phone "category screen", and Merge are not built.
- Rows are tall on a phone because the type and Default badges wrap.
- The Unused tab is a category-level view; deleting from it uses the same row action.
- Inactive tab labels fail 4.5:1 in the light theme (shared `TabsTrigger`, `text-foreground/60`); already a LED-116 Backlog item, now also on Categories.
