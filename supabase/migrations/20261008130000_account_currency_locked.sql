-- LED-316 (REV-023): an account with history cannot silently change currency.
-- The edit form let a populated USD account become PHP: the balance was relabelled while every old
-- transaction's delta stayed in USD, so later edits and deletes mixed units in one balance.
--
-- Owner decision: block the change once history exists (no conversion workflow). History is any
-- transaction from or to the account, or a financed purchase on it. An account without history can
-- still change currency. The form locks the selector and says why (AccountForm).

create or replace function public.enforce_account_currency_locked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.currency is distinct from old.currency and (
    exists (select 1 from public.transactions t where t.account_id = old.id or t.to_account_id = old.id)
    or exists (select 1 from public.loan_purchases p where p.account_id = old.id)
  ) then
    raise exception 'This account has transactions, so its currency can''t change. Add a new account in the other currency instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_account_currency_locked on public.accounts;
create trigger trg_account_currency_locked
  before update of currency
  on public.accounts
  for each row execute procedure public.enforce_account_currency_locked();
