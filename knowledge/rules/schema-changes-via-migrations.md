# Schema changes ship as migrations
Add a file under `supabase/migrations/` (timestamped) for every schema change; do not edit prod by hand.
**Why:** prod drifted from the repo once (`80807ce`, LED epic 0), causing missing-column failures.
**How:** write an idempotent migration, and update `schema.sql` only if the base needs to change.
