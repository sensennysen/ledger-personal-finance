-- LED-191: editing or deleting a card payment keeps the card's statement in step.
-- A payment to a credit card is a transfer plus a credit_card_payments row, and the statement's
-- paid amount on the card (LED-146). Nothing tied the row to its transfer, so changing or
-- deleting the transfer left the row and the statement as they were.
--
-- transaction_id links the two. The triggers below keep them together inside the same statement
-- as the change to the transfer, so a failure rolls both back (no half-edited payment) and every
-- path is covered: the card page, the Transactions page, bulk delete and a queued edit draining.
-- The account balance triggers still fire per row and are not touched: they move the balances,
-- these move the statement.
--
-- SECURITY INVOKER: row level security applies, and the owner is taken from the payment row.
-- Payments made before this migration are linked only when exactly one payment and one transfer
-- match on card, date and amount; the rest keep no link and are left as they were.

alter table public.credit_card_payments
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create unique index if not exists credit_card_payments_transaction_idx
  on public.credit_card_payments (transaction_id)
  where transaction_id is not null;

with candidates as (
  select
    p.id as payment_id,
    t.id as transaction_id,
    count(*) over (partition by p.id) as per_payment,
    count(*) over (partition by t.id) as per_transaction
  from public.credit_card_payments p
  join public.transactions t
    on t.user_id = p.user_id
   and t.type = 'transfer'
   and t.to_account_id = p.account_id
   and t.date = p.payment_date
   and round(t.amount * coalesce(t.exchange_rate, 1), 2) = p.amount
  where p.transaction_id is null
)
update public.credit_card_payments p
   set transaction_id = c.transaction_id
  from candidates c
 where c.payment_id = p.id
   and c.per_payment = 1
   and c.per_transaction = 1;

-- Moves the card's paid amount by `p_delta` (negative to take a payment back). Mirrors
-- planStatementPayment: with no statement the paid amount is left alone, and it never goes
-- below 0 or above the locked statement balance.
create or replace function public.card_statement_shift(p_card_id uuid, p_delta numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  card public.accounts%rowtype;
begin
  select * into card from public.accounts where id = p_card_id for update;
  if not found or card.statement_balance is null then
    return;
  end if;
  update public.accounts
     set statement_paid_amount = round(
           greatest(0, least(coalesce(card.statement_paid_amount, 0) + p_delta, card.statement_balance)), 2)
   where id = p_card_id;
end;
$$;

-- Points last_payment_* at the card's latest payment row. With no row left, it is cleared only
-- when it still showed the payment that was just removed.
create or replace function public.card_statement_refresh_last(
  p_card_id uuid,
  p_removed_amount numeric,
  p_removed_date date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  latest public.credit_card_payments%rowtype;
begin
  select * into latest
    from public.credit_card_payments
   where account_id = p_card_id
   order by payment_date desc, created_at desc
   limit 1;
  if found then
    update public.accounts
       set last_payment_amount = latest.amount, last_payment_date = latest.payment_date
     where id = p_card_id;
  else
    update public.accounts
       set last_payment_amount = null, last_payment_date = null
     where id = p_card_id
       and last_payment_amount = p_removed_amount
       and last_payment_date = p_removed_date;
  end if;
end;
$$;

create or replace function public.sync_card_payment_on_transfer_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  pay public.credit_card_payments%rowtype;
  credited numeric(18,2);
begin
  select * into pay from public.credit_card_payments where transaction_id = old.id for update;
  if not found then
    return new;
  end if;

  perform public.card_statement_shift(pay.account_id, -pay.amount);

  if new.type = 'transfer' and new.to_account_id = pay.account_id then
    credited := round(new.amount * coalesce(new.exchange_rate, 1), 2);
    update public.credit_card_payments
       set amount = credited, payment_date = new.date
     where id = pay.id;
    perform public.card_statement_shift(pay.account_id, credited);
    perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
  else
    -- No longer a payment to this card, so it leaves the card's history.
    delete from public.credit_card_payments where id = pay.id;
    perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
  end if;
  return new;
end;
$$;

create or replace function public.sync_card_payment_on_transfer_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  pay public.credit_card_payments%rowtype;
begin
  select * into pay from public.credit_card_payments where transaction_id = old.id for update;
  if not found then
    return old;
  end if;

  delete from public.credit_card_payments where id = pay.id;
  perform public.card_statement_shift(pay.account_id, -pay.amount);
  perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
  return old;
end;
$$;

revoke all on function public.card_statement_shift(uuid, numeric) from public;
revoke all on function public.card_statement_refresh_last(uuid, numeric, date) from public;
revoke all on function public.sync_card_payment_on_transfer_update() from public;
revoke all on function public.sync_card_payment_on_transfer_delete() from public;
-- The trigger functions run as the user who changes the transfer, so the helpers they call need it.
grant execute on function public.card_statement_shift(uuid, numeric) to authenticated;
grant execute on function public.card_statement_refresh_last(uuid, numeric, date) to authenticated;

drop trigger if exists trg_sync_card_payment_update on public.transactions;
create trigger trg_sync_card_payment_update
  after update of amount, exchange_rate, date, type, to_account_id on public.transactions
  for each row execute function public.sync_card_payment_on_transfer_update();

drop trigger if exists trg_sync_card_payment_delete on public.transactions;
create trigger trg_sync_card_payment_delete
  before delete on public.transactions
  for each row execute function public.sync_card_payment_on_transfer_delete();
