# Surface failures
- Reads: `resolveLoadState` (`src/lib/loadState.ts`); hooks must clear `error` on the next successful fetch (LED-12).
- Auth: `AuthContext.authError` rendered by `AppLayout` via `InlineLoadError`; `signOut()` returns a boolean and clears local data only on success (LED-11).
