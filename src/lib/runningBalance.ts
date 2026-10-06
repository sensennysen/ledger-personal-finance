// Standing Balance for a transaction list (LED-143): what each row's own account held right
// after that row. It starts from the accounts' live balances and unwinds newest to oldest,
// undoing exactly what the database's update_account_balance trigger did on insert. That is
// supabase/migrations/20260810120000_add_loan_tracker.sql, which is why only a loan is credited by an
// expense with a target, and 20261003120000_transfer_destination_amount.sql for what a transfer
// credits. Reports and the deletion export share it.

import { paymentCredit, transferCredit } from './transferCredit.ts'

export interface BalanceAccount {
  id: string
  type: string
  balance: number
}

export interface BalanceTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  to_account_id: string | null
  amount: number
  exchange_rate: number | null
  destination_amount?: number | null
  transfer_fee: number | null
  date: string
  created_at: string
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Newest first: by date, then by when it was saved, then by id so a batch import has a fixed order. */
export function newestFirst(a: BalanceTransaction, b: BalanceTransaction): number {
  return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
}

export function buildRunningBalanceMap(
  accounts: readonly BalanceAccount[],
  transactions: readonly BalanceTransaction[],
): Map<string, number> {
  const types = new Map(accounts.map((account) => [account.id, account.type]))
  const register = new Map(accounts.map((account) => [account.id, account.balance]))
  const move = (id: string, delta: number) => {
    if (register.has(id)) register.set(id, round2((register.get(id) ?? 0) + delta))
  }

  const balances = new Map<string, number>()
  for (const tx of [...transactions].sort(newestFirst)) {
    // The balance after this transaction is what the register holds before it is undone.
    if (register.has(tx.account_id)) balances.set(tx.id, register.get(tx.account_id)!)

    for (const [id, delta] of balanceEffects(tx, types)) move(id, -delta)
  }
  return balances
}

/**
 * What the update_account_balance trigger did to each account when this row was saved, as
 * [account id, delta] pairs. `types` maps account ids to their type: only a loan target is
 * credited by an expense. buildRunningBalanceMap undoes these; scheduledBalances.ts sums them.
 */
export function balanceEffects(
  tx: Omit<BalanceTransaction, 'id' | 'date' | 'created_at'>,
  types: ReadonlyMap<string, string>,
): [string, number][] {
  if (tx.type === 'income') return [[tx.account_id, tx.amount]]
  if (tx.type === 'expense') {
    const effects: [string, number][] = [[tx.account_id, -tx.amount]]
    if (tx.to_account_id && types.get(tx.to_account_id) === 'loan') effects.push([tx.to_account_id, paymentCredit(tx)])
    return effects
  }
  const effects: [string, number][] = [[tx.account_id, -(tx.amount + (tx.transfer_fee ?? 0))]]
  if (tx.to_account_id) effects.push([tx.to_account_id, transferCredit(tx)])
  return effects
}
