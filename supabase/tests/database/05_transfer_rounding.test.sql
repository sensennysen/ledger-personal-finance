-- LED-326: a transfer without a destination_amount credits round(amount * exchange_rate, 2), and an
-- edit or a delete reverses exactly that, so the destination balance does not drift by a cent.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'rounding@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.accounts (id, user_id, name, type, balance) values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'From', 'checking', 1000),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'To', 'checking', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- 10 x 1.0005 = 10.005: credited as 10.01.
insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, exchange_rate, description, date) values
  ('e4000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'transfer', 10, 1.0005, 'Move', current_date);
select is((select balance from public.accounts where id = 'e1000000-0000-4000-8000-000000000002'),
  10.01::numeric, 'The destination is credited the product rounded to cents');

-- An edit reverses the old credit and applies the new one, with nothing left over.
update public.transactions set amount = 20 where id = 'e4000000-0000-4000-8000-000000000001';
select is((select balance from public.accounts where id = 'e1000000-0000-4000-8000-000000000002'),
  20.01::numeric, 'An edit moves the destination by the rounded difference only');

delete from public.transactions where id = 'e4000000-0000-4000-8000-000000000001';
select is((select balance from public.accounts where id = 'e1000000-0000-4000-8000-000000000002'),
  0.00::numeric, 'A delete returns the destination to exactly where it was');

select * from finish();
rollback;
