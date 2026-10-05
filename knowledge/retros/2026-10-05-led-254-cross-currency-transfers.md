# Epic 15 · LED-254 — cross-currency transfers saved before LED-185 — retro (2026-10-05)

Branch `main`. Docs and a read-only query; no app code.

## What was done
| Commit | Change |
|---|---|
| `6312465` | `supabase/snippets/cross-currency-transfers-before-led-185.sql`: lists transfers between two currencies with `destination_amount` null (credited one to one by the pre-LED-185 trigger), with the credit and an estimate at today's rate. Ticket LED-254 filed. |

## Acceptance
- (a) **Production: 0 rows** (owner ran the snippet in the Supabase SQL Editor, 2026-10-05). By the ticket's own criterion this closes LED-254 with no UI work; (b) to (g) are not needed.
- Locally the snippet was proved with a rolled-back probe: a 100 USD → PHP transfer was listed as credited 100.00, estimate 5000.00; once `destination_amount` was set it was not listed.

## Backlog
- The snippet stays in `supabase/snippets/` for self-hosted copies that had cross-currency transfers before LED-185. If one reports rows, the in-app notice described in LED-254 is the follow-up.
