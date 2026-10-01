# LED-33 — Page width caps dropped on Accounts, Reports, 13th Month

## Pattern
The caps were only `max-w-*` + `mx-auto` on each page's root div; `AppLayout` imposes none. Removing them needs `lg:px-8` for gutters and explicit grids, not new components. Grids use `minmax(0,…)` tracks so wide children (tables, charts) cannot blow out a column.

## Decisions
- Accounts: card grids go to 4 columns at `2xl`. The assets/liabilities side-by-side comparison stays with LED-76.
- Reports: caps removed, main grid tracks wrapped in `minmax(0,…)`, ratio kept at 1.6fr / 1fr. Control dedupe stays with LED-70.
- 13th Month: records table left, sticky 420px summary right, from `xl` (1280px) up. `lg` was tried first, but at 1024px the table would get about 500px. `max-w-prose` on the two prose paragraphs.
- Other pages still capped (Categories, Transactions, AccountTransactions at `max-w-3xl`) are outside this ticket.

## Backlog
- Manual browser check not run at 1920 / 1280 / 1024 / 390 for any of the three pages. Accounts and 13th Month have no 1920 design frame, so the layouts follow the spec text only.
- 13th Month: tab order and DOM order with the `xl:order-*` swap not checked with a keyboard.
- Reports: cards that sit alone on a wide row at 1920 were not audited for an explicit grid.
- Categories, Transactions and AccountTransactions keep `max-w-3xl`; not in LED-33's scope.
