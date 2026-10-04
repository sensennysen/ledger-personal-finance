# LED-11 — auth failures surfaced to the user

## Pattern
`AuthContext` owns `authError` (`src/lib/authErrors.ts`: profile / session / signout). `AppLayout` renders it with `InlineLoadError` (`actionLabel` prop added). `signOut()` returns `Promise<boolean>` and clears local data only after a successful sign-out. A `session` error survives the redirect to `/login` and is shown by `LoginPage`; it is cleared once a session appears.

## Backlog
- No design frame exists for these states ([26a] describes them in text only); banner reuses the LED-12 pattern. Confirm styling with design.
- Manual forced-failure checks not run (no browser): block `/auth/v1/logout`, `/auth/v1/token`, `profiles`.
- Context state has no automated test; only the copy helper is covered (`test:auth`).
- Profile-fetch banner shows even when a cached profile is on screen; consider suppressing when a cache exists.
- Raw `error.message` is kept in `AuthError.detail` but not rendered yet (LED-92 copy mapping / detail disclosure).
- `deleteAccount`'s final `supabase.auth.signOut()` result is still ignored (out of scope).
