alter table public.categories
  add column if not exists sort_order integer not null default 0;

with ordered_categories as (
  select
    id,
    row_number() over (
      partition by user_id
      order by is_default desc, name asc, created_at asc, id asc
    ) - 1 as sort_order
  from public.categories
)
update public.categories as categories
set sort_order = ordered_categories.sort_order
from ordered_categories
where categories.id = ordered_categories.id;

create index if not exists categories_user_sort_order_idx
  on public.categories(user_id, sort_order, created_at);

alter table public.subcategories
  add column if not exists sort_order integer not null default 0;

with ordered_subcategories as (
  select
    id,
    row_number() over (
      partition by user_id, category_id
      order by name asc, created_at asc, id asc
    ) - 1 as sort_order
  from public.subcategories
)
update public.subcategories as subcategories
set sort_order = ordered_subcategories.sort_order
from ordered_subcategories
where subcategories.id = ordered_subcategories.id;

create index if not exists subcategories_category_sort_order_idx
  on public.subcategories(category_id, sort_order, created_at);
