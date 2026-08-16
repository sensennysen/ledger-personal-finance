create table if not exists public.loan_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  principal_amount numeric(18,2) not null check (principal_amount > 0),
  term_months integer not null check (term_months between 1 and 120),
  monthly_interest_rate numeric(8,4) not null default 0 check (monthly_interest_rate >= 0),
  monthly_installment numeric(18,2) not null check (monthly_installment > 0),
  total_payable numeric(18,2) not null check (total_payable > 0),
  opening_installments_paid integer not null default 0 check (opening_installments_paid >= 0 and opening_installments_paid <= term_months),
  opening_paid_amount numeric(18,2) not null default 0 check (opening_paid_amount >= 0 and opening_paid_amount <= total_payable),
  first_due_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  loan_purchase_id uuid not null references public.loan_purchases(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, loan_purchase_id)
);

alter table public.loan_purchases enable row level security;
alter table public.loan_payment_allocations enable row level security;

drop policy if exists "Users can manage own loan purchases" on public.loan_purchases;
create policy "Users can manage own loan purchases"
  on public.loan_purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can view own loan allocations" on public.loan_payment_allocations;
create policy "Users can view own loan allocations"
  on public.loan_payment_allocations for select using (auth.uid() = user_id);

create index if not exists loan_purchases_account_due_idx
  on public.loan_purchases(account_id, first_due_date, created_at);
create index if not exists loan_payment_allocations_purchase_idx
  on public.loan_payment_allocations(loan_purchase_id, created_at);
create index if not exists loan_payment_allocations_transaction_idx
  on public.loan_payment_allocations(transaction_id);

drop trigger if exists set_loan_purchases_updated_at on public.loan_purchases;
create trigger set_loan_purchases_updated_at
  before update on public.loan_purchases
  for each row execute procedure public.set_updated_at();

create or replace function public.enforce_loan_purchase_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.user_id = new.user_id and a.type = 'loan'
  ) then
    raise exception 'Financed purchase account must be a loan owned by the same user';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.type in ('expense', 'both')
  ) then
    raise exception 'Financed purchase category must be an expense category owned by the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_loan_purchase_ownership on public.loan_purchases;
create trigger trg_loan_purchase_ownership
  before insert or update of user_id, account_id, category_id on public.loan_purchases
  for each row execute procedure public.enforce_loan_purchase_ownership();

create or replace function public.update_loan_account_for_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.accounts
      set balance = balance + greatest(old.total_payable - public.loan_purchase_paid_amount(old.id), 0)
      where id = old.account_id;
  elsif tg_op = 'UPDATE' then
    update public.accounts set balance = balance + greatest(old.total_payable - old.opening_paid_amount, 0) where id = old.account_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.accounts set balance = balance - greatest(new.total_payable - new.opening_paid_amount, 0) where id = new.account_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_loan_purchase_balance_insert on public.loan_purchases;
drop trigger if exists trg_loan_purchase_balance_update on public.loan_purchases;
drop trigger if exists trg_loan_purchase_balance_delete on public.loan_purchases;
create trigger trg_loan_purchase_balance_insert
  after insert on public.loan_purchases
  for each row execute procedure public.update_loan_account_for_purchase();
create trigger trg_loan_purchase_balance_update
  after update of account_id, total_payable, opening_paid_amount on public.loan_purchases
  for each row execute procedure public.update_loan_account_for_purchase();
create trigger trg_loan_purchase_balance_delete
  before delete on public.loan_purchases
  for each row execute procedure public.update_loan_account_for_purchase();

create or replace function public.loan_purchase_paid_amount(purchase_uuid uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select p.opening_paid_amount + coalesce(sum(a.amount), 0)
  from public.loan_purchases p
  left join public.loan_payment_allocations a on a.loan_purchase_id = p.id
  where p.id = purchase_uuid
  group by p.id, p.opening_paid_amount;
$$;

create or replace function public.loan_purchase_due_amount(purchase_uuid uuid, as_of_date date)
returns numeric language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce(sum(
      case
        when installment.number = purchase.term_months
          then purchase.total_payable - purchase.monthly_installment * (purchase.term_months - 1)
        else purchase.monthly_installment
      end
    ) filter (
      where (purchase.first_due_date + ((installment.number - 1)::text || ' months')::interval)::date <= as_of_date
    ), 0) - public.loan_purchase_paid_amount(purchase.id),
    0
  )
  from public.loan_purchases purchase
  cross join lateral generate_series(1, purchase.term_months) installment(number)
  where purchase.id = purchase_uuid
  group by purchase.id;
$$;

create or replace function public.allocate_loan_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  purchase_row record;
  payment_remaining numeric(18,2) := new.amount;
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

create or replace function public.clear_loan_payment_allocations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.loan_payment_allocations where transaction_id = old.id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_loan_allocations_update on public.transactions;
drop trigger if exists trg_clear_loan_allocations_delete on public.transactions;
drop trigger if exists trg_allocate_loan_payment_insert on public.transactions;
drop trigger if exists trg_allocate_loan_payment_update on public.transactions;
create trigger trg_clear_loan_allocations_update
  before update of amount, date, type, to_account_id on public.transactions
  for each row execute procedure public.clear_loan_payment_allocations();
create trigger trg_clear_loan_allocations_delete
  before delete on public.transactions
  for each row execute procedure public.clear_loan_payment_allocations();
create trigger trg_allocate_loan_payment_insert
  after insert on public.transactions
  for each row execute procedure public.allocate_loan_payment();
create trigger trg_allocate_loan_payment_update
  after update of amount, date, type, to_account_id on public.transactions
  for each row execute procedure public.allocate_loan_payment();
