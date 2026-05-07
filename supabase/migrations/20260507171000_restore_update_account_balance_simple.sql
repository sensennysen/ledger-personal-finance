begin;

create or replace function public.update_account_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Reverse the OLD row's effect
  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts
        set balance = balance - old.amount
        where id = old.account_id;

    elsif old.type = 'expense' then
      update accounts
        set balance = balance + old.amount
        where id = old.account_id;

    elsif old.type = 'transfer' then
      update accounts
        set balance = balance + old.amount + coalesce(old.transfer_fee, 0)
        where id = old.account_id;

      if old.to_account_id is not null then
        update accounts
          set balance = balance - (old.amount * old.exchange_rate)
          where id = old.to_account_id;
      end if;
    end if;
  end if;

  -- Apply the NEW row's effect
  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts
        set balance = balance + new.amount
        where id = new.account_id;

    elsif new.type = 'expense' then
      update accounts
        set balance = balance - new.amount
        where id = new.account_id;

    elsif new.type = 'transfer' then
      update accounts
        set balance = balance - new.amount - coalesce(new.transfer_fee, 0)
        where id = new.account_id;

      if new.to_account_id is not null then
        update accounts
          set balance = balance + (new.amount * new.exchange_rate)
          where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

commit;
