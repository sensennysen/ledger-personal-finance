-- LED-314 (REV-021): every user-owned reference is checked for ownership.
-- A foreign key check ignores row level security, so a caller who knows another user's UUID could
-- point their own row at it. RLS on the row checks only its user_id. The transaction trigger covered
-- accounts, categories and subcategories, but not goal_id (added later). Transaction rules,
-- credit card payments and 13th-month picks had no check at all.
--
-- 1. Repair existing links that a check would reject, with a notice giving each count.
-- 2. Add the checks: goal_id on transactions, category_id on transaction rules, account_id and
--    transaction_id on credit card payments, transaction_id on 13th-month picks.
--
-- The lookups follow the baseline ownership triggers (SECURITY DEFINER, so the check sees the
-- referenced row whatever the caller's RLS): they read only the owner of the id given and raise.

-- ── 1. Repair ──────────────────────────────────────────────────────────────────────────────
do $$
declare
  n integer;
begin
  update public.transactions t
     set goal_id = null
   where t.goal_id is not null
     and not exists (select 1 from public.savings_goals g where g.id = t.goal_id and g.user_id = t.user_id);
  get diagnostics n = row_count;
  raise notice 'LED-314 repair: % transaction goal links cleared', n;

  update public.transaction_rules r
     set category_id = null
   where r.category_id is not null
     and not exists (select 1 from public.categories c where c.id = r.category_id and c.user_id = r.user_id);
  get diagnostics n = row_count;
  raise notice 'LED-314 repair: % rule categories cleared', n;

  -- A payment on another user's card cannot be the payer's: there is no card of theirs to move.
  delete from public.credit_card_payments p
   where not exists (select 1 from public.accounts a where a.id = p.account_id and a.user_id = p.user_id);
  get diagnostics n = row_count;
  raise notice 'LED-314 repair: % card payments on a card the payer does not own removed', n;

  update public.credit_card_payments p
     set transaction_id = null
   where p.transaction_id is not null
     and not exists (
       select 1 from public.transactions t
        where t.id = p.transaction_id and t.user_id = p.user_id
          and t.type = 'transfer' and t.to_account_id = p.account_id
     );
  get diagnostics n = row_count;
  raise notice 'LED-314 repair: % card payment transfer links cleared', n;

  delete from public.thirteenth_month_picks k
   where not exists (select 1 from public.transactions t where t.id = k.transaction_id and t.user_id = k.user_id);
  get diagnostics n = row_count;
  raise notice 'LED-314 repair: % 13th-month picks of another user''s transaction removed', n;
end $$;

-- ── 2. Transactions: goal_id ──────────────────────────────────────────────────────────────
create or replace function public.enforce_transaction_reference_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id
  ) then
    raise exception 'Transaction account must belong to the same user';
  end if;

  if new.to_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.to_account_id and a.user_id = new.user_id
  ) then
    raise exception 'Transaction destination account must belong to the same user';
  end if;

  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'Transaction category must belong to the same user';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s where s.id = new.subcategory_id and s.user_id = new.user_id
  ) then
    raise exception 'Transaction subcategory must belong to the same user';
  end if;

  if new.goal_id is not null and not exists (
    select 1 from public.savings_goals g where g.id = new.goal_id and g.user_id = new.user_id
  ) then
    raise exception 'Transaction savings goal must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transactions_reference_ownership on public.transactions;
create trigger trg_transactions_reference_ownership
  before insert or update of user_id, account_id, to_account_id, category_id, subcategory_id, goal_id
  on public.transactions
  for each row execute procedure public.enforce_transaction_reference_ownership();

-- ── 3. Transaction rules: category_id ─────────────────────────────────────────────────────
create or replace function public.enforce_transaction_rule_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'Rule category must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transaction_rules_ownership on public.transaction_rules;
create trigger trg_transaction_rules_ownership
  before insert or update of user_id, category_id
  on public.transaction_rules
  for each row execute procedure public.enforce_transaction_rule_ownership();

-- ── 4. Credit card payments: account_id, transaction_id and the transfer they record ───────
-- The amount is checked only when the link is made (insert, or a new transaction_id): the
-- card-payment triggers (LED-230, LED-296) move the amount afterwards with the transfer.
create or replace function public.enforce_card_payment_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tx public.transactions%rowtype;
begin
  if not exists (
    select 1 from public.accounts a
     where a.id = new.account_id and a.user_id = new.user_id and a.type = 'credit_card'
  ) then
    raise exception 'A card payment must be to your own credit card';
  end if;

  if new.transaction_id is null then
    return new;
  end if;

  select * into tx from public.transactions t where t.id = new.transaction_id and t.user_id = new.user_id;
  if not found then
    raise exception 'A card payment''s transfer must belong to the same user';
  end if;
  if tx.type <> 'transfer' or tx.to_account_id is distinct from new.account_id then
    raise exception 'A card payment''s transfer must go to the same card';
  end if;
  if (tg_op = 'INSERT' or new.transaction_id is distinct from old.transaction_id)
     and new.amount <> coalesce(tx.destination_amount, round(tx.amount * coalesce(tx.exchange_rate, 1), 2)) then
    raise exception 'A card payment''s amount must match what its transfer credits the card';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_card_payment_ownership on public.credit_card_payments;
create trigger trg_card_payment_ownership
  before insert or update of user_id, account_id, transaction_id
  on public.credit_card_payments
  for each row execute procedure public.enforce_card_payment_ownership();

-- ── 5. 13th-month picks: transaction_id ───────────────────────────────────────────────────
create or replace function public.enforce_thirteenth_month_pick_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.transactions t where t.id = new.transaction_id and t.user_id = new.user_id
  ) then
    raise exception 'A 13th-month pick must be one of your own transactions';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_thirteenth_month_pick_ownership on public.thirteenth_month_picks;
create trigger trg_thirteenth_month_pick_ownership
  before insert or update of user_id, transaction_id
  on public.thirteenth_month_picks
  for each row execute procedure public.enforce_thirteenth_month_pick_ownership();
