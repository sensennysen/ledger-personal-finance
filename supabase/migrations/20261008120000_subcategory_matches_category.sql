-- LED-315 (REV-022): a transaction's subcategory always belongs to its category.
-- bulkUpdateCategory changed category_id only, and the ownership trigger checks that a subcategory
-- is the same user's, not that it is under the transaction's category. A transaction moved from Food
-- to Travel kept its Food subcategory, so filters, exports and category reports disagreed.
--
-- The client now clears subcategory_id with a new category. Here the database refuses a mismatch:
-- 1. Repair: clear the subcategory on transactions where it is under another category (notice count).
-- 2. Two constraint triggers, DEFERRABLE INITIALLY DEFERRED, check the pair at commit:
--    - a transaction's subcategory must be under its category_id (insert, or either column changing);
--    - a subcategory moved to another category must not leave transactions under the old one.
--    They run at commit so a statement sequence that is consistent at the end passes: merge_categories
--    points transactions at the target's subcategory, moves subcategories, then moves the
--    transactions' category (20261004120000).
-- split_transaction already carries the subcategory only where a line keeps the category (20261006140000).

do $$
declare
  n integer;
begin
  update public.transactions t
     set subcategory_id = null
    from public.subcategories s
   where s.id = t.subcategory_id
     and s.category_id is distinct from t.category_id;
  get diagnostics n = row_count;
  raise notice 'LED-315 repair: % transaction subcategories under another category cleared', n;
end $$;

create or replace function public.check_transaction_subcategory_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cur record;
begin
  -- Read the row as it stands at commit; a later statement in the same transaction may have changed it.
  select t.category_id, t.subcategory_id into cur from public.transactions t where t.id = new.id;
  if not found or cur.subcategory_id is null then
    return null;
  end if;
  if not exists (
    select 1 from public.subcategories s where s.id = cur.subcategory_id and s.category_id = cur.category_id
  ) then
    raise exception 'The subcategory belongs to a different category';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_transaction_subcategory_parent on public.transactions;
create constraint trigger trg_transaction_subcategory_parent
  after insert or update of category_id, subcategory_id
  on public.transactions
  deferrable initially deferred
  for each row execute procedure public.check_transaction_subcategory_parent();

create or replace function public.check_subcategory_reparent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
      from public.transactions t
      join public.subcategories s on s.id = t.subcategory_id
     where t.subcategory_id = new.id
       and t.category_id is distinct from s.category_id
  ) then
    raise exception 'Transactions still use this subcategory under its old category';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_subcategory_reparent on public.subcategories;
create constraint trigger trg_subcategory_reparent
  after update of category_id
  on public.subcategories
  deferrable initially deferred
  for each row execute procedure public.check_subcategory_reparent();
