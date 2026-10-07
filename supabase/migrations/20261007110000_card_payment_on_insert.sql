-- LED-296 (REV-003): a card payment is recorded once, in the same statement as its transfer.
-- The client saved the transfer, then inserted the credit_card_payments row, read the card and wrote
-- an absolute statement_paid_amount, as separate requests that nothing awaited. Closing the app after
-- the transfer lost the tracking for good; two payments to one card could read the same paid amount
-- and overwrite each other's increment; a queued payment and a recurring one could do both.
--
-- An insert trigger now does what the LED-230 update branch does for an edit: a new transfer into a
-- credit card inserts its payment row, moves the statement's paid amount by what the card is credited
-- (card_statement_shift locks the card row, so concurrent payments queue and both count) and points
-- last_payment_* at the card's latest payment. It runs inside the insert, so the transfer and its
-- tracking commit or roll back together, and it covers every path that creates a transfer: a manual
-- save, an Undo, an import, a recurring post and a queued insert draining.
--
-- Replaying the same transaction id fails on the transactions primary key and rolls the whole insert
-- back, so a payment is never counted twice. The payment insert also skips a transaction that already
-- has a payment row, so nothing here can double one.
--
-- SECURITY INVOKER: row level security applies, the owner comes from the transfer row, and the
-- reference-ownership trigger has already checked that the card belongs to that owner.

create or replace function public.sync_card_payment_on_transfer_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  credited numeric(18,2);
  recorded uuid;
begin
  if new.type <> 'transfer' or new.to_account_id is null then
    return new;
  end if;
  if not exists (select 1 from public.accounts where id = new.to_account_id and type = 'credit_card') then
    return new;
  end if;

  -- What the balance trigger credits the card (transferCredit / creditedAmount in the client).
  credited := coalesce(new.destination_amount, round(new.amount * coalesce(new.exchange_rate, 1), 2));
  insert into public.credit_card_payments (user_id, account_id, amount, payment_date, transaction_id)
  values (new.user_id, new.to_account_id, credited, new.date, new.id)
  on conflict (transaction_id) where transaction_id is not null do nothing
  returning id into recorded;
  if recorded is null then
    return new;
  end if;

  perform public.card_statement_shift(new.to_account_id, credited);
  perform public.card_statement_refresh_last(new.to_account_id, null, null);
  return new;
end;
$$;

revoke all on function public.sync_card_payment_on_transfer_insert() from public;

drop trigger if exists trg_sync_card_payment_insert on public.transactions;
create trigger trg_sync_card_payment_insert
  after insert on public.transactions
  for each row execute function public.sync_card_payment_on_transfer_insert();
