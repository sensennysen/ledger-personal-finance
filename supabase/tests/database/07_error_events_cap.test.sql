-- LED-328: each user is kept to 60 error reports an hour, and reports older than 90 days are pruned.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'errors-a@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'errors-b@ledger.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- An old report, written as the operator.
insert into public.error_events (user_id, created_at, kind, message, route, release, user_agent)
values ('c0000000-0000-4000-8000-000000000001', now() - interval '100 days', 'error', 'old', '/', 'x', 'ua');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.error_events (kind, message, route, release, user_agent)
    select 'error', 'loop', '/', 'x', 'ua' from generate_series(1, 75)$$,
  'Inserting past the cap does not fail');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.error_events (kind, message, route, release, user_agent) values ('error', 'b', '/', 'x', 'ua');

reset role;
select is((select count(*) from public.error_events where user_id = 'c0000000-0000-4000-8000-000000000001' and created_at > now() - interval '1 hour'),
  60::bigint, 'Only 60 reports an hour are kept');
select is((select count(*) from public.error_events where user_id = 'c0000000-0000-4000-8000-000000000001' and message = 'old'),
  0::bigint, 'Reports older than 90 days are pruned');
select is((select count(*) from public.error_events where user_id = 'c0000000-0000-4000-8000-000000000002'),
  1::bigint, 'One user''s reports do not use up another''s allowance');

select * from finish();
rollback;
