#!/usr/bin/env bash
# LED-319 (REV-026): two concurrent money writes both count.
# pgTAP runs in one session, so these checks open two psql sessions against committed rows of a
# throwaway user, who is deleted on exit (deleting the auth user cascades to every public row).
# - LED-296: two payments to one card, the first holding its transaction open: both are counted.
# - LED-312: two contributions to one goal at the same time: both are added.
# Usage: bash supabase/tests/concurrency.sh   (DB_URL defaults to the local Supabase database)
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
USER_ID=$(psql "$DB_URL" -Atqc "select gen_random_uuid()")
BANK=$(psql "$DB_URL" -Atqc "select gen_random_uuid()")
CARD=$(psql "$DB_URL" -Atqc "select gen_random_uuid()")
GOAL=$(psql "$DB_URL" -Atqc "select gen_random_uuid()")
failures=0

sql() { psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq "$@"; }

# As the user, with row level security: the role and claims set together (see the pgTAP files).
as_user() {
  sql -c "begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '{\"sub\":\"$USER_ID\",\"role\":\"authenticated\"}', true);
    $1
    commit;" >/dev/null
}

cleanup() { sql -c "delete from auth.users where id = '$USER_ID'" >/dev/null || true; }
trap cleanup EXIT

expect() {
  local label=$1 want=$2 got=$3
  if [ "$got" = "$want" ]; then
    echo "ok - $label"
  else
    echo "not ok - $label (want $want, got $got)"
    failures=$((failures + 1))
  fi
}

sql -c "
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '$USER_ID', 'authenticated', 'authenticated',
  'concurrency-$USER_ID@ledger.test', '', now(), '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}',
  now(), now(), '', '', '', '');
insert into public.accounts (id, user_id, name, type, balance, statement_balance) values
  ('$BANK', '$USER_ID', 'Concurrency bank', 'checking', 5000, null),
  ('$CARD', '$USER_ID', 'Concurrency card', 'credit_card', -800, 800);
insert into public.savings_goals (id, user_id, name, target_amount, current_amount) values
  ('$GOAL', '$USER_ID', 'Concurrency goal', 1000, 100);" >/dev/null

transfer() {
  echo "insert into public.transactions (user_id, account_id, to_account_id, type, amount, description)
        values ('$USER_ID', '$BANK', '$CARD', 'transfer', $1, 'Concurrent payment $1');"
}

# LED-296: session 1 pays 200 and holds its transaction for 2 s; session 2 pays 300 meanwhile.
as_user "$(transfer 200) select pg_sleep(2);" &
first=$!
sleep 0.5
as_user "$(transfer 300)" &
second=$!
wait $first || { echo "not ok - session 1 failed"; failures=$((failures + 1)); }
wait $second || { echo "not ok - session 2 failed"; failures=$((failures + 1)); }
expect "LED-296: two concurrent card payments are both counted" "500.00" \
  "$(sql -c "select statement_paid_amount from public.accounts where id = '$CARD'")"
expect "LED-296: each payment has one row" "2" \
  "$(sql -c "select count(*) from public.credit_card_payments where account_id = '$CARD'")"
expect "The bank balance drops by both payments" "4500.00" \
  "$(sql -c "select balance from public.accounts where id = '$BANK'")"

# LED-312: 20 and 30 on a goal at 100, the first holding its transaction for 2 s.
as_user "select public.add_goal_contribution('$GOAL', 20, gen_random_uuid()); select pg_sleep(2);" &
first=$!
sleep 0.5
as_user "select public.add_goal_contribution('$GOAL', 30, gen_random_uuid());" &
second=$!
wait $first || { echo "not ok - session 1 failed"; failures=$((failures + 1)); }
wait $second || { echo "not ok - session 2 failed"; failures=$((failures + 1)); }
expect "LED-312: two concurrent contributions are both added" "150.00" \
  "$(sql -c "select current_amount from public.savings_goals where id = '$GOAL'")"

if [ "$failures" -gt 0 ]; then
  echo "$failures concurrency check(s) failed"
  exit 1
fi
echo "All concurrency checks passed"
