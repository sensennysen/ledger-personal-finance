# A public page that reuses app hooks needs the providers those hooks read

`useAccounts` calls `useNotify()`, which throws outside `NotificationProvider`. The data-deletion page sits outside the app layout, so adding `useAccounts` to its export card blanked the page for a signed-in user. `tsc`, lint and 606 tests were green; the live check showed a black page and the console had the error.

**Why:** nothing in the type system says which hooks need a provider, and the public pages (`/data-deletion`, `/privacy`, `/terms`, `/login`) are the only routes rendered without the layout's providers.

**How:**
1. When a public page or a component on one starts using a hook, load it signed in and read the console (`Runtime.exceptionThrown`), not only the DOM.
2. Wrap the component in the provider it needs, next to a comment saying why (`ExportDataCard` wraps `NotificationProvider`), rather than lifting providers to `App`.
3. Check what each hook reads: `useAccounts` needs notifications; `useBudgets` reads a cycle only when given one, and the exchange rates through `useOptionalExchangeRates()`; `useTransactions` needs neither.
4. A hook that must also run on a public page reads an optional context (`useContext` without the throw) and does without it. LED-136 made `useBudgets` require the rates provider and blanked `/data-deletion` again; the export card does not need converted spend, and wrapping `ExchangeRatesProvider` there would fetch rates from a third party on a legal page. `tests/exchangeRates.test.mjs` pins it.
5. Before adding a hook to `ExportDataCard`, grep its imports for anything besides `useAuth`, `supabase` and plain lib helpers — a context hook (`useNotify`, `useOptionalExchangeRates`, etc.) is the tell. `useSavingsGoals()`, `useLoanPurchases()` and `useTransactionRules(true)` (LED-180) only need `useAuth`, so they were safe to add with no new provider. `useSubcategories(categoryId)` is *not* a fit for an export card even though it's provider-safe: it reads one category's subcategories, not "every subcategory for this user" — exporting all of them needs a new query, not this hook. Grepping is not proof by itself (this file's own opening story is tsc/lint/tests staying green while the page blanked) — say so in the retro's Backlog when a live check wasn't run, rather than call it verified.
