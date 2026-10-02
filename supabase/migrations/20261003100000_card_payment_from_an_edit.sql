-- LED-230: an edit that turns a row into a payment to a credit card records the payment.
-- Every create path runs the statement steps for a transfer into a card (LED-146, LED-190, LED-193),
-- and the LED-191 trigger moves or removes a payment row that is already linked to its transfer.
-- Nothing created one when an edit made the payment: an expense changed to a transfer into a card,
-- or a transfer whose destination moved onto a card, left the card's history and statement as they
-- were while its balance moved.
--
-- The update trigger now also inserts the payment row, moves the statement's paid amount by the
-- credited amount and points last_payment_* at the card's latest payment, in the same statement as
-- the edit. A queued edit gets the same result when it drains. When the old row was already a
-- transfer into the same card, nothing is inserted: a payment made before LED-191 may have no link,
-- and an amount edit must not record it a second time.

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
  if found then
    perform public.card_statement_shift(pay.account_id, -pay.amount);

    if new.type = 'transfer' and new.to_account_id = pay.account_id then
      credited := round(new.amount * coalesce(new.exchange_rate, 1), 2);
      update public.credit_card_payments
         set amount = credited, payment_date = new.date
       where id = pay.id;
      perform public.card_statement_shift(pay.account_id, credited);
      perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
      return new;
    end if;

    -- No longer a payment to this card, so it leaves the card's history.
    delete from public.credit_card_payments where id = pay.id;
    perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
  elsif old.type = 'transfer' and old.to_account_id is not distinct from new.to_account_id then
    -- Already a transfer into this destination with no linked payment: left as it was.
    return new;
  end if;

  -- The edit made it a payment to a card it was not paying before.
  if new.type = 'transfer'
     and exists (select 1 from public.accounts where id = new.to_account_id and type = 'credit_card') then
    credited := round(new.amount * coalesce(new.exchange_rate, 1), 2);
    insert into public.credit_card_payments (user_id, account_id, amount, payment_date, transaction_id)
    values (new.user_id, new.to_account_id, credited, new.date, new.id);
    perform public.card_statement_shift(new.to_account_id, credited);
    perform public.card_statement_refresh_last(new.to_account_id, null, null);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_card_payment_on_transfer_update() from public;
