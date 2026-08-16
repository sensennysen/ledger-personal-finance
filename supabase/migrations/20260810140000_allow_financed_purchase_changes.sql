alter table public.loan_payment_allocations
  drop constraint if exists loan_payment_allocations_loan_purchase_id_fkey;
alter table public.loan_payment_allocations
  add constraint loan_payment_allocations_loan_purchase_id_fkey
  foreign key (loan_purchase_id) references public.loan_purchases(id) on delete cascade;

create or replace function public.update_loan_account_for_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.accounts
      set balance = balance + greatest(old.total_payable - public.loan_purchase_paid_amount(old.id), 0)
      where id = old.account_id;
  elsif tg_op = 'UPDATE' then
    update public.accounts
      set balance = balance + greatest(old.total_payable - old.opening_paid_amount, 0)
      where id = old.account_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.accounts
      set balance = balance - greatest(new.total_payable - new.opening_paid_amount, 0)
      where id = new.account_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_loan_purchase_balance_delete on public.loan_purchases;
create trigger trg_loan_purchase_balance_delete
  before delete on public.loan_purchases
  for each row execute procedure public.update_loan_account_for_purchase();
