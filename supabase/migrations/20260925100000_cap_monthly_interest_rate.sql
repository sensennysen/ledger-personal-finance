-- LED-133: server-side cap on the monthly interest rate.
-- The client rejects rates above MAX_MONTHLY_INTEREST_PCT (src/lib/loanRate.ts, 10);
-- this keeps a request that bypasses the form from storing an absurd rate.
-- NOT VALID: rows already above the cap are left alone and no data is rewritten,
-- but every insert and every update of a row is checked. tests/loanRateSql.test.mjs
-- fails if this number and the client constant differ.
alter table public.loan_purchases
  drop constraint if exists loan_purchases_monthly_interest_rate_max,
  add constraint loan_purchases_monthly_interest_rate_max
    check (monthly_interest_rate <= 10) not valid;
