// Transfers on import (LED-75). A transfer between two of the user's own
// accounts shows up on both statements; imported as an expense on one and
// income on the other, it inflates both totals. A row the user marks as a
// transfer is written once, as a `transfer` from one account to the other,
// and the other statement's matching row is then flagged as a duplicate.

import type { Account } from '@/types'
import { generatedCardPayment } from './cardPayment.ts'

export interface TransferRule {
  keyword: string
  type_hint: 'income' | 'expense' | 'transfer' | null
  priority: number
}

export interface TransferAccount {
  id: string
  type: string
  currency: string
}

const TRANSFER_PATTERN = /\b(transfer|trf|xfer|instapay|pesonet|fund trans)/i

/**
 * Whether to suggest "Make a transfer?" for a row. The highest-priority rule
 * whose keyword the description contains decides when it has a type hint;
 * otherwise common bank transfer wording does.
 */
export function looksLikeTransfer(description: string, rules: readonly TransferRule[] = []): boolean {
  const lower = description.toLowerCase()
  const rule = [...rules]
    .sort((a, b) => b.priority - a.priority)
    .find((item) => item.keyword && lower.includes(item.keyword.toLowerCase()))
  if (rule?.type_hint) return rule.type_hint === 'transfer'
  return TRANSFER_PATTERN.test(description)
}

/**
 * The accounts a row can transfer to or from: the user's other accounts. One in another currency asks
 * for the other side's figure (`importTransferAmounts`, LED-269). Loans are left out; a loan repayment
 * is an expense with a destination, not a transfer.
 */
export function transferCandidates<T extends TransferAccount>(accounts: readonly T[], importAccount: TransferAccount): T[] {
  return accounts.filter((account) => account.id !== importAccount.id && account.type !== 'loan')
}

/**
 * What an imported transfer saves when the other account holds another currency (LED-269). The
 * statement gives one side; `otherAmount` is the other, in the other account's currency. Money out:
 * the statement's amount was sent and `otherAmount` arrived. Money in: `otherAmount` was sent and the
 * statement's amount arrived. Same currency: the statement's amount, nothing else.
 */
export function importTransferAmounts(
  direction: 'income' | 'expense',
  statementAmount: number,
  importCurrency: string,
  otherCurrency: string,
  otherAmount: number | null,
): { amount: number; currency: string; destination_amount: number | null } {
  if (otherCurrency === importCurrency || otherAmount == null) {
    return { amount: statementAmount, currency: importCurrency, destination_amount: null }
  }
  return direction === 'expense'
    ? { amount: statementAmount, currency: importCurrency, destination_amount: otherAmount }
    : { amount: otherAmount, currency: otherCurrency, destination_amount: statementAmount }
}

/** Money out of the imported account goes to the other one; money in comes from it. */
export function transferLegs(
  direction: 'income' | 'expense',
  importAccountId: string,
  otherAccountId: string,
): { account_id: string; to_account_id: string } {
  return direction === 'expense'
    ? { account_id: importAccountId, to_account_id: otherAccountId }
    : { account_id: otherAccountId, to_account_id: importAccountId }
}

export interface SavedImportRow {
  id: string
  type: 'income' | 'expense' | 'transfer'
  to_account_id: string | null
  amount: number
  exchange_rate?: number | null
  destination_amount?: number | null
  date: string
}

/**
 * The imported rows that pay a credit card (LED-270), oldest first. Each one gets the statement
 * steps a manual payment gets (`card-payment-is-a-transfer.md`); in date order, so two payments to
 * one card move its statement in the order they were made.
 */
export function importedCardPayments<A extends Pick<Account, 'id' | 'type'>>(
  rows: readonly SavedImportRow[],
  accounts: A[],
): { card: A; amount: number; date: string; transactionId: string }[] {
  return rows
    .flatMap((row) => {
      // PostgREST may return numeric columns as strings.
      const payment = generatedCardPayment(
        {
          ...row,
          amount: Number(row.amount),
          exchange_rate: row.exchange_rate == null ? null : Number(row.exchange_rate),
          destination_amount: row.destination_amount == null ? null : Number(row.destination_amount),
        },
        accounts,
      )
      return payment ? [{ ...payment, date: row.date, transactionId: row.id }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
