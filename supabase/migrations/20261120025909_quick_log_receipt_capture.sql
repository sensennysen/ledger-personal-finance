alter table public.transactions drop constraint transactions_entry_source_check;
alter table public.transactions add constraint transactions_entry_source_check
  check (entry_source in ('manual', 'ai_phrase', 'ai_receipt'));

alter table public.quick_log_drafts
  add column entry_source text not null default 'ai_phrase' check (entry_source in ('ai_phrase', 'ai_receipt')),
  add column receipt_url text,
  add column notes text,
  add constraint quick_log_draft_receipt_owner check (
    (entry_source = 'ai_phrase' and receipt_url is null)
    or (entry_source = 'ai_receipt' and receipt_url is not null and split_part(receipt_url, '/', 1) = user_id::text)
  );

create or replace function public.check_quick_log_accounts()
returns trigger language plpgsql set search_path = '' as $$
declare
  source_account record;
  destination record;
begin
  if new.entry_source not in ('ai_phrase', 'ai_receipt') or new.reviewed_at is not null then
    return new;
  end if;

  perform 1 from public.accounts
   where id in (new.account_id, new.to_account_id) and user_id = new.user_id
   order by id for no key update;

  select is_active, currency, type into source_account
    from public.accounts where id = new.account_id and user_id = new.user_id;
  if not found or not source_account.is_active or source_account.currency <> new.currency
     or source_account.type = 'loan'
     or (new.type <> 'expense' and source_account.type = 'credit_card') then
    raise exception 'Choose an active account in the transaction currency.' using errcode = '23514';
  end if;

  if new.type = 'transfer' then
    select is_active, currency, type into destination
      from public.accounts where id = new.to_account_id and user_id = new.user_id;
    if not found or not destination.is_active or destination.type in ('loan', 'credit_card')
       or new.account_id = new.to_account_id
       or destination.currency is distinct from new.destination_currency
       or ((destination.currency <> new.currency) <> (new.destination_amount is not null)) then
      raise exception 'Check the destination account, currency and amount received.' using errcode = '23514';
    end if;
  elsif new.to_account_id is not null then
    raise exception 'Confirm this payment in the transaction form.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger trg_complete_quick_log_draft on public.transactions;
create trigger trg_complete_quick_log_draft
  after insert on public.transactions
  for each row when (new.entry_source in ('ai_phrase', 'ai_receipt') and new.reviewed_at is not null)
  execute function private.complete_quick_log_draft();

create or replace function private.skip_completed_quick_log_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 0));
  if exists (select 1 from public.transactions t where t.id = new.id and t.user_id = new.user_id
      and t.entry_source = new.entry_source and t.reviewed_at is not null) then
    return null;
  end if;
  return new;
end;
$$;
