# A cycle total stops at today
A row dated after today is scheduled (LED-238). It shows in lists but is not counted until its date arrives. Any new total over a cycle or period must end at `countedEnd(end, today)` from `src/lib/countsYet.ts`, not at the cycle's end.
**Why:** a cycle runs to its end date, so a total over `[start, end]` counts the rent entered for next week today. LED-238 had to find ten sites by hand; a new one that forgets the cap brings the bug back on one screen only.
**How:**
- Cap the range end, don't filter rows: `sumX(rows, start, countedEnd(end, today))`. A closed range is unchanged, so past cycles need no special case.
- `today` is `getLocalDateString()` (local, never UTC), read at render and listed in the memo dependencies. Don't store it or a "counted" flag.
- Where a total is shown for the open cycle, show the rest apart as "+ X scheduled" (`scheduledIn`). Name unrated currencies from both parts.
- Lists keep every row and mark the later ones with `countsYet(tx.date, today)`.
- A pure helper that already takes a range (`sumBudgetSpend`, `summarizeRange`) stays range-based. The caller caps it, so suggestions and history built on closed periods are untouched. `computeOverspending` takes `countUntil` for the same reason.
- Previous-period comparisons use `likeForLikeWindows` (LED-237). Its current window ends at today, so it agrees with the cap.
- Account balances are not cycle totals. They come from database triggers (see LED-251).
