alter table public.profiles
  add column if not exists dashboard_widget_order jsonb not null default '["stats","creditCards","cashflowChart","categoryPie","budgets","upcomingBills","cashflowForecast"]'::jsonb,
  add column if not exists account_group_order jsonb not null default '["cash","digital_wallet","credit_card","savings","checking","investment","loan","other"]'::jsonb,
  add column if not exists account_view_mode text not null default 'all'
    check (account_view_mode in ('all','cash','digital_wallet','credit_card','savings','checking','investment','loan','other'));

alter table public.accounts
  add column if not exists sort_order integer not null default 0;

with ranked_accounts as (
  select
    id,
    row_number() over (partition by user_id order by created_at asc, id asc) - 1 as rn
  from public.accounts
)
update public.accounts a
set sort_order = ranked_accounts.rn
from ranked_accounts
where a.id = ranked_accounts.id
  and a.sort_order = 0;

create index if not exists accounts_user_sort_order_idx
  on public.accounts(user_id, sort_order, created_at);
