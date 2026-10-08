-- LED-326: a transfer's destination is credited and reversed by the same rounded figure.
-- With destination_amount null, update_account_balance() credited amount * exchange_rate, a product
-- with up to 8 decimals that the numeric(18,2) balance rounds once on the way in. The reversal on
-- an edit or a delete subtracted the unrounded product from the rounded balance, so each cycle
-- could leave a cent behind (credit 10.005 → +10.01, reverse → -10.005 → 0.005 → 0.01).
--
-- Both now use round(amount * exchange_rate, 2), the figure the card-payment triggers already use.
-- A balance holds two decimals, so round(balance + x) = balance + round(x): every row credited
-- under the old function is reversed by exactly what it added. No balance moves and nothing is
-- backfilled. The client mirror is src/lib/transferCredit.ts.
--
-- update_account_balance(), as in 20261006130000_liability_payment_destination_amount.sql, with the
-- transfer's fallback credit rounded to cents.
create or replace function public.update_account_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts set balance = balance - old.amount where id = old.account_id;
    elsif old.type = 'expense' then
      update accounts set balance = balance + old.amount where id = old.account_id;
      if old.to_account_id is not null then
        update accounts set balance = balance - coalesce(old.destination_amount, old.amount)
         where id = old.to_account_id and type = 'loan';
      end if;
    elsif old.type = 'transfer' then
      update accounts set balance = balance + old.amount + coalesce(old.transfer_fee, 0) where id = old.account_id;
      if old.to_account_id is not null then
        update accounts set balance = balance - coalesce(old.destination_amount, round(old.amount * old.exchange_rate, 2))
         where id = old.to_account_id;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts set balance = balance + new.amount where id = new.account_id;
    elsif new.type = 'expense' then
      update accounts set balance = balance - new.amount where id = new.account_id;
      if new.to_account_id is not null then
        update accounts set balance = balance + coalesce(new.destination_amount, new.amount)
         where id = new.to_account_id and type = 'loan';
      end if;
    elsif new.type = 'transfer' then
      update accounts set balance = balance - new.amount - coalesce(new.transfer_fee, 0) where id = new.account_id;
      if new.to_account_id is not null then
        update accounts set balance = balance + coalesce(new.destination_amount, round(new.amount * new.exchange_rate, 2))
         where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
