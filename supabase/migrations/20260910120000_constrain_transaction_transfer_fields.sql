-- Defensive constraints for transfers that would otherwise silently lose money:
--   * exchange_rate <= 0 credits the destination with amount * rate <= 0 while
--     still debiting the source (see update_account_balance()).
--   * a self-transfer (to_account_id = account_id) nets the account to
--     -transfer_fee instead of leaving it unchanged.
--
-- The app only ever writes exchange_rate = 1 today, so the repair below is a
-- no-op in practice but keeps the constraint safe to add. The self-transfer
-- check is added NOT VALID so it guards new/updated rows without scanning (or
-- rejecting the migration over) any pre-existing data.

update public.transactions set exchange_rate = 1 where exchange_rate <= 0;

alter table public.transactions
  drop constraint if exists transactions_exchange_rate_positive;
alter table public.transactions
  add constraint transactions_exchange_rate_positive check (exchange_rate > 0);

alter table public.transactions
  drop constraint if exists transactions_no_self_transfer;
alter table public.transactions
  add constraint transactions_no_self_transfer
  check (to_account_id is null or to_account_id <> account_id) not valid;
