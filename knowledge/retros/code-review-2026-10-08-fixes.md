# Code review fixes — 2026-10-08 (LED-322 to LED-333)

This retro covers fixes for the 12 findings of the full-codebase review on 2026-10-08. There is one commit per ticket, made directly on `main` at the owner's request.

| Ticket | Fix |
| --- | --- |
| LED-322 | `parseAmount` accepts plain decimals only. A decimal comma (`12,50`), an exponent or hex is flagged `bad-amount`. Amounts are rounded to cents, so a sub-cent line is ignored instead of failing the bulk insert. |
| LED-323 | Every sign-out button goes through `useSignOut`. If queued changes, receipts or unsaved settings would be lost, `SignOutConfirm` lists them and asks first. |
| LED-324 | `useReceiptSweep` runs once a session (online, empty queue). It removes receipt images that no `receipt_url` refers to, once they are more than a day old. Split lines share one file, so a delete cannot remove its file directly. |
| LED-325 | The build checks `VITE_SUPABASE_URL` against the CSP in `vercel.json`: the build fails on Vercel and warns elsewhere. `index.html` now lists the Supabase URL in `img-src` too. The README covers custom domains. |
| LED-326 | `update_account_balance` credits and reverses `round(amount * exchange_rate, 2)`. `transferCredit` uses exact BigInt rounding, because float rounding gave 100.12 where Postgres gives 100.13. |
| LED-327 | A new `set_account_balance` RPC locks the account and inserts the difference from the balance the server holds. A replay adds nothing. |
| LED-328 | A trigger on `error_events` allows 60 reports per user per rolling hour and prunes reports older than 90 days. |
| LED-329 | CSV export neutralises a leading tab or CR, and quotes a cell that contains a lone CR. |
| LED-330 | `resolveSplit` balances lines in the cents they are sent as. |
| LED-331 | A new `eitherAccountFilter` builds the account `.or()` filter. Any id that is not a UUID is quoted as a single value. |
| LED-332 | Account deletion retries `delete_user` after removing receipts. If it still fails, it reports that the deletion is incomplete. |
| LED-333 | `shadcn` moved to devDependencies (it is used at build time only). The vulnerable `fast-uri`, `hono` and `ip-address` overrides are bumped. CI runs `pnpm audit --prod --audit-level=high`. |

## Validation

- `pnpm lint`, `pnpm build` and `pnpm test` pass: 1227 Node tests plus the redesign checks.
- Local Supabase, with the new migrations applied via `migration up`:
  - `supabase db lint` reports no errors.
  - `supabase test db` passes 52 tests in 7 files. New files: `05_transfer_rounding` (it failed before the migration, reproducing the drift), `06_set_account_balance` and `07_error_events_cap`.
  - `concurrency.sh` passes.
  - `src/types/database.ts` matches the schema.
- In the browser against local dev:
  - With one change queued offline, Sign Out on Settings showed the confirmation. "Stay signed in" kept the session.
  - Once the change had synced, Sign Out went straight to /login with no dialog.

## Backlog

- No `supabase db reset` replay from scratch was run, so the local data was kept. CI's `db` job covers it.
- ~~Apply the three new migrations (`20261008140000`, `20261008150000`, `20261008160000`) to the hosted database before the client deploys.~~ Done 2026-10-08 by the owner with `pnpm db:push:remote`. `supabase migration list --linked` shows all three on the remote.
- The receipt sweep was tested with a fake bucket, and the local storage list was checked to return `created_at`. It was not run end to end against storage with real orphans.
- The sign-out confirmation was checked only on Settings, not on More, the mobile account sheet or Browser storage, which share the hook.
- Balances that drifted before LED-326 are not corrected; only new credits and reversals are exact.
- In dev, the console showed a CSP error for a `blob:` worker blocked by `worker-src 'self'`. It was seen in the dev server and not investigated.
- `pnpm audit` including devDependencies still reports 3 high advisories, all under `shadcn` (MCP SDK, braces, source-map-js). They never reach the browser.
- There are still no hook or component tests. The new logic is covered through pure `src/lib` functions and pgTAP.
- `knowledge/checklists/release.md` had no rows after `20261006120400`. Rows were added only for this round's migrations.
