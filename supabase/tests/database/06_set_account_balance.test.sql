-- LED-327: set_account_balance lands on the balance typed, against the balance the server holds.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'balance-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'balance-b@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.accounts (id, user_id, name, type, balance) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'A bank', 'checking', 400),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'B bank', 'checking', 900);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Another device moved the balance to 450 after this one read 400.
insert into public.transactions (user_id, account_id, type, amount, description, date) values
  ('f0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'income', 50, 'Elsewhere', current_date);

select is(public.set_account_balance('f1000000-0000-4000-8000-000000000001', 500, 'Balance Adjustment', current_date),
  500.00::numeric, 'The balance lands on the amount typed, not the cached balance plus the difference');
select is((select amount from public.transactions where account_id = 'f1000000-0000-4000-8000-000000000001' and description = 'Balance Adjustment'),
  50.00::numeric, 'The adjustment is the difference from the balance the server held');

select is(public.set_account_balance('f1000000-0000-4000-8000-000000000001', 500, 'Balance Adjustment', current_date),
  500.00::numeric, 'A replay finds the balance already there');
select is((select count(*) from public.transactions where description = 'Balance Adjustment'),
  1::bigint, 'and adds nothing');

select is(public.set_account_balance('f1000000-0000-4000-8000-000000000001', 120.5, 'Balance Adjustment', current_date),
  120.50::numeric, 'A lower balance is recorded as an expense');

select throws_ok(
  $$select public.set_account_balance('f1000000-0000-4000-8000-000000000002', 0, 'Balance Adjustment', current_date)$$,
  'P0001', 'Account not found', 'Another user''s account is not found');

select * from finish();
rollback;
