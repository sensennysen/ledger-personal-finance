-- LED-262: posting a recurring row does not make a queued offline edit of it look like a conflict.
-- post_recurring_transaction sets the source row's recurrence_next_posted, and set_updated_at moved
-- its updated_at with it. The offline queue flags a conflict when the server row's updated_at is
-- later than the queued change, so an edit made offline reported one when it drained, although
-- only the generator had touched the row.
--
-- The trigger now skips an update whose only change is that flag. Every other update moves
-- updated_at as before, including one that sets the flag along with other columns, so a real
-- concurrent edit still reports its conflict. An update that changes nothing still moves it too.
drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row
  when (
    old.recurrence_next_posted is not distinct from new.recurrence_next_posted
    or (to_jsonb(old) - 'recurrence_next_posted' - 'updated_at') is distinct from (to_jsonb(new) - 'recurrence_next_posted' - 'updated_at')
  )
  execute function public.set_updated_at();
