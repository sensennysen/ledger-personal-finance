begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('b9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'quick-draft-a@ledger.test', '{}', '{}'),
  ('b9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'quick-draft-b@ledger.test', '{}', '{}');
insert into public.accounts (id, user_id, name, type, currency, balance) values
  ('b9100000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'Draft test wallet', 'digital_wallet', 'PHP', 1000),
  ('b9100000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000002', 'Another wallet', 'digital_wallet', 'PHP', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$
  insert into public.quick_log_drafts (id, phrase, kind, amount, currency, reason)
  values ('b9400000-0000-4000-8000-000000000001', 'Lunch 189', 'expense', 189, 'PHP', 'Missing account')
$$, 'The owner can save recognized fields without an account');
select is((select balance from public.accounts where name = 'Draft test wallet'), 1000::numeric, 'Drafts do not change balances');
select throws_ok($$
  insert into public.quick_log_drafts (id, phrase, reason, account_id)
  values ('b9400000-0000-4000-8000-000000000003', 'Lunch 189', 'Invalid account', 'b9100000-0000-4000-8000-000000000002')
$$, '42501', 'new row violates row-level security policy for table "quick_log_drafts"', 'An account reference must belong to the draft owner');
select lives_ok($$
  insert into public.quick_log_drafts (id, phrase, reason)
  values ('b9400000-0000-4000-8000-000000000001', 'Lunch 189', 'Missing account') on conflict (id) do nothing
$$, 'Retrying the save keeps the same draft');

select set_config('request.jwt.claims', '{"sub":"b9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.quick_log_drafts), 0::bigint, 'Another user cannot read the original phrase');
delete from public.quick_log_drafts where id = 'b9400000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select amount from public.quick_log_drafts where id = 'b9400000-0000-4000-8000-000000000001'), 189::numeric, 'Another user cannot discard the draft');

select throws_ok($$
  insert into public.transactions (id, user_id, account_id, type, amount, currency, description, date, entry_source, reviewed_at)
  values ('b9400000-0000-4000-8000-000000000001', auth.uid(), 'b9100000-0000-4000-8000-000000000001',
    'expense', 0, 'PHP', 'Lunch', current_date, 'ai_phrase', now())
$$, '23514', null, 'An incomplete transaction cannot post');
select is((select count(*) from public.quick_log_drafts), 1::bigint, 'An invalid post leaves the draft available');
select lives_ok($$
  insert into public.transactions (id, user_id, account_id, type, amount, currency, description, date, entry_source, reviewed_at)
  values ('b9400000-0000-4000-8000-000000000001', auth.uid(), 'b9100000-0000-4000-8000-000000000001',
    'expense', 189, 'PHP', 'Lunch', current_date, 'ai_phrase', now())
$$, 'Completing the draft posts the reviewed transaction');
select is((select count(*) from public.quick_log_drafts), 0::bigint, 'Posting retires the draft atomically');
select is((select balance from public.accounts where name = 'Draft test wallet'), 811::numeric, 'Only the completed entry changes the balance');
insert into public.quick_log_drafts (id, phrase, reason)
values ('b9400000-0000-4000-8000-000000000001', 'Lunch 189', 'Missing account') on conflict (id) do nothing;
select is((select count(*) from public.quick_log_drafts), 0::bigint, 'A late retry cannot bring back the completed draft');

insert into public.quick_log_drafts (id, phrase, reason)
values ('b9400000-0000-4000-8000-000000000002', 'Groceries', 'Missing amount');
delete from public.quick_log_drafts where id = 'b9400000-0000-4000-8000-000000000002';
select is((select count(*) from public.quick_log_drafts), 0::bigint, 'The owner can discard an incomplete draft');

select throws_ok($$
  insert into public.quick_log_drafts (id, phrase, reason, entry_source, receipt_url)
  values ('b9400000-0000-4000-8000-000000000004', 'Captured receipt', 'Check total', 'ai_receipt',
    'b9000000-0000-4000-8000-000000000002/captures/foreign.jpg')
$$, '23514', null, 'Receipt drafts reject another user’s attachment path');

select lives_ok($$
  insert into public.transactions (id, user_id, account_id, type, amount, currency, description, date, entry_source, receipt_url)
  values ('b9400000-0000-4000-8000-000000000005', auth.uid(), 'b9100000-0000-4000-8000-000000000001',
    'expense', 10, 'PHP', 'Captured lunch', current_date, 'ai_receipt', auth.uid()::text || '/captures/lunch.jpg')
$$, 'A receipt can post directly for review');
select ok((select reviewed_at is null from public.transactions where description = 'Captured lunch'),
  'A directly posted receipt starts in Needs review');
select throws_ok($$
  insert into public.transactions (user_id, account_id, type, amount, currency, description, date, entry_source)
  values (auth.uid(), 'b9100000-0000-4000-8000-000000000001', 'expense', 10, 'USD', 'Wrong currency', current_date, 'ai_receipt')
$$, '23514', null, 'A directly posted receipt must match the account currency');

select lives_ok($$
  insert into public.quick_log_drafts (id, phrase, reason, entry_source, receipt_url, notes)
  values ('b9400000-0000-4000-8000-000000000004', 'Captured receipt', 'Check total', 'ai_receipt',
    auth.uid()::text || '/captures/draft.jpg', 'Payment method: Cash.')
$$, 'A capture draft can keep its photo reference and payment method');
select is((select balance from public.accounts where name = 'Draft test wallet'), 801::numeric,
  'The receipt draft leaves the posted balance alone');
select lives_ok($$
  insert into public.transactions (id, user_id, account_id, type, amount, currency, description, date, entry_source, reviewed_at, receipt_url)
  values ('b9400000-0000-4000-8000-000000000004', auth.uid(), 'b9100000-0000-4000-8000-000000000001', 'expense', 5, 'PHP',
    'Completed capture', current_date, 'ai_receipt', now(), auth.uid()::text || '/captures/draft.jpg')
$$, 'A completed receipt draft posts under the original receipt source');
select is((select count(*) from public.quick_log_drafts where entry_source = 'ai_receipt'), 0::bigint,
  'Posting retires the receipt draft');

select * from finish();
rollback;
