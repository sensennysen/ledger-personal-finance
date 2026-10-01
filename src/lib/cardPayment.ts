import type { Account } from '@/types'
import { daysUntilDayOfMonth, nextDayOfMonthDate } from './creditCards.ts'

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

/**
 * A description may be replaced when the user switches card only if it is empty or is
 * exactly the one we generated for the previously selected card. Anything the user typed
 * (even something starting with "Card payment - ") is left alone.
 */
export function isAutoCardPaymentDescription(description: string, previousCardName?: string | null) {
  const current = description.trim()
  if (!current) return true
  return Boolean(previousCardName) && current === defaultCardPaymentDescription(previousCardName as string)
}

export interface CardDateInfo {
  /** "Oct 1" - the design's month-and-day, no year. */
  label: string
  daysUntil: number
}

/** The next statement close or payment due date for a day-of-month, as the payment form words it (12a). */
export function getCardDateInfo(day: number | null | undefined, today: Date = new Date()): CardDateInfo | null {
  const next = nextDayOfMonthDate(day, today)
  const daysUntil = daysUntilDayOfMonth(day, today)
  if (!next || daysUntil == null) return null
  return { label: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), daysUntil }
}

/**
 * The card a payment form opens on, or null to leave the choice to the user. Only a locked card
 * or the one card that owes money is picked for them; with two or more owing, an automatic pick
 * would record a payment against an arbitrary debt (the loan rule, LED-104).
 */
export function resolveInitialCardId(
  cards: { id: string; balance: number }[],
  lockedCardAccountId: string | null | undefined,
): string | null {
  if (lockedCardAccountId) return lockedCardAccountId
  const owing = cards.filter((card) => card.balance < 0)
  if (owing.length === 1) return owing[0].id
  if (owing.length === 0 && cards.length === 1) return cards[0].id
  return null
}

/** The first account a card can be paid from: not a liability, same currency (a card payment moves no exchange rate). */
export function defaultPaymentSource(
  accounts: Pick<Account, 'id' | 'type' | 'currency' | 'is_active'>[],
  card: Pick<Account, 'id' | 'currency'>,
): string | null {
  const source = accounts.find(
    (account) =>
      account.id !== card.id &&
      account.is_active !== false &&
      account.type !== 'loan' &&
      account.type !== 'credit_card' &&
      account.currency === card.currency,
  )
  return source?.id ?? null
}

interface CardPaymentShape {
  type: 'income' | 'expense' | 'transfer'
  to_account_id: string | null
  category_id: string | null
  subcategory_id: string | null
  exchange_rate: number
  transfer_fee: number | null
  goal_id: string | null
}

/**
 * A card payment is saved as a transfer from the paying account to the card: the database
 * rejects an expense whose destination is not a loan, and only a transfer credits the card.
 * Same currency on both sides, so the rate is 1 and there is no category.
 */
export function cardPaymentTransfer<T extends CardPaymentShape>(values: T): T {
  return {
    ...values,
    type: 'transfer',
    category_id: null,
    subcategory_id: null,
    exchange_rate: 1,
    transfer_fee: null,
    goal_id: null,
  }
}

/** The card a saved transfer pays, or null when it is not a payment to a credit card. */
export function transferCard<A extends Pick<Account, 'id' | 'type'>>(
  values: Pick<CardPaymentShape, 'type' | 'to_account_id'>,
  accounts: A[],
): A | null {
  if (values.type !== 'transfer' || !values.to_account_id) return null
  const target = accounts.find((account) => account.id === values.to_account_id)
  return target?.type === 'credit_card' ? target : null
}

/**
 * Whether a saved transaction is a payment to a credit card. Card payments are not spending
 * (the spending happened when the card was used), and they stay out of every spending total
 * because those all count only `type === 'expense'` and a card payment is a transfer.
 */
export function isCardPaymentTransaction<A extends Pick<Account, 'id' | 'type'>>(
  tx: Pick<CardPaymentShape, 'type' | 'to_account_id'>,
  accounts: A[],
): boolean {
  return transferCard(tx, accounts) !== null
}

/**
 * Which generated recurring rows take the card path (LED-190): a transfer into a credit card
 * records the payment and moves the statement, as a payment made by hand does. Any other row
 * is a plain insert. `accounts` need only contain the destination.
 */
export function generatedCardPayment<A extends Pick<Account, 'id' | 'type'>>(
  tx: Pick<CardPaymentShape, 'type' | 'to_account_id'> & { amount: number; exchange_rate?: number | null },
  accounts: A[],
): { card: A; amount: number } | null {
  const card = transferCard(tx, accounts)
  return card ? { card, amount: creditedAmount(tx) } : null
}

/** What reaches the card: the amount, converted when the paying account is in another currency. */
export function creditedAmount(values: { amount: number; exchange_rate?: number | null }): number {
  return round2(values.amount * (values.exchange_rate ?? 1))
}

/**
 * The statement fields after a payment of `amount` on `date`. The paid amount never exceeds
 * the locked statement balance, and with no statement it is left alone ("Amount to pay" then
 * follows the card's balance, which the transfer has already moved).
 */
export function planStatementPayment(
  card: Pick<Account, 'statement_balance' | 'statement_paid_amount'>,
  amount: number,
  date: string,
): Pick<Account, 'statement_paid_amount' | 'last_payment_amount' | 'last_payment_date'> {
  const paid = card.statement_paid_amount ?? 0
  return {
    statement_paid_amount:
      card.statement_balance == null ? paid : round2(Math.min(paid + amount, card.statement_balance)),
    last_payment_amount: amount,
    last_payment_date: date,
  }
}
