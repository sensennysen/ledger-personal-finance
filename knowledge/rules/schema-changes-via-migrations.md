# Schema changes ship as migrations
Add a file under `supabase/migrations/` (timestamped) for every schema change; do not edit prod by hand.
**Why:** prod drifted from the repo once (`80807ce`, LED epic 0), causing missing-column failures.
**How:** write an idempotent migration, and update `schema.sql` only if the base needs to change.
**Deploy order:** when the client starts writing or selecting a new column, the migration reaches the hosted database before that client is deployed. Every transaction insert and update sends the whole value object, and the offline-queue drain selects the payload's columns (`queueDrain.readServerRow`), so a database without the column rejects every write, not just the new feature's (LED-185 `destination_amount`, LED-232 `recurrence_next_posted`).
