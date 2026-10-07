-- LED-319 (REV-026): a user cannot write a reference to another user's row, or write as anon.
-- A foreign key check ignores row level security, so each reference has an ownership check:
-- LED-296 (transfer into another user's card), LED-312 (contribution ops), LED-314 (goal, rule
-- category, card payment, 13th-month pick). See 01_tenant_isolation for the identity rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'tenant-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'tenant-b@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- A: a bank, a card, a category, a goal and a transfer paying the card.
insert into public.accounts (id, user_id, name, type, balance, statement_balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A bank', 'checking', 5000, null),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'A card', 'credit_card', -800, 800);
insert into public.categories (id, user_id, name, type) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A test food', 'expense');
insert into public.savings_goals (id, user_id, name, target_amount, current_amount) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A goal', 1000, 100);
insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, description, date) values
  ('a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'transfer', 100, 'A pays card', current_date);

-- B: a bank and a card of its own.
insert into public.accounts (id, user_id, name, type, balance) values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'B bank', 'checking', 5000),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'B card', 'credit_card', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.transactions (user_id, account_id, to_account_id, type, amount, description)
    values ('b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
            'a1000000-0000-4000-8000-000000000003', 'transfer', 50, 'B pays A''s card')$$,
  'Transaction destination account must belong to the same user',
  'LED-296: B cannot transfer into A''s card'
);
select throws_ok(
  $$insert into public.transactions (user_id, account_id, goal_id, type, amount, description)
    values ('b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
            'a3000000-0000-4000-8000-000000000001', 'income', 50, 'B funds A''s goal')$$,
  'Transaction savings goal must belong to the same user',
  'LED-314: B cannot link a transaction to A''s goal'
);
select throws_ok(
  $$insert into public.transaction_rules (user_id, keyword, category_id)
    values ('b0000000-0000-4000-8000-000000000002', 'coffee', 'a2000000-0000-4000-8000-000000000001')$$,
  'Rule category must belong to the same user',
  'LED-314: B cannot point a rule at A''s category'
);
select throws_ok(
  $$insert into public.credit_card_payments (user_id, account_id, amount)
    values ('b0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', 10)$$,
  'A card payment must be to your own credit card',
  'LED-314: B cannot record a payment on A''s card'
);
select throws_ok(
  $$insert into public.credit_card_payments (user_id, account_id, amount, transaction_id)
    values ('b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', 100,
            'a4000000-0000-4000-8000-000000000002')$$,
  'A card payment''s transfer must belong to the same user',
  'LED-314: B cannot link its payment to A''s transfer'
);
select throws_ok(
  $$insert into public.thirteenth_month_picks (user_id, year, transaction_id)
    values ('b0000000-0000-4000-8000-000000000002', 2026, 'a4000000-0000-4000-8000-000000000002')$$,
  'A 13th-month pick must be one of your own transactions',
  'LED-314: B cannot pick A''s transaction'
);
select throws_ok(
  $$insert into public.goal_contribution_ops (op_id, user_id, goal_id, amount)
    values (gen_random_uuid(), 'b0000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 10)$$,
  '42501', null,
  'LED-312: B cannot record a contribution op on A''s goal'
);
select throws_ok(
  $$select public.add_goal_contribution('a3000000-0000-4000-8000-000000000001', 10, gen_random_uuid())$$,
  'Savings goal not found',
  'LED-312: B cannot contribute to A''s goal'
);
select results_eq(
  $$with u as (update public.accounts set balance = 0 where id = 'a1000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$,
  $$values (0)$$,
  'B cannot update A''s account'
);

-- The rejected writes left A's goal and card untouched.
reset role;
select is((select current_amount from public.savings_goals where id = 'a3000000-0000-4000-8000-000000000001'), 100.00::numeric,
  'A''s goal is unchanged');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$insert into public.transactions (user_id, account_id, type, amount, description)
    values ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'expense', 1, 'anon')$$,
  '42501', null,
  'anon cannot insert a transaction'
);

select * from finish();
rollback;
