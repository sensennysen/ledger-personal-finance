-- ============================================================
-- WalletApp — Supabase Schema
-- Run this in your Supabase SQL editor (Database > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  default_currency text not null default 'USD',
  month_start_day  integer not null default 1 check (month_start_day between 1 and 28),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ⚠️  EXISTING DATABASE? Run this migration manually in the Supabase SQL editor:
-- alter table public.profiles
--   add column if not exists month_start_day integer not null default 1
--   check (month_start_day between 1 and 28);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Seed default categories for new user
  insert into public.categories (user_id, name, type, color, icon, is_default) values
    (new.id, 'Food & Dining',     'expense', '#f97316', '🍔', true),
    (new.id, 'Groceries',         'expense', '#22c55e', '🛒', true),
    (new.id, 'Housing & Rent',    'expense', '#6366f1', '🏠', true),
    (new.id, 'Transportation',    'expense', '#3b82f6', '🚗', true),
    (new.id, 'Health & Medical',  'expense', '#ec4899', '💊', true),
    (new.id, 'Entertainment',     'expense', '#8b5cf6', '🎮', true),
    (new.id, 'Shopping',          'expense', '#f43f5e', '👗', true),
    (new.id, 'Utilities',         'expense', '#eab308', '💡', true),
    (new.id, 'Education',         'expense', '#14b8a6', '🎓', true),
    (new.id, 'Travel',            'expense', '#06b6d4', '✈️', true),
    (new.id, 'Salary',            'income',  '#22c55e', '💼', true),
    (new.id, 'Freelance',         'income',  '#10b981', '💻', true),
    (new.id, 'Investment',        'income',  '#6366f1', '📈', true),
    (new.id, 'Business',          'income',  '#f97316', '🏢', true),
    (new.id, 'Gift',              'both',    '#a855f7', '🎁', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- ACCOUNTS
-- ────────────────────────────────────────────────────────────
create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('cash','digital_wallet','credit_card','savings','checking','investment','loan','other')),
  currency      text not null default 'USD',
  balance       numeric(18,2) not null default 0,
  color         text not null default '#6366f1',
  icon          text,
  is_active     boolean not null default true,
  credit_limit  numeric(18,2),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Users can manage own accounts"
  on public.accounts for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- CATEGORIES
-- ────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income','expense','both')),
  color       text not null default '#6366f1',
  icon        text not null default '📦',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Users can manage own categories"
  on public.categories for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  account_id            uuid not null references public.accounts(id) on delete cascade,
  to_account_id         uuid references public.accounts(id) on delete set null,
  category_id           uuid references public.categories(id) on delete set null,
  type                  text not null check (type in ('income','expense','transfer')),
  amount                numeric(18,2) not null check (amount > 0),
  currency              text not null default 'USD',
  exchange_rate         numeric(18,6) not null default 1,
  description           text not null,
  notes                 text,
  date                  date not null default current_date,
  transfer_fee          numeric(18,2) check (transfer_fee >= 0),
  is_recurring          boolean not null default false,
  recurrence_interval   text check (recurrence_interval in ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  recurrence_end_date   date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can manage own transactions"
  on public.transactions for all using (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_account_idx   on public.transactions(account_id);
create index if not exists transactions_category_idx  on public.transactions(category_id);

-- ────────────────────────────────────────────────────────────
-- BUDGETS
-- ────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  amount      numeric(18,2) not null check (amount > 0),
  currency    text not null default 'USD',
  period      text not null check (period in ('weekly','monthly','quarterly','yearly')),
  start_date  date not null,
  end_date    date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "Users can manage own budgets"
  on public.budgets for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT trigger (apply to all tables)
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at     before update on public.profiles     for each row execute procedure public.set_updated_at();
create trigger set_accounts_updated_at     before update on public.accounts     for each row execute procedure public.set_updated_at();
create trigger set_categories_updated_at   before update on public.categories   for each row execute procedure public.set_updated_at();
create trigger set_transactions_updated_at before update on public.transactions for each row execute procedure public.set_updated_at();
create trigger set_budgets_updated_at      before update on public.budgets      for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ACCOUNT BALANCE TRIGGERS
-- Automatically adjust account.balance whenever a transaction
-- is inserted, updated, or deleted.
--
-- Rules:
--   income   → +amount on account_id
--   expense  → -amount on account_id
--   transfer → -(amount + transfer_fee) on account_id
--              +(amount * exchange_rate) on to_account_id
-- ────────────────────────────────────────────────────────────

create or replace function public.update_account_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- ── Reverse the OLD row's effect ──────────────────────────
  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts set balance = balance - old.amount where id = old.account_id;

    elsif old.type = 'expense' then
      update accounts set balance = balance + old.amount where id = old.account_id;

    elsif old.type = 'transfer' then
      update accounts
        set balance = balance + old.amount + coalesce(old.transfer_fee, 0)
        where id = old.account_id;
      if old.to_account_id is not null then
        update accounts
          set balance = balance - (old.amount * old.exchange_rate)
          where id = old.to_account_id;
      end if;
    end if;
  end if;

  -- ── Apply the NEW row's effect ────────────────────────────
  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts set balance = balance + new.amount where id = new.account_id;

    elsif new.type = 'expense' then
      update accounts set balance = balance - new.amount where id = new.account_id;

    elsif new.type = 'transfer' then
      update accounts
        set balance = balance - new.amount - coalesce(new.transfer_fee, 0)
        where id = new.account_id;
      if new.to_account_id is not null then
        update accounts
          set balance = balance + (new.amount * new.exchange_rate)
          where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_balance_insert on public.transactions;
drop trigger if exists trg_update_balance_update on public.transactions;
drop trigger if exists trg_update_balance_delete on public.transactions;

create trigger trg_update_balance_insert
  after insert on public.transactions
  for each row execute procedure public.update_account_balance();

create trigger trg_update_balance_update
  after update of amount, type, account_id, to_account_id, exchange_rate, transfer_fee
  on public.transactions
  for each row execute procedure public.update_account_balance();

create trigger trg_update_balance_delete
  after delete on public.transactions
  for each row execute procedure public.update_account_balance();

-- ────────────────────────────────────────────────────────────
-- RECEIPT ATTACHMENTS
-- Run this migration to enable photo proof on transactions.
-- ────────────────────────────────────────────────────────────

-- 1. Add receipt_url column to transactions
alter table public.transactions
  add column if not exists receipt_url text;

-- 2. Create a public storage bucket for receipts
--    Files are namespaced under the user's UUID so paths are not easily guessable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
  5242880, -- 5 MB
  '{image/jpeg,image/png,image/webp,image/gif}'
)
on conflict (id) do nothing;

-- 3. RLS policies for storage.objects
--    Drop first so re-running this script is idempotent.
drop policy if exists "Authenticated users can upload their own receipts"  on storage.objects;
drop policy if exists "Authenticated users can update their own receipts"  on storage.objects;
drop policy if exists "Authenticated users can delete their own receipts"  on storage.objects;
drop policy if exists "Public can read receipts"                           on storage.objects;

--  INSERT – user may only create files under their own UUID folder
create policy "Authenticated users can upload their own receipts"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

--  UPDATE – user may only overwrite their own files
create policy "Authenticated users can update their own receipts"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

--  DELETE – user may only remove their own files
create policy "Authenticated users can delete their own receipts"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

--  SELECT – bucket is public so anyone can read (needed for rendering images)
create policy "Public can read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts');
