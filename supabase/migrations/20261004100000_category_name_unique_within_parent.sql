-- LED-233: a category name is unique among the user's categories, and a subcategory
-- name among its category's subcategories. Case-insensitive, surrounding spaces
-- ignored; the same subcategory name under two categories is allowed.
--
-- A trigger, not a unique index: existing duplicates are kept, and only a new name or
-- a rename is checked. A rename that only changes case or spacing is not re-checked,
-- so an existing duplicate can still be tidied.
--
-- The message is a sentence for the user; the hint tells the client to show it as is.

create or replace function public.enforce_category_name_unique()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and lower(btrim(old.name)) = lower(btrim(new.name)) then
    return new;
  end if;

  -- Serialise two writes for one user, so both cannot pass the check at once.
  perform pg_advisory_xact_lock(hashtext('categories:' || new.user_id::text));

  if exists (
    select 1 from public.categories c
    where c.user_id = new.user_id
      and c.id <> new.id
      and lower(btrim(c.name)) = lower(btrim(new.name))
  ) then
    raise exception 'A category named "%" already exists.', btrim(new.name)
      using errcode = '23505', hint = 'user-message';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_categories_name_unique on public.categories;
create trigger trg_categories_name_unique
  before insert or update of name on public.categories
  for each row execute procedure public.enforce_category_name_unique();

create or replace function public.enforce_subcategory_name_unique()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_parent text;
begin
  if tg_op = 'UPDATE'
    and old.category_id = new.category_id
    and lower(btrim(old.name)) = lower(btrim(new.name)) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('subcategories:' || new.category_id::text));

  if exists (
    select 1 from public.subcategories s
    where s.category_id = new.category_id
      and s.id <> new.id
      and lower(btrim(s.name)) = lower(btrim(new.name))
  ) then
    select btrim(c.name) into v_parent from public.categories c where c.id = new.category_id;
    raise exception 'A subcategory named "%" already exists in %.', btrim(new.name), coalesce(v_parent, 'this category')
      using errcode = '23505', hint = 'user-message';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subcategories_name_unique on public.subcategories;
create trigger trg_subcategories_name_unique
  before insert or update of name, category_id on public.subcategories
  for each row execute procedure public.enforce_subcategory_name_unique();
