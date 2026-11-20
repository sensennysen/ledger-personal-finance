import { isQuickLogDate, uniqueCashAccount, type QuickLogCandidate, type ReceiptPaymentMethod } from '../../supabase/functions/_shared/quickLog.ts'
import { isQuickLogExpenseAccount, isQuickLogReceivingAccount, mentionsLiteral, parseQuickLogAmount, type QuickLogResolution } from './quickLog.ts'

type Account = Parameters<typeof isQuickLogExpenseAccount>[0]
type Inputs = Omit<Parameters<typeof import('./quickLog.ts').resolveQuickLog>[0], 'phrase'> & { selectedAccountId: string | null }

const paymentLabels: Record<ReceiptPaymentMethod, string> = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', digital_wallet: 'Digital wallet', other: 'Other',
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
const genericPaymentNames = new Set([
  'cash', 'cash on hand', 'cash tendered', 'cash payment',
  'card', 'credit', 'debit', 'credit card', 'debit card', 'visa', 'mastercard', 'jcb', 'amex',
  'american express', 'bank transfer', 'transfer', 'wallet', 'digital wallet', 'e-wallet', 'other',
])

function matchReceiptAccount(accounts: Account[], evidence: string | null, suggestion?: string | null) {
  const name = normalize(evidence ?? '')
  if (name && !genericPaymentNames.has(name)) {
    const exact = accounts.filter((account) => normalize(account.name) === name)
    if (exact.length > 0) return exact.length === 1 && (!suggestion || exact[0].id === suggestion) ? exact[0] : undefined

    // A printed provider may be only part of the Ledger name (for example, GCash Wallet).
    if (name.length >= 2 && suggestion) {
      const matches = accounts.filter((account) => mentionsLiteral(normalize(account.name), name))
      if (matches.length === 1 && matches[0].id === suggestion) return matches[0]
    }
  }
  return undefined
}

function receiptAmount(candidate: QuickLogCandidate['amount'], locale: string) {
  if (!candidate || !/^\d+(?:\.\d{1,2})?$/.test(candidate.decimal)) return null
  const amount = Number(candidate.decimal)
  return [locale, 'en-US', 'de-DE', 'fr-FR'].some((format) => parseQuickLogAmount(candidate.text, format) === amount)
    ? amount : null
}

export function resolveQuickLogReceipt({
  candidate, today, accounts, selectedAccountId, expenseAccountId, incomeAccountId, currencies, categories, rule,
}: Inputs): QuickLogResolution {
  const kind = candidate.intent === 'unclear' ? null : candidate.intent
  const isPayment = kind === 'loan-repayment' || kind === 'card-payment'
  const type = !kind || isPayment ? 'expense' : kind
  const currency = candidate.currency ?? candidate.defaultCurrency
  const validCurrency = currencies.includes(currency) && candidate.ambiguity !== 'currency'
  const date = candidate.date === null && candidate.dateText === null ? today
    : isQuickLogDate(candidate.date) && candidate.date <= today && candidate.dateText ? candidate.date : ''
  const amount = receiptAmount(candidate.amount, candidate.numberLocale)
  const active = accounts.filter((account) => account.is_active)
  const eligible = type === 'expense' && !isPayment ? isQuickLogExpenseAccount : isQuickLogReceivingAccount
  const picked = active.find((account) => account.id === selectedAccountId)
  const cashPayment = candidate.paymentMethod === 'cash' && (kind === 'expense' || kind === 'income')
  const inferred = selectedAccountId ? undefined
    : cashPayment ? uniqueCashAccount(active, currency)
      : matchReceiptAccount(active, candidate.account, candidate.accountId)
  const useDefault = !selectedAccountId && !inferred && !!kind && !isPayment && type !== 'transfer'
  const fallback = useDefault ? active.find((account) => account.id === (type === 'income' ? incomeAccountId : expenseAccountId)) : undefined
  const source = picked ?? inferred ?? fallback
  const destination = matchReceiptAccount(active, candidate.destination, candidate.destinationAccountId)
  const category = type === 'transfer' || kind === 'card-payment' ? undefined : categories.find((item) =>
    item.id === (rule?.category_id ?? candidate.categoryId) && (item.type === type || item.type === 'both'))
  const description = candidate.description?.trim().slice(0, 160) || ''
  const notes = [
    candidate.paymentMethod && 'Payment method: ' + paymentLabels[candidate.paymentMethod] + '.',
    fallback && 'The receipt did not identify an account. Review the default ' + type + ' account used.',
  ].filter(Boolean).join('\n') || null
  const values: Extract<QuickLogResolution, { ready: true }>['values'] = {
    type, account_id: source && eligible(source) ? source.id : '',
    to_account_id: (type === 'transfer' || isPayment) && source?.id !== destination?.id ? destination?.id ?? null : null,
    category_id: category?.id ?? null,
    subcategory_id: category && category.id === candidate.subcategoryParentId ? candidate.subcategoryId : null,
    amount: amount ?? 0, currency, exchange_rate: 1,
    destination_amount: destination && destination.currency !== currency && candidate.receivedCurrency === destination.currency
      ? receiptAmount(candidate.received, candidate.numberLocale) : null,
    description, notes, date, transfer_fee: type === 'transfer' ? receiptAmount(candidate.fee, candidate.numberLocale) : null,
    is_recurring: false, recurrence_interval: null, recurrence_end_date: null, receipt_url: null, tags: [], goal_id: null,
  }
  const review = (reason: string): QuickLogResolution => ({
    ready: false, kind, reason, values: { ...values, currency: validCurrency ? currency : undefined },
    destinationCurrency: destination?.currency ?? null,
  })
  if (candidate.ambiguity === 'multiple_transactions') return review('The image appears to contain more than one transaction.')
  if (amount === null || candidate.ambiguity === 'amount') return review('The final amount charged or refunded could not be verified.')
  if (!kind || candidate.ambiguity === 'transaction_type') return review('The receipt does not clearly show the transaction type.')
  if (!validCurrency) return review('The receipt currency could not be verified.')
  if (!date || candidate.ambiguity === 'date') return review('The receipt date could not be verified.')
  if (!source || !eligible(source)) return review('Choose an active account for this receipt.')
  if (source.currency !== currency) return review('The receipt uses ' + currency + ', but the account uses ' + source.currency + '.')
  if (isPayment) return review('Review the payment and its card or loan details.')
  if (type === 'transfer') return review('Review the transfer accounts and amounts shown on the receipt.')
  if (candidate.ambiguity === 'transfer_details' || (candidate.ambiguous && candidate.ambiguity !== 'account')) {
    return review('Some receipt details could not be verified.')
  }
  if (!description) return review('The merchant or payer could not be identified.')
  if (rule?.type_hint && rule.type_hint !== type) return review('A matching category rule uses a different transaction type.')
  if (!category) return review('No matching ' + type + ' category was found for the receipt.')
  return { ready: true, values, destinationCurrency: null }
}
