# Release check (by hand)

For what CI and the local stack cannot see (LED-213): the CI run on the release PR, the migrations on the hosted database, the CSP header Vercel serves, and a smoke test on the live site. Run it before every merge to `main` that adds a migration or an outbound host. Report PASS, FAIL or what you saw for each row; a FAIL becomes a ticket.

**Order matters.** Migrate the hosted database first, then deploy the client. Every transaction insert and update sends the whole value object, and the offline-queue drain selects the payload's columns, so a database without a column the client writes rejects every write, not just the new feature's (`rules/schema-changes-via-migrations.md`).

**Nothing in this list is run by an agent unless the owner asks.** `pnpm db:push:remote` and every `--linked` command touch the hosted project.

## A. CI on the release PR
| # | Do | Expect | Result |
|---|---|---|---|
| A1 | Open the release PR (for epics 15 to 19: `epics-15-19` → `main`, which also carries every epics 8 to 13 phase, see LED-212) | Both jobs run: `verify` (lint, build, test) and `db` (fresh Supabase, all migrations and `seed.sql`, `supabase db lint`, replay from scratch) || PASS: PR #10 (see run log) |
| A2 | Wait for the run, then record its link and date here | Both jobs green || PASS: run 37184349456, 2026-10-04 |

Run log:
- 2026-09-29: PR "Ship epics 8-14" (`epic-14`, #9), run [36568023009](https://github.com/sensennysen/ledger-personal-finance/actions/runs/36568023009), green. It predates every migration below; it does not cover them.
- 2026-10-04: PR "epics-15-19" (#10), run [37184349456](https://github.com/sensennysen/ledger-personal-finance/actions/runs/37184349456), `verify` and `db` green. Merged 2026-10-04.

## B. Migrations on the hosted database
`origin/main` ends at `20260810140000_allow_financed_purchase_changes.sql`, so the 16 files below are not on `main` (checked 2026-10-04 with `git fetch`). What the hosted database has applied is not known from the repo; B1 finds out.

| # | Do | Expect | Result |
|---|---|---|---|
| B1 | `supabase migration list --linked` | Lists which of the files below the remote is missing | 2026-10-05 (owner): none missing; all 30 local migrations have a Remote entry |
| B2 | `pnpm db:push:remote` | Applies the missing files in filename order, no error | Not needed (B1 found nothing missing) |
| B3 | `supabase migration list --linked` again | Local and remote columns match for every row | PASS (same B1 output, 2026-10-05) |
| B4 | Only now: deploy the client (merge to `main`, Vercel builds) | || Done: PR #10 merged 2026-10-04 after B1–B3 confirmed the remote |

Every file is idempotent, so re-running one that the remote already has is a no-op.

| Migration | Ticket | If it is missing |
|---|---|---|
| `20260920100000_add_missing_loan_account_columns` | LED epic 0 | Captures loan columns prod already has; a no-op there. A self-hosted database without it lacks `loan_original_amount`, `loan_due_day` and `loan_due_day_secondary`; no client code was traced to them (2026-10-04), so what breaks is not known. |
| `20260920100100_add_exchange_rates_and_transaction_checks` | LED epic 0 | Captures `exchange_rates` and two transaction checks prod already has. Without the table the rates context cannot read, so foreign-currency accounts drop out of totals; without the checks a zero rate or a transfer to the same account is stored. |
| `20260921100000_add_budget_deficit_behaviour_to_profiles` | LED-20 | Settings cannot save the budget deficit behaviour (`budget_deficit_behaviour` does not exist), and budgets fall back to "carry". |
| `20260925100000_cap_monthly_interest_rate` | LED-133 | Nothing visible; a request that skips the form can store a monthly rate above 10%. |
| `20260925110000_split_transaction_rpc` | LED-130 | Splitting a transaction fails (`split_transaction` does not exist). |
| `20260925110100_add_unitemised_purchase_rpc` | LED-131 | Itemising a loan's unitemised debt fails (`add_unitemised_purchase` does not exist). |
| `20260926100000_default_dashboard_widget_order` | LED-134 | Nothing fails; new profiles open Home in the old order (Upcoming Bills sixth, no Recent Transactions). |
| `20260926110000_saved_filters` | LED-138 | Saving a filter and the palette's saved filters fail (`saved_filters` does not exist). |
| `20260926120000_exchange_rate_feed` | LED-136 | The rates context selects `fetched_at` and reads `exchange_rate_refresh`, so rates do not load; the import's duplicate check selects `original_amount`, so every import fails that check. |
| `20261001100000_card_payment_follows_its_transfer` | LED-191 | Recording a card payment fails (the insert sends `transaction_id`); editing or deleting a payment's transfer leaves the statement as it was. |
| `20261003100000_card_payment_from_an_edit` | LED-230 | An edit that turns a row into a payment to a card moves the card's balance but not its history or statement. |
| `20261003110000_recurring_posts_once` | LED-232 | The recurring generator filters on `recurrence_next_posted`; the read fails and nothing posts, silently. |
| `20261003120000_transfer_destination_amount` | LED-185 | Every transaction insert and update sends `destination_amount`, so every write fails, and the import's duplicate check selects it too. |
| `20261004100000_category_name_unique_within_parent` | LED-233 | Nothing fails; duplicate category and subcategory names are accepted. |
| `20261004110000_category_counts_as_salary` | LED-236 | Saving a category fails (the form sends `counts_as_salary`), and the 13th Month page finds no salary category. |
| `20261004120000_merge_category_rpc` | LED-239 | Merging a category fails (`merge_category` does not exist). |

Epic 22 (branch `epic-22`) adds the files below. They reach the hosted database (B1–B3) before the branch merges to `main`.

| Migration | Ticket | If it is missing |
|---|---|---|
| `20261005100000_transaction_templates` | LED-257 | Activity's templates fail to load and to save (`transaction_templates` does not exist); the old browser copy stays where it is, so nothing is lost. |
| `20261005110000_error_events` | LED-258 | Error reports are not stored (the insert fails and is only logged to the console); nothing the user sees breaks. |
| `20261005120000_recurring_flag_keeps_updated_at` | LED-262 | Nothing fails; an offline edit of a recurring row that the generator posted from reports a conflict when it syncs, as before. |
| `20261006120000_profile_preferences` | LED-263 | Every preference reads as its default, and each change shows "Couldn't save your settings" (`merge_profile_preferences` and `profiles.preferences` do not exist); the old browser copy stays, so nothing is lost. |
| `20261006120100_dashboard_hidden_widgets` | LED-264 | Every Home widget shows, and hiding one shows "Couldn't save your settings" (`profiles.dashboard_hidden_widgets` does not exist); the old browser copy stays. |

When this list grows: add the row in the same commit as the migration, with the client query or call that needs it.

## C. CSP on Vercel
The policy is two strings that nothing compares: the `<meta>` in `index.html` (dev server) and the header in `vercel.json` (production). See `patterns/outbound-host-needs-csp.md`.

| # | Do | Expect | Result |
|---|---|---|---|
| C1 | `curl -sI https://<production host>/ \| grep -i content-security-policy` | The value equals `vercel.json`'s `Content-Security-Policy` exactly || PASS (owner, 2026-10-05) |
| C2 | Read `connect-src` in that header | Has Supabase (`https://*.supabase.co`, `wss://*.supabase.co`), `https://accounts.google.com` and `https://api.frankfurter.dev` || PASS (owner, 2026-10-05) |
| C3 | Compare `index.html` with `vercel.json` | They differ only in `%VITE_SUPABASE_URL%` (meta only) and `frame-ancestors 'none'` (header only; browsers ignore it in a meta) || PASS (owner, 2026-10-05) |
| C4 | On the live site, open Settings and refresh rates; watch the console | No "Refused to connect" || PASS (owner, 2026-10-05) |

"Creating a worker from 'blob:…' violates … worker-src 'self'" on the **dev server** is expected (LED-259). After the dev server restarts, Vite's client (`waitForSuccessfulPing`, vite 8.3 `dist/client/client.mjs`) starts a `SharedWorker` from a `blob:` URL to wait for it; the policy blocks it, so the page does not reload by itself. Reload by hand. The production bundle creates no worker: the only `new Worker` in it is Supabase Realtime's heartbeat, which is off unless `realtime.worker` is set, and Ledger opens no Realtime channel. Do not add `blob:` to `worker-src` for it.

| C5 | On the live site, signed in, open Home, Activity, Reports and Import; watch the console | No "violates the following Content Security Policy directive" || |

## D. Smoke test on the live site
With a real account, after B and C. Undo what you add.

| # | Do | Expect | Result |
|---|---|---|---|
| D1 | Add an expense, edit it, delete it | Each saves; the balance moves and moves back || PASS (owner, 2026-10-05) |
| D2 | Add a transfer between two accounts | Saves (covers `destination_amount`) || PASS (owner, 2026-10-05) |
| D3 | Import a short CSV that repeats an existing row | The duplicate is flagged (covers `original_amount`) || PASS (owner, 2026-10-05) |
| D4 | Pay a credit card from an account | The payment shows in the card's history and statement || PASS (owner, 2026-10-05) |
| D5 | Open Home with a recurring row due | It posts once; reload in a second browser and it does not post again || PASS (owner, 2026-10-05) |
| D6 | Merge one test category into another, save a filter, open 13th Month | Each works || PASS (owner, 2026-10-05) |

## Report back
Paste the Result columns and the CI run link. They go into the release's retro, with a ticket for each FAIL.
