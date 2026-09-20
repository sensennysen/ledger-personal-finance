import type { Account } from '@/types'

// Card balances are stored as liabilities: 0 = nothing owed, -1240 = owe 1,240,
// positive = statement credit. Nothing here caps the amount; overpaying is allowed.
export interface CardPaymentSummary {
  owed: number
  available: number | null
  afterBalance: number
  utilisationBefore: number
  utilisationAfter: number
  overpayment: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

function utilisationPct(owed: number, creditLimit: number | null) {
  if (!creditLimit || creditLimit <= 0) return 0
  return Math.max(0, Math.min((owed / creditLimit) * 100, 999))
}

export function getCardPaymentSummary(
  balance: number,
  creditLimit: number | null,
  amount: number
): CardPaymentSummary {
  const paid = Number.isFinite(amount) && amount > 0 ? amount : 0
  const owed = Math.max(0, -balance)
  const afterBalance = round2(balance + paid)
  return {
    owed: round2(owed),
    available: creditLimit && creditLimit > 0 ? Math.max(0, round2(creditLimit + balance)) : null,
    afterBalance,
    utilisationBefore: utilisationPct(owed, creditLimit),
    utilisationAfter: utilisationPct(Math.max(0, -afterBalance), creditLimit),
    overpayment: round2(Math.max(0, paid - owed)),
  }
}

export interface CardPaymentPresets {
  full: number
  // Unpaid part of the locked statement balance. Null when no statement balance is set.
  statement: number | null
}

export function getCardPaymentPresets(
  account: Pick<Account, 'balance' | 'statement_balance' | 'statement_paid_amount'>
): CardPaymentPresets {
  const full = round2(Math.max(0, -account.balance))
  if (account.statement_balance == null) return { full, statement: null }
  const remaining = round2(account.statement_balance - (account.statement_paid_amount ?? 0))
  return { full, statement: Math.min(Math.max(0, remaining), full) }
}

export function defaultCardPaymentDescription(cardName: string) {
  return `Card payment - ${cardName}`
}

export function isCardPaymentDescription(description: string) {
  return description.startsWith('Card payment - ')
}
