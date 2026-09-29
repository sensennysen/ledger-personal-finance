# Epics 8-13 phase 13 · Decision-gated tickets — retro (2026-09-26)

Branch `epics-8-13-phase-13`: LED-114, 134, 136, 138 built, LED-153 closed, LED-142 waiting for wording sign-off. Commits: decisions (`bb8f5e3`), LED-134, LED-114, LED-138, LED-136 and one fix for LED-136 found live. Lint, build and all 727 tests pass; the CI `db` steps were reproduced locally (empty-database replay of 23 migrations, `supabase db lint`).

## Ticket retros
[LED-134](2026-09-26-led-134-widget-order-default.md) · [LED-114](2026-09-26-led-114-card-payments-not-spending.md) · [LED-138](2026-09-26-led-138-saved-filters.md) · [LED-136](2026-09-26-led-136-exchange-rate-feed.md)

## Decisions (2026-09-26, product owner)
OD-1 (b) backfill exact matches only. OD-2 (b) no category, no migration. OD-3 (b) live feed, the user sets how often it refreshes. OD-4 (a) table with RLS. OD-5 (a) the owner approves the wording first. OD-6 (c) restore none; LED-153 is Won't Do, and its `ledger-last-account:<user>` key stays unread. Recorded in the register and the six CSV rows; points 33 to 22.

## LED-142 (not committed, by design)
The proposal for the owner: fix only step 02 ("Tap or click the Settings icon in the navigation bar" is wrong on a phone, where Settings sits under the avatar); leave steps 03 and 04 (they already match "Delete My Account" and "Delete Forever"); add a reading time computed from the word count (about 2 minutes, not the design's typed 4); keep the "anonymised, aggregated data may be retained" sentence that 24a drops; decide whether the "data we hold" list should name saved filters, exchange rates and receipts (LED-180).

## What this phase taught
- A ticket's premise can go stale between writing and building (LED-114). Read the code before sizing it.
- Three live-only bugs again (CSP, a hook needing a provider on a public page, `exchange_rate` defaulting to 1). None was visible to lint, build or 727 tests. Patterns added or extended: `outbound-host-needs-csp.md`, `hooks-on-public-pages.md`; rule added: `foreign-currency-rate-of-one-is-not-a-rate.md`.
- Node cannot load hooks or `@/` files, so several tests read source text to pin a rule (widget-order default, DB filters, the optional provider). They are cheap guards, not behaviour tests.

## Backlog (not verified or deferred)
- Everything in the LED-136 Backlog, first of all the mixed-currency income, expense and category totals.
- The card dialog's stale subtitle ("Posts as an expense against the card").
- The epic CSV statuses were not flipped (LED-121 rule); `.claude/launch.json` is still untracked.
- No real iOS device, no screen reader, no run of the live CI.
