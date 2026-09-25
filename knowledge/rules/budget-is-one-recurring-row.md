# A budget is one recurring row, not a row per cycle

`budgets` holds one row per budget (`start_date`, `amount`, `period`, `rollover_enabled`). Every active budget shows in every cycle; the cycle only decides which transactions and which rollover it is computed from. `end_date` is stored and never read.

**Why:** design 4b draws "Copy last cycle" as if each cycle had its own set of budgets. LED-139 found nothing to copy; the button became "Add from last cycle" (budgets for categories spent in last cycle that have none). Any wording that assumes per-cycle rows needs a decision first.

**How to apply:**
1. Before building a "copy", "duplicate" or "carry" action for budgets, check whether it means creating rows or changing amounts, and say which.
2. Cycle-specific figures (spent, rollover, effective limit) are computed in `useBudgets` and `lib/budgetHistory.ts`; do not store them.
3. Totals across budgets add only monthly budgets in one currency (`lib/budgetSummary.ts`); a weekly or yearly limit is not "this cycle's budget".
