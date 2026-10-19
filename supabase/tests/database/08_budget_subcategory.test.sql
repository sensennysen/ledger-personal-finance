-- A budget can track one subcategory (20261019100000): it stays under the budget's category,
-- falls back to the whole category when the subcategory is deleted, and follows a merge.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'budget-sub@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.categories (id, user_id, name, type) values
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'B food', 'expense'),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'B travel', 'expense'),
  ('b2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'B shopping', 'expense');
insert into public.subcategories (id, user_id, category_id, name) values
  ('b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Groceries'),
  ('b6000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Snacks'),
  ('b6000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'Groceries');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- The parent check is deferred to commit; IMMEDIATE makes it run at the end of each statement.
set constraints all immediate;
select throws_ok(
  $$insert into public.budgets (user_id, category_id, subcategory_id, name, amount, period, start_date)
    values ('b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002',
            'b6000000-0000-4000-8000-000000000001', 'Mismatch', 100, 'monthly', current_date)$$,
  'The subcategory belongs to a different category',
  'a budget subcategory under another category is refused'
);
select lives_ok(
  $$insert into public.budgets (id, user_id, category_id, subcategory_id, name, amount, period, start_date) values
    ('b7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
     'b6000000-0000-4000-8000-000000000002', 'Snacks', 50, 'monthly', current_date),
    ('b7000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
     'b6000000-0000-4000-8000-000000000001', 'Groceries', 300, 'monthly', current_date)$$,
  'a budget subcategory under its own category is accepted'
);

delete from public.subcategories where id = 'b6000000-0000-4000-8000-000000000002';
select is(
  (select subcategory_id from public.budgets where id = 'b7000000-0000-4000-8000-000000000001'),
  null,
  'deleting the subcategory leaves the budget on its whole category'
);

-- Food's Groceries folds into Shopping's Groceries; the budget follows it.
set constraints all deferred;
select public.merge_category('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003');
select lives_ok('set constraints all immediate', 'merging a category passes the deferred budget check');
select is(
  (select subcategory_id from public.budgets where id = 'b7000000-0000-4000-8000-000000000002'),
  'b6000000-0000-4000-8000-000000000003'::uuid,
  'a budget on a folded subcategory moves to the subcategory it folds into'
);

select * from finish();
rollback;
