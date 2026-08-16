alter table public.loan_purchases
  add column if not exists opening_installments_paid integer not null default 0,
  add column if not exists opening_paid_amount numeric(18,2) not null default 0;

alter table public.loan_purchases
  drop constraint if exists loan_purchases_opening_installments_paid_check,
  add constraint loan_purchases_opening_installments_paid_check
    check (opening_installments_paid >= 0 and opening_installments_paid <= term_months),
  drop constraint if exists loan_purchases_opening_paid_amount_check,
  add constraint loan_purchases_opening_paid_amount_check
    check (opening_paid_amount >= 0 and opening_paid_amount <= total_payable);

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

drop trigger if exists trg_loan_purchase_balance_update on public.loan_purchases;
create trigger trg_loan_purchase_balance_update
  after update of account_id, total_payable, opening_paid_amount on public.loan_purchases
  for each row execute procedure public.update_loan_account_for_purchase();

create or replace function public.loan_purchase_paid_amount(purchase_uuid uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select p.opening_paid_amount + coalesce(sum(a.amount), 0)
  from public.loan_purchases p
  left join public.loan_payment_allocations a on a.loan_purchase_id = p.id
  where p.id = purchase_uuid
  group by p.id, p.opening_paid_amount;
$$;
