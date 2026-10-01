-- ============================================================
-- Local development seed
-- Loaded automatically by `supabase start` (first run) and `supabase db reset`
-- via [db.seed] in config.toml. Never run this against a hosted project.
--
-- Demo login (email + password, shown on the login page in dev builds only):
--   email:    demo@ledger.local
--   password: ledger-demo-123
--
-- All dates are relative to current_date so the dashboard, budgets, and
-- upcoming bills always have data for the current cycle.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DEMO USER
-- Inserting into auth.users fires handle_new_user(), which creates the
-- profile and the default categories used below.
-- ────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'demo@ledger.local',
  extensions.crypt('ledger-demo-123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Demo User"}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'email',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@ledger.local","email_verified":true}',
  now(), now(), now()
);

-- Helper for the transaction inserts below. Skips future-dated rows so the
-- ledger never contains transactions that have not happened yet.
create function pg_temp.tx(
  p_account uuid, p_type text, p_amount numeric, p_description text, p_date date,
  p_category text default null, p_to_account uuid default null,
  p_tags text[] default '{}', p_subcategory text default null,
  p_goal uuid default null, p_recurring text default null
) returns void language plpgsql as $$
declare
  demo_user constant uuid := '11111111-1111-4111-8111-111111111111';
  v_category uuid;
  v_subcategory uuid;
  v_recurring text := p_recurring;
begin
  if p_date > current_date then return; end if;

  -- The app copies any recurring row whose next occurrence is already due
  -- (generateDueRecurring), so only the latest occurrence of a series may be
  -- flagged recurring; older occurrences are stored as plain history.
  if v_recurring is not null and (p_date + case v_recurring
      when 'weekly'   then interval '7 days'
      when 'biweekly' then interval '14 days'
      else                 interval '1 month'
    end)::date <= current_date then
    v_recurring := null;
  end if;

  if p_category is not null then
    select id into strict v_category from public.categories
      where user_id = demo_user and name = p_category;
  end if;
  if p_subcategory is not null then
    select id into strict v_subcategory from public.subcategories
      where user_id = demo_user and category_id = v_category and name = p_subcategory;
  end if;

  insert into public.transactions (
    user_id, account_id, to_account_id, category_id, subcategory_id, type,
    amount, currency, description, date, tags, goal_id,
    is_recurring, recurrence_interval
  ) values (
    demo_user, p_account, p_to_account, v_category, v_subcategory, p_type,
    p_amount, 'USD', p_description, p_date, p_tags, p_goal,
    v_recurring is not null, v_recurring
  );
end;
$$;

do $$
declare
  demo_user constant uuid := '11111111-1111-4111-8111-111111111111';

  -- Fixed ids so tests can reference seeded rows directly.
  cash      constant uuid := '22222222-0000-4000-8000-000000000001';
  checking  constant uuid := '22222222-0000-4000-8000-000000000002';
  savings   constant uuid := '22222222-0000-4000-8000-000000000003';
  wallet    constant uuid := '22222222-0000-4000-8000-000000000004';
  visa      constant uuid := '22222222-0000-4000-8000-000000000005';
  brokerage constant uuid := '22222222-0000-4000-8000-000000000006';
  car_loan  constant uuid := '22222222-0000-4000-8000-000000000007';

  emergency_goal constant uuid := '33333333-0000-4000-8000-000000000001';
  trip_goal      constant uuid := '33333333-0000-4000-8000-000000000002';

  this_month constant date := date_trunc('month', current_date)::date;
  m     date;
  i     integer;
  week  date;
