// The "either side of a transfer" filter, built in one place (LED-331). PostgREST's or=() takes a
// filter string, so an id from a route param interpolated as-is could add conditions of its own
// (`/accounts/x,user_id.neq.y`). An id is used bare only when it is a UUID; anything else is
// double-quoted with its quotes and backslashes escaped, so it stays one value and the read
// fails on the server as an invalid id, as it did before. Pure, so node --test can load it.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A value safe to place in a PostgREST logic-tree filter. */
export function filterValue(value: string): string {
  return UUID.test(value) ? value : `"${value.replace(/["\\]/g, '\\$&')}"`
}

/** Rows where the account is the source or the destination. */
export function eitherAccountFilter(accountId: string): string {
  const id = filterValue(accountId)
  return `account_id.eq.${id},to_account_id.eq.${id}`
}
