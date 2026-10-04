-- LED-236: a category can count as salary, so the 13th Month page reads a flag the
-- user sets instead of guessing from the name.
--
-- The backfill uses the same pattern the app matched on until now
-- (src/lib/thirteenthMonth.ts, /\b(salary|salaries|wages?|basic pay|payroll)\b/i),
-- so nothing changes for anyone until they tick another category.

alter table public.categories
  add column if not exists counts_as_salary boolean not null default false;

update public.categories
set counts_as_salary = true
where name ~* '\y(salary|salaries|wages?|basic pay|payroll)\y';

-- New users: the default Salary category counts as salary. Body as in the baseline,
-- with the flag on that one row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Seed default categories for new user
  insert into public.categories (user_id, name, type, color, icon, is_default, counts_as_salary) values
    (new.id, 'Food & Dining',     'expense', '#f97316', '🍔', true, false),
    (new.id, 'Groceries',         'expense', '#22c55e', '🛒', true, false),
    (new.id, 'Housing & Rent',    'expense', '#6366f1', '🏠', true, false),
    (new.id, 'Transportation',    'expense', '#3b82f6', '🚗', true, false),
    (new.id, 'Health & Medical',  'expense', '#ec4899', '💊', true, false),
    (new.id, 'Entertainment',     'expense', '#8b5cf6', '🎮', true, false),
    (new.id, 'Shopping',          'expense', '#f43f5e', '👗', true, false),
    (new.id, 'Utilities',         'expense', '#eab308', '💡', true, false),
    (new.id, 'Education',         'expense', '#14b8a6', '🎓', true, false),
    (new.id, 'Travel',            'expense', '#06b6d4', '✈️', true, false),
    (new.id, 'Salary',            'income',  '#22c55e', '💼', true, true),
    (new.id, 'Freelance',         'income',  '#10b981', '💻', true, false),
    (new.id, 'Investment',        'income',  '#6366f1', '📈', true, false),
    (new.id, 'Business',          'income',  '#f97316', '🏢', true, false),
    (new.id, 'Gift',              'both',    '#a855f7', '🎁', true, false);

  return new;
end;
$$;
