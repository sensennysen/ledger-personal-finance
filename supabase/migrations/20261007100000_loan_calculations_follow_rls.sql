-- LED-294 (REV-001): a loan purchase's paid and due amounts answer only for its owner.
-- loan_purchase_paid_amount and loan_purchase_due_amount were SECURITY DEFINER functions in the
-- exposed public schema, filtered only by purchase id and executable by anon. A caller holding
-- another user's purchase id could read what that user had paid and still owed.
--
-- They now run as SECURITY INVOKER, so the owner policies on loan_purchases and
-- loan_payment_allocations apply: another user and anon see no rows and get null.
-- The bodies are unchanged.
--
-- anon keeps EXECUTE on purpose. On supabase/postgres 17.6.1.111 any call to a function the
-- caller may not execute crashes the server process (signal 11), so a revoke would turn this
-- leak into a way to restart the database. RLS already returns nothing to anon.
--
-- Callers keep working:
-- - The loan triggers (allocate_loan_payment, update_loan_account_for_purchase and the rest) are
--   SECURITY DEFINER, so the helpers they call run as the trigger function's owner and still
--   see every row they need.
-- - add_unitemised_purchase is SECURITY INVOKER and reads only the caller's own purchases.
-- The client never calls these functions.

alter function public.loan_purchase_paid_amount(uuid) security invoker;
alter function public.loan_purchase_due_amount(uuid, date) security invoker;

revoke all on function public.loan_purchase_paid_amount(uuid) from public;
revoke all on function public.loan_purchase_due_amount(uuid, date) from public;
grant execute on function public.loan_purchase_paid_amount(uuid) to anon, authenticated, service_role;
grant execute on function public.loan_purchase_due_amount(uuid, date) to anon, authenticated, service_role;
