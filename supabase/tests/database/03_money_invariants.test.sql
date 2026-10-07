-- LED-319 (REV-026): money writes keep their invariants, as the owner.
-- LED-296 card payment recorded on insert, once; LED-312 contribution replay. Concurrent payments
-- and contributions need two sessions, so they live in supabase/tests/concurrency.sh.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'tenant-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.accounts (id, user_id, name, type, balance, statement_balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A bank', 'checking', 5000, null),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'A card', 'credit_card', -800, 800);
insert into public.savings_goals (id, user_id, name, target_amount, current_amount) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A goal', 1000, 100);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- LED-296: a transfer into a card records its payment in the same statement.
insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, description, date) values
  ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'transfer', 200, 'Pay card', current_date);
select is((select count(*) from public.credit_card_payments where transaction_id = 'a4000000-0000-4000-8000-000000000003'),
  1::bigint, 'LED-296: the transfer records one card payment');
select is((select statement_paid_amount from public.accounts where id = 'a1000000-0000-4000-8000-000000000003'),
  200.00::numeric, 'LED-296: the statement paid amount moves by the payment');
select is((select balance from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'),
  4800.00::numeric, 'The bank balance drops by the transfer');
select is((select balance from public.accounts where id = 'a1000000-0000-4000-8000-000000000003'),
  -600.00::numeric, 'The card balance rises by the transfer');

select throws_ok(
  $$insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, description, date)
    values ('a4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'transfer', 200, 'Replay', current_date)$$,
  '23505', null,
  'LED-296: replaying the same transaction id fails'
);
select is((select statement_paid_amount from public.accounts where id = 'a1000000-0000-4000-8000-000000000003'),
  200.00::numeric, 'LED-296: the replay counts nothing');
select is((select count(*) from public.credit_card_payments where account_id = 'a1000000-0000-4000-8000-000000000003'),
  1::bigint, 'LED-296: the replay adds no payment row');

update public.transactions set amount = 250 where id = 'a4000000-0000-4000-8000-000000000003';
select is((select statement_paid_amount from public.accounts where id = 'a1000000-0000-4000-8000-000000000003'),
  250.00::numeric, 'An edit moves the paid amount');
delete from public.transactions where id = 'a4000000-0000-4000-8000-000000000003';
select is((select statement_paid_amount from public.accounts where id = 'a1000000-0000-4000-8000-000000000003'),
  0.00::numeric, 'A delete takes the payment back');
select is((select balance from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'),
  5000.00::numeric, 'The bank balance is restored after the delete');

-- LED-312: a contribution is an increment keyed by its operation id.
select is(public.add_goal_contribution('a3000000-0000-4000-8000-000000000001', 20, 'a7000000-0000-4000-8000-000000000001'),
  120.00::numeric, 'LED-312: a contribution adds to the saved amount');
select is(public.add_goal_contribution('a3000000-0000-4000-8000-000000000001', 20, 'a7000000-0000-4000-8000-000000000001'),
  120.00::numeric, 'LED-312: replaying the operation id adds nothing');
select throws_ok(
  $$select public.add_goal_contribution('a3000000-0000-4000-8000-000000000001', -5, gen_random_uuid())$$,
  'A contribution must be more than zero',
  'LED-312: a negative contribution is refused'
);

select * from finish();
rollback;
