# LED-239 · Merge categories — retro (2026-10-04)

Branch `epics-15-19`. Epic 21, phase B. Decision OD-13 item 8, design 8a: "Merge into…" in the category's detail, one atomic call.

## What was built
- **Migration `20261004120000_merge_category_rpc.sql`.** `merge_category(p_source, p_target) returns jsonb`, SECURITY INVOKER, with the same grants as `split_transaction`.
  - **Locks.** Both rows are locked in id order. A missing row, or another user's under RLS, raises "Category not found.".
  - **Refusals.** It refuses merging a category into itself, and refuses a target that can't take the source's rows: it must be the same type or 'both'. Without that, `loan_purchases`' expense-only trigger would fail part-way.
  - **Subcategories, one at a time in order.** One whose name the target has (LED-233 comparison) folds in: its transactions move to the target's subcategory and it is deleted. Others move under the target after its own. Duplicates the source kept from before LED-233 fold into the first of them; a single `update … set category_id` would have tripped the name trigger.
  - **Everything else.** Transactions, budgets, rules and financed purchases move, then the source is deleted. Budgets and subcategories cascade on delete, so they move first.
  - **Result.** Every exception carries hint `user-message`, and the function returns the counts that moved.
- **`src/lib/categoryMerge.ts`.** `mergeTargets`, `planSubcategoryMerge` (mirrors the loop), `mergeSentence` / `mergedSentence`, `budgetNote`, `parseMergeResult`. Tests in `categoryMerge.test.mjs` (7) use the psql result as literals.
- **`useCategories`.** `previewMerge` (parallel head counts, plus both categories' subcategories run through `planSubcategoryMerge`) and `mergeCategory` (refused offline, one rpc, refetch).
- **`CategoriesPage`.**
  - "Merge into…" sits at the foot of the category detail, in the xl pane and under the row below xl. It is hidden when no category can take this one's rows.
  - The dialog has a target Select, the sentence of what moves, the two-budgets note and "This can't be undone." Merge is disabled offline, with the reason shown.
  - On success: refetch usage and rules, select the target, and post a success notice in the past tense.
  - On failure: the dialog closes and a failure notice offers Retry, which reruns the same call.

## Decision (plan item 20)
- **Two budgets for one category: both move and are kept.** Budgets already allow several per category, and nothing is lost. The confirmation says "Merge tgt will have 2 budgets. Review them in Budgets." and the notice says "now has". The target keeps its own type, colour and salary flag.

## Acceptance
- **(a) One atomic call; a failure changes nothing: PASS.**
  - psql: a forced failure at the budgets step (a temporary trigger) left the source, its 4 transactions and 3 subcategories in place.
  - The refusals (into itself, expense into income-only) change nothing.
- **(b) The confirmation shows the counts that move: PASS.** Browser at 1280: "Moves 2 transactions, 2 subcategories (1 joins one of the same name) and 1 budget to Merge tgt, then deletes Merge src." plus the two-budgets note. After the merge SQL agreed: 2 transactions on the target, subcategories `market:0, Stalls:1`, both budgets.
- **(c) No transaction is left on the deleted category: PASS.** psql: 0 on the source after the merge, and the source row is gone.
- **(d) Another user's category is not found: PASS.** psql as a second user: "Category not found."
- **(e) Refused offline: PASS.** With the app offline, the dialog says "Connect to the internet to merge categories." and Merge is disabled; the hook also refuses before calling.
- **(f) The migration applies:** applied with `migration up --local`. The from-scratch replay runs at validation.
- **(g) psql checks and a browser check: PASS.**
  - The account balance is unchanged by the merge (6973.80 before and after in psql). Moving `category_id` fires no balance, loan or card trigger.
  - Failure path in the browser: a stubbed 500 on `/rpc/merge_category` closed the dialog with "Couldn't merge Merge src 2…" and Retry, and Retry merged it.
  - At 375 the dialog keeps a 25px gutter, with no sideways scroll.
  - Test categories were removed afterwards; the balance is back to 7123.80.
- `supabase db lint` clean; `pnpm lint`, `tsc -b` and `pnpm test` (920 passing, plus `tests/redesign.mjs`) are green.

## Found in passing
- **A base-ui `SelectValue` without a render function shows the raw value** (the id) once chosen. Fixed in the merge dialog with the render-function form SettingsPage uses. The auto-categorization rule form's category Select likely has the same issue; not checked.
- **The merge notice's generic failure copy** ("Couldn't save this category. Try again.") comes from `toResult` for an unclassified error.

## Backlog
- The rule form's category Select may show the raw id once chosen (above).
