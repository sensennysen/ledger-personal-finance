begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('a9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'quick-log-a@ledger.test', '{}', '{}'),
  ('a9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'quick-log-b@ledger.test', '{}', '{}');
insert into public.accounts (id, user_id, name, type, currency, balance) values
  ('a9100000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'Dollar Savings', 'savings', 'USD', 1000),
  ('a9100000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'GCash', 'digital_wallet', 'PHP', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok(not has_function_privilege('public.consume_quick_log_quota(uuid,integer)', 'EXECUTE'), 'Users cannot reset or consume the server-side counter');
select lives_ok($$
  insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, currency,
    destination_amount, destination_currency, description, date, entry_source)
  values ('a9400000-0000-4000-8000-000000000001', auth.uid(), 'a9100000-0000-4000-8000-000000000001',
    'a9100000-0000-4000-8000-000000000002', 'transfer', 100, 'USD', 5600, 'PHP', 'Quick Log', current_date, 'ai_phrase')
$$, 'An owned cross-currency transfer with exact amounts is accepted');
select is((select balance from public.accounts where name = 'Dollar Savings'), 900::numeric, 'The source is debited once');
select is((select balance from public.accounts where name = 'GCash'), 5600::numeric, 'The destination is credited the stated amount');
select ok((select reviewed_at is null from public.transactions where id = 'a9400000-0000-4000-8000-000000000001'), 'Auto-saved entries start in review');
select throws_ok($$
  insert into public.transactions (id, user_id, account_id, to_account_id, type, amount, currency,
    destination_amount, destination_currency, description, date, entry_source)
  values ('a9400000-0000-4000-8000-000000000001', auth.uid(), 'a9100000-0000-4000-8000-000000000001',
    'a9100000-0000-4000-8000-000000000002', 'transfer', 100, 'USD', 5600, 'PHP', 'Quick Log', current_date, 'ai_phrase')
$$, '23505', 'duplicate key value violates unique constraint "transactions_pkey"', 'Retries keep the original transaction ID');
select throws_ok($$
  insert into public.transactions (user_id, account_id, to_account_id, type, amount, currency,
    destination_amount, destination_currency, description, date, entry_source)
  values (auth.uid(), 'a9100000-0000-4000-8000-000000000001', 'a9100000-0000-4000-8000-000000000002',
    'transfer', 100, 'USD', 5600, 'EUR', 'Stale account currency', current_date, 'ai_phrase')
$$, '23514', 'Check the destination account, currency and amount received.', 'A stale destination currency cannot be saved');

select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.transactions where id = 'a9400000-0000-4000-8000-000000000001'), 0::bigint, 'Another user cannot read the entry');
update public.transactions set reviewed_at = now() where id = 'a9400000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok((select reviewed_at is null from public.transactions where id = 'a9400000-0000-4000-8000-000000000001'), 'Another user cannot review the entry');
update public.transactions set reviewed_at = now() where id = 'a9400000-0000-4000-8000-000000000001';
select ok((select reviewed_at is not null from public.transactions where id = 'a9400000-0000-4000-8000-000000000001'), 'The owner can mark the entry reviewed');
delete from public.transactions where id = 'a9400000-0000-4000-8000-000000000001';
select is((select balance from public.accounts where name = 'Dollar Savings'), 1000::numeric, 'Undo reverses the debit');
select is((select balance from public.accounts where name = 'GCash'), 0::numeric, 'Undo reverses the credit');
insert into public.transactions (user_id, account_id, type, amount, currency, description, date)
values (auth.uid(), 'a9100000-0000-4000-8000-000000000001', 'expense', 1, 'USD', 'Manual path', current_date);
select is((select entry_source from public.transactions where description = 'Manual path'), 'manual', 'Existing callers default to manual');

reset role;
set local role service_role;
select ok(public.consume_quick_log_quota('a9000000-0000-4000-8000-000000000001', 1), 'The first request is allowed');
select ok(not public.consume_quick_log_quota('a9000000-0000-4000-8000-000000000001', 1), 'The next request exceeds the fixed-window cap');

select * from finish();
rollback;
