-- LED-319 (REV-026): another user and anon read none of an owner's data.
-- Covers LED-294 (loan calculations follow row level security) and every table with a user_id,
-- found from the catalog so a new table is covered without editing this file.
-- Identity switches set both the role and request.jwt.claims: `set local role anon` alone keeps
-- the previous claims, so auth.uid() would still be the last user (epic 24 phase 4 retro).
-- Never call a function the role may not EXECUTE: on local Postgres 17.6.1.111 that ends the
-- backend with signal 11 instead of "permission denied" (epic 24 phase 1 retro).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Users A and B. handle_new_user() creates each profile.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'tenant-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'tenant-b@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- A's data, written as the test owner (row level security does not apply; triggers do).
insert into public.accounts (id, user_id, name, type, balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A bank', 'checking', 5000),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'A loan', 'loan', 0);
insert into public.categories (id, user_id, name, type) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A test food', 'expense');
insert into public.savings_goals (id, user_id, name, target_amount, current_amount) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A goal', 1000, 100);
insert into public.transactions (id, user_id, account_id, category_id, type, amount, description, date) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'expense', 25, 'A lunch', current_date);
-- Six installments of 100, the first due three months ago: 0 paid, 300 due by today.
insert into public.loan_purchases (id, user_id, account_id, name, principal_amount, term_months,
  monthly_installment, total_payable, first_due_date) values
  ('a5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
   'A phone', 600, 6, 100, 600, (current_date - interval '2 months')::date);

-- Rows of each user-owned public table that the current caller can see for one owner.
-- pg_catalog, not information_schema: the latter hides tables the caller has no grant on.
create function pg_temp.visible_rows(owner uuid) returns table (tbl text, n bigint)
language plpgsql as $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c
      join pg_namespace s on s.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
     where s.nspname = 'public' and c.relkind in ('r', 'p')
     order by 1
  loop
    tbl := t;
    begin
      execute format('select count(*) from public.%I where user_id = $1', t) into n using owner;
    exception when insufficient_privilege then
      n := 0;  -- no grant at all is also "cannot see"
    end;
    return next;
  end loop;
end;
$$;

-- Owner A: the data is there, so the checks below are not vacuous.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok(
  (select count(*) from pg_temp.visible_rows('a0000000-0000-4000-8000-000000000001') where n > 0) >= 5,
  'A sees its own rows in at least five tables'
);
select is(public.loan_purchase_paid_amount('a5000000-0000-4000-8000-000000000001'), 0.00::numeric,
  'LED-294: A gets the paid amount of its own purchase');
select is(public.loan_purchase_due_amount('a5000000-0000-4000-8000-000000000001', current_date), 300.00::numeric,
  'LED-294: A gets the due amount of its own purchase');

-- User B.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty(
  $$select tbl from pg_temp.visible_rows('a0000000-0000-4000-8000-000000000001') where n > 0$$,
  'B sees no row of A in any user-owned table'
);
select is((select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 0::bigint,
  'B cannot read A''s profile');
select is(public.loan_purchase_paid_amount('a5000000-0000-4000-8000-000000000001'), null,
  'LED-294: B gets no paid amount for A''s purchase');
select is(public.loan_purchase_due_amount('a5000000-0000-4000-8000-000000000001', current_date), null,
  'LED-294: B gets no due amount for A''s purchase');

-- anon.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is_empty(
  $$select tbl from pg_temp.visible_rows('a0000000-0000-4000-8000-000000000001') where n > 0$$,
  'anon sees no row of A in any user-owned table'
);
select is(public.loan_purchase_paid_amount('a5000000-0000-4000-8000-000000000001'), null,
  'LED-294: anon gets no paid amount for A''s purchase');

select * from finish();
rollback;
