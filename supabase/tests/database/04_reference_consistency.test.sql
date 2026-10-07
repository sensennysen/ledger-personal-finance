-- LED-319 (REV-026): what a transaction points at stays consistent, as the owner.
-- LED-315 a subcategory under its transaction's category; LED-316 an account's currency is locked
-- once it has history.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'tenant-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.accounts (id, user_id, name, type, balance) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A bank', 'checking', 5000),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'A new wallet', 'cash', 0);
insert into public.categories (id, user_id, name, type) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A test food', 'expense'),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'A test travel', 'expense');
insert into public.subcategories (id, user_id, category_id, name) values
  ('a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Groceries');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- LED-315: the checks are deferred to commit; IMMEDIATE makes them run at the end of each statement.
set constraints all immediate;
select throws_ok(
  $$insert into public.transactions (user_id, account_id, category_id, subcategory_id, type, amount, description)
    values ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
            'a2000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', 'expense', 10, 'Mismatch')$$,
  'The subcategory belongs to a different category',
  'LED-315: a subcategory under another category is refused'
);
insert into public.transactions (id, user_id, account_id, category_id, subcategory_id, type, amount, description) values
  ('a4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'expense', 10, 'Groceries');
select lives_ok(
  $$update public.transactions set category_id = 'a2000000-0000-4000-8000-000000000002', subcategory_id = null
    where id = 'a4000000-0000-4000-8000-000000000004'$$,
  'LED-315: changing the category with the subcategory cleared is accepted'
);
select throws_ok(
  $$update public.transactions set category_id = 'a2000000-0000-4000-8000-000000000001', subcategory_id = 'a6000000-0000-4000-8000-000000000001'
    where id = 'a4000000-0000-4000-8000-000000000004';
    update public.transactions set category_id = 'a2000000-0000-4000-8000-000000000002'
    where id = 'a4000000-0000-4000-8000-000000000004'$$,
  'The subcategory belongs to a different category',
  'LED-315: changing only the category is refused'
);
-- merge_category is consistent only at its end, which is why the checks are deferred.
insert into public.transactions (user_id, account_id, category_id, subcategory_id, type, amount, description) values
  ('a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'expense', 12, 'More groceries');
set constraints all deferred;
select public.merge_category('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002');
select lives_ok('set constraints all immediate', 'LED-315: merging a category passes the deferred checks');

-- LED-316: the bank has history now, the new wallet has none.
select throws_ok(
  $$update public.accounts set currency = 'PHP' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'This account has transactions, so its currency can''t change. Add a new account in the other currency instead.',
  'LED-316: an account with history keeps its currency'
);
select lives_ok(
  $$update public.accounts set currency = 'PHP' where id = 'a1000000-0000-4000-8000-000000000004'$$,
  'LED-316: an account without history can change currency'
);

select * from finish();
rollback;
