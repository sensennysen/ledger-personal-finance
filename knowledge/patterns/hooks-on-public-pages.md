# A public page that reuses app hooks needs the providers those hooks read

`useAccounts` calls `useNotify()`, which throws outside `NotificationProvider`. The data-deletion page sits outside the app layout, so adding `useAccounts` to its export card blanked the page for a signed-in user. `tsc`, lint and 606 tests were green; the live check showed a black page and the console had the error.

**Why:** nothing in the type system says which hooks need a provider, and the public pages (`/data-deletion`, `/privacy`, `/terms`, `/login`) are the only routes rendered without the layout's providers.

**How:**
1. When a public page or a component on one starts using a hook, load it signed in and read the console (`Runtime.exceptionThrown`), not only the DOM.
2. Wrap the component in the provider it needs, next to a comment saying why (`ExportDataCard` wraps `NotificationProvider`), rather than lifting providers to `App`.
3. Check what each hook reads: `useAccounts` needs notifications; `useBudgets` reads a cycle only when given one; `useTransactions` needs neither.
