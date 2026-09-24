# Surface failures
- Reads: `resolveLoadState` (`src/lib/loadState.ts`); hooks must clear `error` on the next successful fetch (LED-12).
- Auth: `AuthContext.authError` rendered by `AppLayout` via `InlineLoadError`; `signOut()` returns a boolean and clears local data only on success (LED-11).
- Data errors: never show `error.message`. Hooks map through `describeDataError` / `toResult` (`src/lib/dataErrors.ts`): `error` is the plain sentence, `errorDetail` the raw text. Reads keep one `loadFailure` state and derive both. Show the detail collapsed: `ErrorState description={error} detail={errorDetail}`, `<FormError error={...} />` with a `FormErrorValue` state (`{ message, detail }` or the app's own string) (LED-92).
- Outcomes: `useNotify()` (`src/contexts/notificationState.ts`) is the one surface. success + Undo closes itself; failure + Retry and partial + Fix stay. A two-step write that half-succeeds is a partial whose Fix reruns only the missing steps — see the card payment in `AccountTransactionsPage` (LED-93).
- Crashes: `ErrorBoundary` wraps page content and entry detail, so the shell survives; `variant="app"` in `App.tsx` is the last resort (LED-93).
