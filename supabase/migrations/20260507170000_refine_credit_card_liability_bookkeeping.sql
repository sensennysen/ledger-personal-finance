begin;

create or replace function public.update_account_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_account_type text;
  old_to_account_type text;
  new_account_type text;
  new_to_account_type text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select type into old_account_type from public.accounts where id = old.account_id;
    if old.to_account_id is not null then
      select type into old_to_account_type from public.accounts where id = old.to_account_id;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select type into new_account_type from public.accounts where id = new.account_id;
    if new.to_account_id is not null then
      select type into new_to_account_type from public.accounts where id = new.to_account_id;
    end if;
  end if; 

  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts
        set balance = balance - (case when old_account_type = 'credit_card' then -old.amount else old.amount end)
        where id = old.account_id;
    elsif old.type = 'expense' then
      update accounts
        set balance = balance + (case when old_account_type = 'credit_card' then -old.amount else old.amount end)
        where id = old.account_id;
    elsif old.type = 'transfer' then
      update accounts
        set balance = balance + (case
          when old_account_type = 'credit_card' then -(old.amount + coalesce(old.transfer_fee, 0))
          else old.amount + coalesce(old.transfer_fee, 0)
        end)
        where id = old.account_id;
      if old.to_account_id is not null then
        update accounts
          set balance = balance - (case
            when old_to_account_type = 'credit_card' then -(old.amount * old.exchange_rate)
            else old.amount * old.exchange_rate
          end)
          where id = old.to_account_id;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts
        set balance = balance + (case when new_account_type = 'credit_card' then -new.amount else new.amount end)
        where id = new.account_id;
    elsif new.type = 'expense' then
      update accounts
        set balance = balance + (case when new_account_type = 'credit_card' then new.amount else -new.amount end)
        where id = new.account_id;
    elsif new.type = 'transfer' then
      update accounts
        set balance = balance + (case
          when new_account_type = 'credit_card' then new.amount + coalesce(new.transfer_fee, 0)
          else -(new.amount + coalesce(new.transfer_fee, 0))
        end)
        where id = new.account_id;
      if new.to_account_id is not null then
        update accounts
          set balance = balance + (case
            when new_to_account_type = 'credit_card' then -(new.amount * new.exchange_rate)
            else new.amount * new.exchange_rate
          end)
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
