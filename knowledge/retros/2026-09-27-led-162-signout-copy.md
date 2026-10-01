# LED-162 · Sign-out copy matches what happened — retro (2026-09-27)

## What shipped
- `AuthContext.signOut()`: local cache, offline queue and pending receipts are cleared unconditionally now, before checking whether `supabase.auth.signOut()` itself failed. The boolean return still distinguishes "server confirmed" from "local only," but no longer gates the clear.
- `authErrors.ts`: the `signout` message no longer says "You're still signed in on this device." It now says the device is signed out and the session may stay open elsewhere until it expires.
- `knowledge/patterns/surface-auth-and-read-failures.md` updated to describe the new contract, so the next reader isn't pointed at the superseded one.

## Acceptance (live re-run: headless Chrome over CDP, seeded user, `Network.setBlockedURLs` on `*auth/v1/logout*`)
- (a) Sign out with `/auth/v1/logout` blocked lands on `/login` with a message that matches what happened: **PASS, live**. The request fired (`Network.requestWillBeSent` for `/auth/v1/logout?scope=global`), was blocked (`blockedReason: "inspector"`), `console.error` logged "Sign out could not reach the server: Failed to fetch", and the app landed on `/login`.
- (b) the message does not say "still signed in": **PASS, live** — the page read "Signed out on this device. We couldn't reach the server, so your session may stay open elsewhere until it expires." Also PASS via `tests/authErrors.test.mjs`.
- (c) local cache, queue and pending receipts are cleared, or the user is told why they were kept: **PASS, live** — `localStorage` after sign-out held only `ledger-accent-color`, `ledger-font-size`, `ledger-theme`; `sb-127-auth-token` was gone.
- (d) unit test for the error mapping: PASS — `tests/authErrors.test.mjs`.
- (e) LED-11 acceptance still holds ("all three surface to the user; sign-out failure is explicit"): PASS — sign-out failure still sets `authError` and is still shown; only the wording and the clear-data gate changed.

## Backlog
- **First live attempt gave a false negative**: blocking `/auth/v1/logout` from a CDP client that then disconnected (`client.close()`) let the block lapse before the click — Chrome scopes `Network.setBlockedURLs` to the attached debugger session. Re-running block + click + observe over one persistent connection reproduced the failure correctly. Noting this so a future sweep script doesn't split those steps across connections.
- The `signout` action label stays "Try again" (`authErrorActionLabel`), which reads oddly against the new, non-error-sounding message; not changed since the ticket's AC doesn't ask for it and `AppLayout`'s retry button for this kind is effectively unreachable (the shell unmounts once `session` is null). Worth a copy pass if it looks wrong live.
