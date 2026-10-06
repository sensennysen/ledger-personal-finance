-- LED-269: a loan repayment between two currencies. A repayment is an expense into a loan; until now
-- the loan was credited with `amount`, which is in the paying account's currency. destination_amount
-- (LED-185, null on every row so far) now carries the amount the loan received when the currencies
-- differ, and the loan is credited, reversed and allocated by coalesce(destination_amount, amount).
-- Every existing repayment has a null destination_amount, so no balance or allocation moves.
-- Card payments need nothing here: they are transfers, already credited by the same coalesce.

-- update_account_balance(), as in 20261003120000_transfer_destination_amount.sql, with a loan
-- repayment's destination credited (and reversed) by coalesce(destination_amount, amount).
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
        update accounts set balance = balance - coalesce(old.destination_amount, old.amount * old.exchange_rate)
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
        update accounts set balance = balance + coalesce(new.destination_amount, new.amount * new.exchange_rate)
         where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- allocate_loan_payment(), as in 20260810123000_add_financed_purchases.sql, splitting what the loan
-- received: coalesce(destination_amount, amount).
create or replace function public.allocate_loan_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  purchase_row record;
  payment_remaining numeric(18,2) := coalesce(new.destination_amount, new.amount);
  phase_remaining numeric(18,2);
  weight_remaining numeric(18,2);
  allocation_amount numeric(18,2);
begin
  if new.type <> 'expense' or new.to_account_id is null then return new; end if;
  if not exists (select 1 from public.accounts a where a.id = new.to_account_id and a.type = 'loan') then return new; end if;

  select coalesce(sum(public.loan_purchase_due_amount(p.id, new.date)), 0)
    into weight_remaining
  from public.loan_purchases p
  where p.account_id = new.to_account_id and p.user_id = new.user_id
    and public.loan_purchase_paid_amount(p.id) < p.total_payable;

  phase_remaining := least(payment_remaining, weight_remaining);
  for purchase_row in
    select p.id, public.loan_purchase_due_amount(p.id, new.date) as weight
    from public.loan_purchases p
    where p.account_id = new.to_account_id and p.user_id = new.user_id
      and public.loan_purchase_due_amount(p.id, new.date) > 0
    order by p.first_due_date, p.created_at, p.id
  loop
    exit when phase_remaining <= 0 or weight_remaining <= 0;
    allocation_amount := case
      when weight_remaining <= purchase_row.weight then phase_remaining
      else round(phase_remaining * purchase_row.weight / weight_remaining, 2)
    end;
    allocation_amount := least(allocation_amount, purchase_row.weight, phase_remaining);
    if allocation_amount > 0 then
      insert into public.loan_payment_allocations(user_id, transaction_id, loan_purchase_id, amount)
      values (new.user_id, new.id, purchase_row.id, allocation_amount)
      on conflict (transaction_id, loan_purchase_id)
      do update set amount = public.loan_payment_allocations.amount + excluded.amount;
      payment_remaining := payment_remaining - allocation_amount;
      phase_remaining := phase_remaining - allocation_amount;
    end if;
    weight_remaining := weight_remaining - purchase_row.weight;
  end loop;

  if payment_remaining > 0 then
    select coalesce(sum(greatest(p.total_payable - public.loan_purchase_paid_amount(p.id), 0)), 0)
      into weight_remaining
    from public.loan_purchases p
    where p.account_id = new.to_account_id and p.user_id = new.user_id;
    phase_remaining := least(payment_remaining, weight_remaining);

    for purchase_row in
      select p.id, greatest(p.total_payable - public.loan_purchase_paid_amount(p.id), 0) as weight
      from public.loan_purchases p
      where p.account_id = new.to_account_id and p.user_id = new.user_id
        and public.loan_purchase_paid_amount(p.id) < p.total_payable
      order by p.first_due_date, p.created_at, p.id
    loop
      exit when phase_remaining <= 0 or weight_remaining <= 0;
      allocation_amount := case
        when weight_remaining <= purchase_row.weight then phase_remaining
        else round(phase_remaining * purchase_row.weight / weight_remaining, 2)
      end;
      allocation_amount := least(allocation_amount, purchase_row.weight, phase_remaining);
      if allocation_amount > 0 then
        insert into public.loan_payment_allocations(user_id, transaction_id, loan_purchase_id, amount)
        values (new.user_id, new.id, purchase_row.id, allocation_amount)
        on conflict (transaction_id, loan_purchase_id)
        do update set amount = public.loan_payment_allocations.amount + excluded.amount;
        phase_remaining := phase_remaining - allocation_amount;
      end if;
      weight_remaining := weight_remaining - purchase_row.weight;
    end loop;
  end if;
  return new;
end;
$$;

-- An edit to the amount received alone re-splits the repayment.
drop trigger if exists trg_clear_loan_allocations_update on public.transactions;
drop trigger if exists trg_allocate_loan_payment_update on public.transactions;
create trigger trg_clear_loan_allocations_update
  before update of amount, date, type, to_account_id, destination_amount on public.transactions
  for each row execute procedure public.clear_loan_payment_allocations();
create trigger trg_allocate_loan_payment_update
  after update of amount, date, type, to_account_id, destination_amount on public.transactions
  for each row execute procedure public.allocate_loan_payment();
