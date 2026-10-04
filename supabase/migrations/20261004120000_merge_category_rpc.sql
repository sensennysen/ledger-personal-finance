-- LED-239: merge one category into another in one atomic call.
-- Everything that points at the source moves to the target, then the source is
-- deleted. budgets and subcategories cascade on delete, so they are moved first;
-- deleting the source with them still attached would lose them silently.
--
-- SECURITY INVOKER: row level security applies, so another user's category is
-- simply not found. Moving category_id fires no balance, loan or card trigger
-- (those watch amount, type, accounts and dates), so balances do not change.
--
-- Rules:
-- * The target must accept the source's rows: the same type, or 'both'. Otherwise
--   an expense row would land in an income-only category (and loan_purchases'
--   trigger would refuse part-way).
-- * A source subcategory whose name the target already has (LED-233: lower, trimmed)
--   is folded into the target's: its transactions move over, then it is deleted.
--   Other subcategories move under the target, after the target's own. They are taken
--   one at a time in order, so duplicates the source kept from before LED-233 fold into
--   the first of them instead of tripping the name check.
-- * Budgets move and are all kept, so the target may end with two budgets; the
--   client says so. The target keeps its own name, type, colour and salary flag.
--
-- Returns the counts that moved, for the client's confirmation.
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
