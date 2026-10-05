-- LED-254: transfers between two currencies saved before LED-185 (read only).
--
-- Before 20261003120000_transfer_destination_amount.sql a transfer had one amount, and the
-- balance trigger credited the destination with amount * exchange_rate. No screen set
-- exchange_rate (it is 1, see knowledge/rules/foreign-currency-rate-of-one-is-not-a-rate.md),
-- so 100 USD sent to a EUR account arrived as 100 EUR. Those rows still have
-- destination_amount null, and the destination balance still carries the one-to-one credit.
--
-- `credited` is what the trigger added to the destination. `estimate_at_todays_rate` is what
-- that amount buys at the user's current rates (exchange_rates, overrides over the feed, base
-- at 1; the same lookup as src/lib/exchangeRates.ts), so it is a guide, not the historical
-- figure. Opening the row in Edit asks for the amount received; saving it corrects the balance.
--
-- Runs as any role. Under RLS (the app's own users) each user sees only their rows.

with rates as (
  select
    user_id,
    (rates || overrides || jsonb_build_object(base, 1)) as merged
  from public.exchange_rates
)
select
  t.date,
  t.description,
  src.name                                             as from_account,
  src.currency                                         as from_currency,
  t.amount                                             as sent,
  dst.name                                             as to_account,
  dst.currency                                         as to_currency,
  round(t.amount * t.exchange_rate, 2)                 as credited,
  round(
    t.amount
      * nullif((r.merged ->> dst.currency)::numeric, 0)
      / nullif((r.merged ->> src.currency)::numeric, 0),
    2
  )                                                    as estimate_at_todays_rate,
  t.id
from public.transactions t
join public.accounts src on src.id = t.account_id
join public.accounts dst on dst.id = t.to_account_id
left join rates r on r.user_id = t.user_id
where t.type = 'transfer'
  and t.destination_amount is null
  and src.currency <> dst.currency
order by t.date, t.created_at;
