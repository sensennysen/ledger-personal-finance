create table public.quick_log_drafts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  phrase text not null check (char_length(btrim(phrase)) between 1 and 500),
  kind text check (kind in ('expense', 'income', 'transfer', 'card-payment', 'loan-repayment')),
  description text,
  amount numeric(18,2) check (amount > 0),
  currency text,
  transaction_date date,
  account_id uuid references public.accounts (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  subcategory_id uuid references public.subcategories (id) on delete set null,
  destination_amount numeric(18,2) check (destination_amount > 0),
  destination_currency text,
  transfer_fee numeric(18,2) check (transfer_fee >= 0),
  reason text not null
);

create index quick_log_drafts_user_created_idx on public.quick_log_drafts (user_id, created_at desc, id desc);
create index quick_log_drafts_account_idx on public.quick_log_drafts (account_id) where account_id is not null;
create index quick_log_drafts_to_account_idx on public.quick_log_drafts (to_account_id) where to_account_id is not null;
create index quick_log_drafts_category_idx on public.quick_log_drafts (category_id) where category_id is not null;
create index quick_log_drafts_subcategory_idx on public.quick_log_drafts (subcategory_id) where subcategory_id is not null;

alter table public.quick_log_drafts enable row level security;
revoke all on public.quick_log_drafts from public, anon, authenticated;
grant select, insert, delete on public.quick_log_drafts to authenticated;

create policy "Read own Quick Log drafts" on public.quick_log_drafts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Save own Quick Log drafts" on public.quick_log_drafts
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = (select auth.uid())))
    and (to_account_id is null or exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = (select auth.uid())))
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id))
    and (subcategory_id is null or exists (
      select 1 from public.subcategories s where s.id = subcategory_id and s.category_id = quick_log_drafts.category_id
    ))
  );
create policy "Discard own Quick Log drafts" on public.quick_log_drafts
  for delete to authenticated using (user_id = (select auth.uid()));

-- The review form posts with the original draft ID. Retire the draft in the same
-- transaction as the ledger insert, so a retry cannot post it twice.
create function private.complete_quick_log_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 0));
  delete from public.quick_log_drafts where id = new.id and user_id = new.user_id;
  return new;
end;
$$;

create trigger trg_complete_quick_log_draft
  after insert on public.transactions
  for each row when (new.entry_source = 'ai_phrase' and new.reviewed_at is not null)
  execute function private.complete_quick_log_draft();

-- A write retried after the entry has already been completed must not bring back
-- its draft. Serialize these two operations on the same submission ID.
create function private.skip_completed_quick_log_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 0));
  if exists (select 1 from public.transactions t where t.id = new.id and t.user_id = new.user_id
      and t.entry_source = 'ai_phrase' and t.reviewed_at is not null) then
    return null;
  end if;
  return new;
end;
$$;

create trigger trg_skip_completed_quick_log_draft
  before insert on public.quick_log_drafts
  for each row execute function private.skip_completed_quick_log_draft();
