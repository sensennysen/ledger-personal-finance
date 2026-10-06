-- LED-266: card reminders already shown live in the database (decision C, 2026-10-05).
-- Which reminders were shown was a per-browser key (<user id>:cc-notifs-sent), so every device showed
-- each reminder again, and the key only ever grew.
--
-- One row per reminder shown. The key names the card, the kind and the day
-- (`<account>:statement:<date>` or `<account>:due:<date>:<days left>`). A device claims a reminder by
-- inserting its row; only the insert that adds the row shows it, so two devices racing each other show
-- it once. The client deletes rows older than 60 days, so the table stays small.
create table if not exists public.card_reminders_sent (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_key text not null,
  sent_on date not null default current_date,
  primary key (user_id, reminder_key),
  constraint card_reminders_sent_key_length check (char_length(reminder_key) between 1 and 200)
);

create index if not exists card_reminders_sent_user_sent_on_idx
  on public.card_reminders_sent (user_id, sent_on);

alter table public.card_reminders_sent enable row level security;

drop policy if exists "Users can manage own card reminders" on public.card_reminders_sent;
create policy "Users can manage own card reminders"
  on public.card_reminders_sent
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.card_reminders_sent to authenticated, service_role;
