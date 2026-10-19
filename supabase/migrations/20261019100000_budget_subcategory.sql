-- A budget can track one subcategory instead of its whole category.
-- budgets.subcategory_id is optional: null keeps today's behaviour (every expense in the category).
-- With a subcategory, only expenses tagged with it count against the budget.
--
-- 1. The column. Deleting the subcategory clears it, so the budget falls back to its whole category,
--    as transactions using the subcategory fall back to it (the delete dialog says so).
-- 2. Ownership: the budget's subcategory must be the same user's (as for transactions, LED-314).
-- 3. A deferred constraint trigger keeps the subcategory under the budget's category, and the
--    reparent check (LED-315) now also refuses to move a subcategory away from budgets using it.
-- 4. merge_category points budgets on a folded subcategory at the subcategory it folds into,
--    before that subcategory is deleted. Moved subcategories go with their category, as do budgets.

-- ── 1. Column ────────────────────────────────────────────────────────────────────────────
alter table public.budgets
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;

create index if not exists budgets_subcategory_idx on public.budgets(subcategory_id);

-- ── 2. Ownership ─────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_budget_reference_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'Budget category must belong to the same user';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s where s.id = new.subcategory_id and s.user_id = new.user_id
  ) then
    raise exception 'Budget subcategory must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budgets_reference_ownership on public.budgets;
create trigger trg_budgets_reference_ownership
  before insert or update of user_id, category_id, subcategory_id
  on public.budgets
  for each row execute procedure public.enforce_budget_reference_ownership();

-- ── 3. Subcategory under the budget's category ──────────────────────────────────────────
create or replace function public.check_budget_subcategory_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cur record;
begin
  -- Read the row as it stands at commit; a later statement in the same transaction may have changed it.
  select b.category_id, b.subcategory_id into cur from public.budgets b where b.id = new.id;
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

drop trigger if exists trg_budget_subcategory_parent on public.budgets;
create constraint trigger trg_budget_subcategory_parent
  after insert or update of category_id, subcategory_id
  on public.budgets
  deferrable initially deferred
  for each row execute procedure public.check_budget_subcategory_parent();

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
  if exists (
    select 1
      from public.budgets b
      join public.subcategories s on s.id = b.subcategory_id
     where b.subcategory_id = new.id
       and b.category_id is distinct from s.category_id
  ) then
    raise exception 'Budgets still use this subcategory under its old category';
  end if;
  return null;
end;
$$;

-- ── 4. merge_category ────────────────────────────────────────────────────────────────────
-- As 20261004120000, plus the budgets line in the fold branch.
create or replace function public.merge_category(p_source uuid, p_target uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.categories%rowtype;
  tgt public.categories%rowtype;
  v_transactions integer;
  v_subcategories_moved integer;
  v_subcategories_folded integer;
  v_budgets integer;
  v_rules integer;
  v_loan_purchases integer;
  v_target_budgets integer;
  v_next_sort integer;
  v_keeper uuid;
  sub record;
begin
  if p_source is null or p_target is null then
    raise exception 'Choose a category to merge into.' using hint = 'user-message';
  end if;
  if p_source = p_target then
    raise exception 'A category cannot be merged into itself.' using hint = 'user-message';
  end if;

  -- Lock both rows in id order, so two merges of the same pair cannot deadlock.
  perform 1 from public.categories where id in (p_source, p_target) order by id for update;
  select * into src from public.categories where id = p_source;
  if not found then
    raise exception 'Category not found.' using hint = 'user-message';
  end if;
  select * into tgt from public.categories where id = p_target;
  if not found or tgt.user_id <> src.user_id then
    raise exception 'Category not found.' using hint = 'user-message';
  end if;

  if tgt.type <> src.type and tgt.type <> 'both' then
    raise exception '% is for % only, so it cannot take %. Merge into a category of the same type, or one for both.',
      tgt.name, tgt.type,
      case src.type when 'both' then 'income and expense rows' else src.type || ' rows' end
      using hint = 'user-message';
  end if;

  -- Subcategories, in their order: fold into the target's of the same name, else move
  -- under the target after its own.
  v_subcategories_moved := 0;
  v_subcategories_folded := 0;
  select coalesce(max(sort_order) + 1, 0) into v_next_sort
  from public.subcategories where category_id = p_target;

  for sub in
    select id, name from public.subcategories
    where category_id = p_source
    order by sort_order, created_at, id
  loop
    select id into v_keeper from public.subcategories
    where category_id = p_target and lower(btrim(name)) = lower(btrim(sub.name))
    order by sort_order, created_at, id
    limit 1;

    if found then
      update public.transactions set subcategory_id = v_keeper where subcategory_id = sub.id;
      update public.budgets set subcategory_id = v_keeper where subcategory_id = sub.id;
      delete from public.subcategories where id = sub.id;
      v_subcategories_folded := v_subcategories_folded + 1;
    else
      update public.subcategories set category_id = p_target, sort_order = v_next_sort where id = sub.id;
      v_next_sort := v_next_sort + 1;
      v_subcategories_moved := v_subcategories_moved + 1;
    end if;
  end loop;

  update public.transactions set category_id = p_target where category_id = p_source;
  get diagnostics v_transactions = row_count;

  update public.budgets set category_id = p_target where category_id = p_source;
  get diagnostics v_budgets = row_count;

  update public.transaction_rules set category_id = p_target where category_id = p_source;
  get diagnostics v_rules = row_count;

  update public.loan_purchases set category_id = p_target where category_id = p_source;
  get diagnostics v_loan_purchases = row_count;

  delete from public.categories where id = p_source;

  select count(*) into v_target_budgets from public.budgets where category_id = p_target and is_active;

  return jsonb_build_object(
    'transactions', v_transactions,
    'subcategories_moved', v_subcategories_moved,
    'subcategories_folded', v_subcategories_folded,
    'budgets', v_budgets,
    'rules', v_rules,
    'loan_purchases', v_loan_purchases,
    'target_active_budgets', v_target_budgets
  );
end;
$$;

revoke all on function public.merge_category(uuid, uuid) from public;
grant execute on function public.merge_category(uuid, uuid) to authenticated;
