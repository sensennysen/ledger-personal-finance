// How much of a stored balance is still scheduled (LED-251, OD-14 (a)). The balance trigger applies a
// row when it is saved, so a row dated after today is already in the stored balance and net worth,
// while LED-238 keeps it out of every cycle total. Balances stay as stored; screens show the
// scheduled part beside them as "after − X scheduled". No app imports, so node --test loads it.

import type { Account } from '@/types'
import { summarizeBalances } from './accountsOverview.ts'
import { countsYet } from './countsYet.ts'
import type { ConvertFn } from './exchangeRates.ts'
import { roundMoney } from './loanInstallments.ts'
import { balanceEffects, type BalanceTransaction } from './runningBalance.ts'

export type ScheduledRow = Omit<BalanceTransaction, 'id' | 'created_at'>

/** Per account, what rows dated after `today` added to its stored balance. Accounts with none are left out. */
export function scheduledByAccount(
  accounts: readonly Pick<Account, 'id' | 'type'>[],
  rows: readonly ScheduledRow[],
  today: string,
): Map<string, number> {
  const types = new Map(accounts.map((account) => [account.id, account.type as string]))
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (countsYet(row.date, today)) continue
    for (const [id, delta] of balanceEffects(row, types)) {
      if (types.has(id)) totals.set(id, roundMoney((totals.get(id) ?? 0) + delta))
    }
  }
  for (const [id, delta] of totals) if (delta === 0) totals.delete(id)
  return totals
}

/** Each account's balance as of today: the stored balance less what is scheduled for it. */
export function balancesAsOfToday<T extends Account>(accounts: readonly T[], scheduled: ReadonlyMap<string, number>): T[] {
  return accounts.map((account) => {
    const delta = scheduled.get(account.id)
    return delta ? { ...account, balance: roundMoney(account.balance - delta) } : account
  })
}

/**
 * What rows dated after `today` added to net worth in `baseCurrency`. Both sides go through
 * summarizeBalances, so conversion and the accounts it leaves out match the headline figure.
 */
export function scheduledNetWorth(
  accounts: Account[],
  rows: readonly ScheduledRow[],
  today: string,
  baseCurrency: string,
  convert?: ConvertFn,
): number {
  const scheduled = scheduledByAccount(accounts, rows, today)
  if (scheduled.size === 0) return 0
  const stored = summarizeBalances(accounts, baseCurrency, convert).netWorth
  const asOfToday = summarizeBalances(balancesAsOfToday(accounts, scheduled), baseCurrency, convert).netWorth
  return roundMoney(stored - asOfToday)
}

/** "after − ₱100.00 scheduled" beside a stored balance, or null when nothing scheduled moves it. */
export function afterScheduledLabel(delta: number, currency: string, format: (amount: number, currency: string) => string): string | null {
  if (!delta) return null
  return `after ${delta < 0 ? '−' : '+'} ${format(Math.abs(delta), currency)} scheduled`
}