begin
  update public.profiles
    set default_currency = 'USD', month_start_day = 1
    where id = demo_user;

  -- ── Accounts (balances are opening balances; triggers apply transactions) ──
  insert into public.accounts
    (id, user_id, name, type, balance, color, icon, credit_limit,
     statement_day, due_day, utilization_target_pct, payment_reminder_days,
     loan_pay_period, loan_due_days, sort_order, notes)
  values
    (cash,      demo_user, 'Cash Wallet',        'cash',           180.00, '#22c55e', '💵', null, null, null, null, 3, null, null, 0, null),
    (checking,  demo_user, 'Everyday Checking',  'checking',      3200.00, '#3b82f6', '🏦', null, null, null, null, 3, null, null, 1, 'Primary account for salary and bills'),
    (savings,   demo_user, 'High-Yield Savings', 'savings',       8500.00, '#14b8a6', '🐷', null, null, null, null, 3, null, null, 2, null),
    (wallet,    demo_user, 'PayPal',             'digital_wallet', 240.00, '#6366f1', '📱', null, null, null, null, 3, null, null, 3, null),
    (visa,      demo_user, 'Visa Platinum',      'credit_card',      0.00, '#f43f5e', '💳', 5000.00, 20, 10, 30, 5, null, null, 4, null),
    (brokerage, demo_user, 'Index Fund Brokerage','investment',   12400.00, '#8b5cf6', '📈', null, null, null, null, 3, null, null, 5, null),
    (car_loan,  demo_user, 'Car Loan',           'loan',             0.00, '#f97316', '🚗', null, null, null, null, 3, 'monthly', '{15}', 6, 'Auto financing');

  -- ── Subcategories ──
  insert into public.subcategories (user_id, category_id, name, sort_order)
  select demo_user, c.id, s.name, s.sort_order
  from (values
    ('Food & Dining',  'Coffee',      0),
    ('Food & Dining',  'Restaurants', 1),
    ('Transportation', 'Fuel',        0),
    ('Transportation', 'Ride Share',  1),
    ('Utilities',      'Electricity', 0),
    ('Utilities',      'Internet',    1)
  ) as s(category, name, sort_order)
  join public.categories c on c.user_id = demo_user and c.name = s.category;

  -- ── Savings goals ──
  insert into public.savings_goals
    (id, user_id, name, target_amount, current_amount, deadline, color, icon, notes)
  values
    (emergency_goal, demo_user, 'Emergency Fund', 15000.00, 8500.00, null, '#14b8a6', '🛟', 'Six months of expenses'),
    (trip_goal,      demo_user, 'Japan Trip',      4000.00, 1250.00, (this_month + interval '8 months')::date, '#ec4899', '✈️', null);

  -- ── Financed purchase on the car loan (trigger books the debt) ──
  insert into public.loan_purchases
    (user_id, account_id, category_id, name, principal_amount, term_months,
     monthly_interest_rate, monthly_installment, total_payable,
     opening_installments_paid, opening_paid_amount, first_due_date, notes)
  select demo_user, car_loan, c.id, '2022 Honda Civic', 18000.00, 48,
         0.4500, 456.00, 21888.00, 12, 5472.00,
         (this_month - interval '12 months' + interval '14 days')::date,
         '12 installments paid before tracking started'
  from public.categories c
  where c.user_id = demo_user and c.name = 'Transportation';

  -- ── Three months of history plus the current month ──
  for i in reverse 3..0 loop
    m := (this_month - make_interval(months => i))::date;

    -- Income
    perform pg_temp.tx(checking, 'income', 2850.00, 'Acme Corp payroll',  m + 14, 'Salary', p_recurring => 'monthly');
    perform pg_temp.tx(checking, 'income', 2850.00, 'Acme Corp payroll', (m + interval '1 month - 1 day')::date, 'Salary', p_recurring => 'monthly');
    if i % 2 = 1 then
      perform pg_temp.tx(wallet, 'income', 640.00, 'Logo design client', m + 9, 'Freelance', p_tags => '{side-gig}');
    end if;
    perform pg_temp.tx(brokerage, 'income', 38.20, 'Quarterly dividend', m + 27, 'Investment');

    -- Fixed bills
    perform pg_temp.tx(checking, 'expense', 1650.00, 'Maple Street Apartments rent', m, 'Housing & Rent', p_recurring => 'monthly');
    perform pg_temp.tx(checking, 'expense', 92.40 + i * 6, 'City Power & Light', m + 4, 'Utilities', p_subcategory => 'Electricity', p_recurring => 'monthly');
    perform pg_temp.tx(checking, 'expense', 65.00, 'FiberNet internet', m + 7, 'Utilities', p_subcategory => 'Internet', p_recurring => 'monthly');
    perform pg_temp.tx(visa, 'expense', 15.49, 'Netflix', m + 11, 'Entertainment', p_tags => '{subscription}', p_recurring => 'monthly');
    perform pg_temp.tx(visa, 'expense', 10.99, 'Spotify', m + 17, 'Entertainment', p_tags => '{subscription}', p_recurring => 'monthly');
    perform pg_temp.tx(checking, 'expense', 45.00, 'Gym membership', m + 2, 'Health & Medical', p_recurring => 'monthly');

    -- Car loan repayment (expense into the loan account; allocated to the purchase)
    perform pg_temp.tx(checking, 'expense', 456.00, 'Car loan installment', m + 14, 'Transportation', p_to_account => car_loan);

    -- Weekly groceries and fuel
    week := m + 2;
    while week < (m + interval '1 month')::date loop
      perform pg_temp.tx(visa, 'expense', 96.35 + (extract(day from week)::int % 5) * 11.20, 'Fresh Market groceries', week, 'Groceries');
      if extract(day from week)::int % 2 = 0 then
        perform pg_temp.tx(cash, 'expense', 48.00, 'Shell gas station', week + 1, 'Transportation', p_subcategory => 'Fuel');
      end if;
      week := week + 7;
    end loop;

    -- Dining and coffee
    perform pg_temp.tx(cash,  'expense',  5.75, 'Blue Bottle coffee', m + 3,  'Food & Dining', p_subcategory => 'Coffee');
    perform pg_temp.tx(cash,  'expense',  6.25, 'Starbucks',          m + 10, 'Food & Dining', p_subcategory => 'Coffee');
    perform pg_temp.tx(visa,  'expense', 64.80, 'Trattoria Roma',     m + 12, 'Food & Dining', p_subcategory => 'Restaurants', p_tags => '{date-night}');
    perform pg_temp.tx(visa,  'expense', 28.40, 'Chipotle',           m + 19, 'Food & Dining', p_subcategory => 'Restaurants');
    perform pg_temp.tx(wallet,'expense', 18.90, 'Uber to downtown',   m + 21, 'Transportation', p_subcategory => 'Ride Share');

    -- Variable spending
    perform pg_temp.tx(visa, 'expense', 120.00 + i * 35, 'Target', m + 16, 'Shopping');
    perform pg_temp.tx(visa, 'expense', 42.00, 'Movie night', m + 23, 'Entertainment');
    if i = 2 then
      perform pg_temp.tx(visa, 'expense', 380.00, 'Flight to Denver', m + 6, 'Travel', p_tags => '{family}');
      perform pg_temp.tx(checking, 'expense', 120.00, 'Dental cleaning', m + 18, 'Health & Medical');
    end if;
    if i = 1 then
      perform pg_temp.tx(wallet, 'expense', 89.00, 'Online course', m + 5, 'Education');
      perform pg_temp.tx(cash, 'income', 100.00, 'Birthday gift from Mom', m + 20, 'Gift');
    end if;

    -- Transfers: card payment, savings, goals, cash withdrawal
    perform pg_temp.tx(checking, 'transfer', 650.00, 'Visa payment', m + 9, p_to_account => visa);
    perform pg_temp.tx(checking, 'transfer', 400.00, 'Monthly savings', m + 15, p_to_account => savings, p_goal => emergency_goal);
    perform pg_temp.tx(checking, 'transfer', 150.00, 'Japan trip fund', m + 15, p_to_account => savings, p_goal => trip_goal);
    perform pg_temp.tx(checking, 'transfer', 200.00, 'ATM withdrawal', m + 1, p_to_account => cash);
  end loop;

  -- ── Credit card payment log ──
  insert into public.credit_card_payments (user_id, account_id, amount, payment_date, notes)
  select demo_user, visa, 650.00, (this_month - make_interval(months => n) + interval '9 days')::date, 'Autopay'
  from generate_series(1, 3) as n;

  -- ── Budgets (monthly, rollover on entertainment) ──
  insert into public.budgets (user_id, category_id, name, amount, period, start_date, rollover_enabled)
  select demo_user, c.id, b.name, b.amount, 'monthly',
         (this_month - interval '3 months')::date, b.rollover
  from (values
    ('Groceries',      'Groceries',     500.00, false),
    ('Food & Dining',  'Eating out',    200.00, false),
    ('Entertainment',  'Fun money',     100.00, true),
    ('Shopping',       'Shopping',      250.00, false),
    ('Transportation', 'Getting around',650.00, false)
  ) as b(category, name, amount, rollover)
  join public.categories c on c.user_id = demo_user and c.name = b.category;

  -- ── Auto-categorization rules ──
  insert into public.transaction_rules (user_id, keyword, category_id, type_hint, priority)
  select demo_user, r.keyword, c.id, r.type_hint, r.priority
  from (values
    ('starbucks', 'Food & Dining',  'expense', 10),
    ('uber',      'Transportation', 'expense', 10),
    ('payroll',   'Salary',         'income',  20),
    ('netflix',   'Entertainment',  'expense',  5)
  ) as r(keyword, category, type_hint, priority)
  join public.categories c on c.user_id = demo_user and c.name = r.category;
end;
$$;
