-- LED-312 (REV-019): concurrent savings contributions are all counted.
-- addContribution wrote current_amount = <the amount on screen> + amount, so two devices that read
-- the same starting amount overwrote each other and one contribution was lost.
--
-- add_goal_contribution locks the goal and adds in SQL, so concurrent calls queue on the row lock and
-- both count. Each call carries an operation id from the client (one per contribution dialog); the id
-- is recorded in goal_contribution_ops in the same transaction, so replaying a call whose response was
-- lost returns the current amount without adding again.
--
-- SECURITY INVOKER: row level security applies. The owner comes from the locked goal, never the
-- payload, and a goal RLS hides (another user's, or anon) answers "not found".

create table if not exists public.goal_contribution_ops (
  op_id      uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  goal_id    uuid not null references public.savings_goals(id) on delete cascade,
  amount     numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.goal_contribution_ops enable row level security;

drop policy if exists "Users can manage own goal contribution ops" on public.goal_contribution_ops;
create policy "Users can manage own goal contribution ops"
  on public.goal_contribution_ops for all
  using (auth.uid() = user_id)
  -- The goal must be the caller's too: a foreign key check ignores RLS on savings_goals.
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = auth.uid())
  );

create index if not exists goal_contribution_ops_goal_idx on public.goal_contribution_ops(goal_id);

create or replace function public.add_goal_contribution(p_goal_id uuid, p_amount numeric, p_op_id uuid)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  goal public.savings_goals%rowtype;
  recorded uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'A contribution must be more than zero';
  end if;
  if p_op_id is null then
    raise exception 'A contribution needs an operation id';
  end if;

  select * into goal from public.savings_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Savings goal not found';
  end if;

  insert into public.goal_contribution_ops (op_id, user_id, goal_id, amount)
  values (p_op_id, goal.user_id, goal.id, round(p_amount, 2))
  on conflict (op_id) do nothing
  returning op_id into recorded;

  -- Already counted: a retry after a lost response.
  if recorded is null then
    return goal.current_amount;
  end if;

  update public.savings_goals
     set current_amount = current_amount + round(p_amount, 2),
         updated_at = now()
   where id = goal.id
  returning current_amount into goal.current_amount;

  return goal.current_amount;
end;
$$;

revoke all on function public.add_goal_contribution(uuid, numeric, uuid) from public;
grant execute on function public.add_goal_contribution(uuid, numeric, uuid) to authenticated;
