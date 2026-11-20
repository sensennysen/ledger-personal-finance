import {
  isQuickLogDate, type QuickLogAmount, type QuickLogCandidate,
} from '../../supabase/functions/_shared/quickLog.ts'

type Account = { id: string; name: string; currency: string; type: string; is_active: boolean }
type AccountMatch = { account?: Account; problem?: string }
type Kind = 'expense' | 'income' | 'transfer' | 'card-payment' | 'loan-repayment'
type Category = { id: string; type: string }
type Rule = { category_id: string | null; type_hint: string | null }

interface QuickLogValues {
  type: 'expense' | 'income' | 'transfer'
  account_id: string
  to_account_id: string | null
  category_id: string | null
  subcategory_id: string | null
  amount: number
  currency: string
  exchange_rate: number
  destination_amount: number | null
  description: string
  notes: string | null
  date: string
  transfer_fee: number | null
  is_recurring: false
  recurrence_interval: null
  recurrence_end_date: null
  receipt_url: string | null
  tags: string[]
  goal_id: null
}

export type QuickLogResolution =
  | { ready: true; values: QuickLogValues; destinationCurrency: string | null }
  | { ready: false; kind: Kind | null; values: Partial<QuickLogValues>; destinationCurrency: string | null; reason: string }

export const QUICK_LOG_SOURCES = ['ai_phrase', 'ai_receipt'] as const
export type QuickLogSource = (typeof QUICK_LOG_SOURCES)[number]
export const isQuickLogSource = (source: string | null | undefined): source is QuickLogSource =>
  QUICK_LOG_SOURCES.some((value) => value === source)

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const currencySymbols: Record<string, string> = {
  PHP: '₱', EUR: '€', GBP: '£', KRW: '₩', INR: '₹', USD: 'US$',
  SGD: 'S$', AUD: 'A$', CAD: 'C$', HKD: 'HK$', MXN: 'MX$', BRL: 'R$',
}
const ambiguityReasons: Record<NonNullable<QuickLogCandidate['ambiguity']>, string> = {
  multiple_transactions: 'The phrase appears to describe more than one transaction.',
  transaction_type: 'The transaction type is unclear.',
  account: 'The phrase does not identify a single account.',
  amount: 'The phrase does not identify a single transaction amount.',
  currency: 'The transaction currency is unclear.',
  date: 'The transaction date is unclear.',
  transfer_details: 'The direction, amounts, or fee of the transfer are unclear.',
}

export const isQuickLogReceivingAccount = (account: Account) =>
  account.is_active && account.type !== 'credit_card' && account.type !== 'loan'

export const isQuickLogExpenseAccount = (account: Account) => account.is_active && account.type !== 'loan'

export function parseQuickLogAmount(value: string, locale: string): number | null {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  const group = normalize(parts.find((part) => part.type === 'group')?.value ?? ',') || ' '
  const [integer, fraction, extra] = value.trim().replace(/\s+/g, ' ').split(decimal)
  if (extra !== undefined || (fraction !== undefined && !/^\d{1,2}$/.test(fraction))) return null
  const groups = integer.split(group)
  if (!/^\d+$/.test(groups[0]) || (groups.length > 1 && (groups[0].length > 3 || groups.slice(1).some((part) => !/^\d{3}$/.test(part))))) return null
  const cents = Number(groups.join('') + (fraction ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 && Math.round((cents / 100) * 100) === cents ? cents / 100 : null
}

function amountPattern(text: string) {
  return '(?<![-+−–\\d])(?<!\\d[.,])' + escape(normalize(text)) + '(?!\\d|[.,]\\d)'
}

function checkAmount(amount: QuickLogAmount | null, remaining: string, locale: string) {
  if (!amount) return { value: null, remaining }
  const value = parseQuickLogAmount(amount.text, locale)
  const pattern = new RegExp(amountPattern(amount.text), 'i')
  if (value === null || !/^\d+(?:\.\d{1,2})?$/.test(amount.decimal) || value !== Number(amount.decimal) || !pattern.test(remaining)) {
    return { value: null, remaining }
  }
  return { value, remaining: remaining.replace(pattern, ' ') }
}

function currencyPattern(code: string) {
  const symbol = currencySymbols[code]
  return '(?:(?<![a-z])' + escape(code.toLowerCase()) + '(?![a-z])'
    + (symbol ? '|(?<![a-z])' + escape(symbol.toLowerCase()) : '') + ')'
}

function amountHasCurrency(phrase: string, amount: QuickLogAmount | null, code: string) {
  if (!amount) return false
  const value = amountPattern(amount.text)
  const currency = currencyPattern(code)
  return new RegExp('(?:' + value + '\\s*' + currency + '|' + currency + '\\s*' + value + ')', 'i').test(phrase)
}

function hasAmountRole(phrase: string, amount: QuickLogAmount | null, currency: string, role: 'received' | 'fee') {
  if (!amount) return false
  const number = amountPattern(amount.text)
  const code = currencyPattern(currency)
  const money = '(?:(?:' + code + '\\s*)?' + number + '(?:\\s*' + code + ')?)'
  const label = role === 'fee' ? '\\bfees?\\b' : '\\b(?:received|credited|arrived|got)\\b'
  const afterLabel = label + '(?:\\s+of)?[\\s:]+' + money
  return new RegExp(role === 'fee' ? afterLabel + '|' + money + '\\s+' + label : afterLabel, 'i').test(phrase)
}

export function mentionsLiteral(phrase: string, mention: string | null) {
  if (!mention || !normalize(mention)) return false
  return new RegExp('(?<![\\p{L}\\p{N}])' + escape(normalize(mention)) + '(?![\\p{L}\\p{N}])', 'u').test(phrase)
}

function matchNamedAccount(accounts: Account[], phrase: string, mention: string, suggestedId: string | null | undefined): AccountMatch {
  if (!mentionsLiteral(phrase, mention)) return { problem: 'could not be verified in the phrase' }
  const name = normalize(mention)
  const exact = accounts.filter((account) => normalize(account.name) === name)
  const matches = exact.length > 0 ? exact : accounts.filter((account) =>
    name.length >= 2 && (mentionsLiteral(normalize(account.name), name) || account.type.replaceAll('_', ' ') === name))
  if (matches.length > 1) return { problem: 'matches more than one active account' }
  const [account] = matches
  if (!account) return { problem: 'does not match an active account' }
  if ((suggestedId && suggestedId !== account.id) || (exact.length === 0 && suggestedId !== account.id)) {
    return { problem: 'could not be matched confidently' }
  }
  return { account }
}

function deriveDate(candidate: QuickLogCandidate, today: string) {
  if (candidate.date === null && candidate.dateText === null) return { date: today, clear: true }
  const evidence = normalize(candidate.dateText ?? '')
  const yesterday = new Date(new Date(today + 'T00:00:00Z').getTime() - 86_400_000).toISOString().slice(0, 10)
  const expected = evidence === 'today' ? today : evidence === 'yesterday' ? yesterday : evidence
  const date = isQuickLogDate(candidate.date) ? candidate.date : undefined
  return { date, clear: date !== undefined && date === expected && date <= today }
}

export function resolveQuickLog({
  phrase, candidate, today, accounts, expenseAccountId, incomeAccountId, currencies, categories, rule,
}: {
  phrase: string
  candidate: QuickLogCandidate
  today: string
  accounts: Account[]
  expenseAccountId: string | null
  incomeAccountId: string | null
  currencies: string[]
  categories: Category[]
  rule: Rule | null
}): QuickLogResolution {
  const raw = normalize(phrase)
  const activeAccounts = accounts.filter((account) => account.is_active)
  const defaultId = candidate.intent === 'income' ? incomeAccountId : candidate.intent === 'expense' ? expenseAccountId : null
  const descriptionText = candidate.description && mentionsLiteral(raw, candidate.description) ? candidate.description.trim() : null
  const accountContext = descriptionText ? raw.replace(normalize(descriptionText), ' ') : raw
  const usesDefaultAccount = candidate.intent === 'expense' || candidate.intent === 'income'
  const missedAccount = usesDefaultAccount && candidate.account === null && (
    /\b(?:via|using|paid with|charged to|debited from|deposited into)\s+\p{L}/u.test(accountContext)
    || /\bcash[.!?]?\s*$/u.test(accountContext)
    || activeAccounts.some(({ name }) => !currencies.includes(name.trim().toUpperCase()) && mentionsLiteral(accountContext, name))
  )
  const sourceMatch: AccountMatch = candidate.account !== null
    ? matchNamedAccount(activeAccounts, usesDefaultAccount ? accountContext : raw, candidate.account, candidate.accountId)
    : { account: missedAccount ? undefined : activeAccounts.find((account) => account.id === defaultId) }
  const destinationMatch: AccountMatch = candidate.destination !== null
    ? matchNamedAccount(activeAccounts, raw, candidate.destination, candidate.destinationAccountId) : {}
  const { account: source } = sourceMatch
  const { account: destination } = destinationMatch
  let kind: Kind = candidate.intent === 'unclear' ? 'expense' : candidate.intent
  if (kind === 'transfer' && destination?.type === 'credit_card') kind = 'card-payment'
  if (kind === 'transfer' && destination?.type === 'loan') kind = 'loan-repayment'
  const type = kind === 'loan-repayment' || kind === 'card-payment' ? 'expense' : kind
  const isTransfer = kind === 'transfer'
  const hasDestination = isTransfer || kind === 'card-payment' || kind === 'loan-repayment'
  const knownCurrency = candidate.currency && currencies.includes(candidate.currency) ? candidate.currency : null
  const currency = knownCurrency ?? candidate.defaultCurrency
  const receivedCurrency = candidate.receivedCurrency && currencies.includes(candidate.receivedCurrency) ? candidate.receivedCurrency : null
  const date = deriveDate(candidate, today)
  let remaining = raw
  for (const evidence of [candidate.dateText, candidate.account, candidate.destination]) {
    if (evidence && mentionsLiteral(raw, evidence)) remaining = remaining.replace(normalize(evidence), ' ')
  }
  const hasCurrency = currencies.some((code) => new RegExp(currencyPattern(code), 'i').test(remaining)) || /[$¥]/.test(remaining)
  const validCurrency = currencies.includes(currency) && (candidate.currency === null
    ? !hasCurrency || (isTransfer && receivedCurrency !== null && !amountHasCurrency(remaining, candidate.amount, receivedCurrency))
    : knownCurrency !== null && amountHasCurrency(remaining, candidate.amount, knownCurrency))
  const main = checkAmount(candidate.amount, remaining, candidate.numberLocale)
  const received = checkAmount(candidate.received, main.remaining, candidate.numberLocale)
  const fee = checkAmount(candidate.fee, received.remaining, candidate.numberLocale)

  const category = !isTransfer && kind !== 'card-payment' && categories.find((item) =>
    item.id === (rule?.category_id ?? candidate.categoryId) && (item.type === type || item.type === 'both'))
  const preferencesMatch = !rule?.type_hint || rule.type_hint === type
  const description = isTransfer && source && destination ? source.name + ' to ' + destination.name
    : descriptionText ?? phrase.trim()
  const isEligible = type === 'expense' && !hasDestination ? isQuickLogExpenseAccount : isQuickLogReceivingAccount
  const payingAccount = source && source.currency === currency && isEligible(source) ? source : undefined
  const compatibleDestination = destination?.is_active && (!receivedCurrency || receivedCurrency === destination.currency)
    && destination.id !== source?.id ? destination : undefined
  const isCrossCurrency = !!destination && destination.currency !== currency
  const validDate = date.clear && (candidate.dateText !== null ? mentionsLiteral(raw, candidate.dateText)
    : !/\b(?:yesterday|tomorrow|next (?:week|month|year)|last (?:week|month|year))\b/.test(raw))
  const validReceived = received.value !== null && hasAmountRole(raw, candidate.received, receivedCurrency ?? currency, 'received')
  const validFee = fee.value !== null && hasAmountRole(raw, candidate.fee, currency, 'fee')
    && !/\b(?:including|incl|total debit)\b/.test(raw)
    && (candidate.feeCurrency === null || (candidate.feeCurrency === currency && amountHasCurrency(raw, candidate.fee, currency)))
  const values: QuickLogValues = {
    type, account_id: payingAccount?.id ?? '', to_account_id: hasDestination ? compatibleDestination?.id ?? null : null,
    category_id: category ? category.id : null,
    subcategory_id: category && category.id === candidate.subcategoryParentId ? candidate.subcategoryId : null,
    amount: main.value ?? 0, currency, exchange_rate: 1,
    destination_amount: hasDestination && validReceived && (isCrossCurrency || !destination) ? received.value : null,
    description, notes: null, date: date.date ?? '', transfer_fee: isTransfer && validFee ? fee.value : null,
    is_recurring: false, recurrence_interval: null, recurrence_end_date: null, receipt_url: null, tags: [], goal_id: null,
  }
  const saveForReview = (reason: string): QuickLogResolution => ({
    ready: false, reason, kind: candidate.intent === 'unclear' ? null : kind,
    values: {
      ...values, date: validDate ? values.date : '', currency: validCurrency ? currency : undefined,
      account_id: source && candidate.account && isEligible(source) ? source.id : validCurrency ? values.account_id : '',
    },
    destinationCurrency: receivedCurrency,
  })
  if (candidate.ambiguity === 'multiple_transactions') return saveForReview(ambiguityReasons.multiple_transactions)
  if (kind === 'card-payment' || kind === 'loan-repayment') return saveForReview('The payment and its statement or loan details need review.')
  if (main.value === null || /\d/.test(fee.remaining) || (isTransfer && hasAmountRole(raw, candidate.amount, currency, 'fee'))) {
    return saveForReview('The transaction amount needs review.')
  }
  if (!validDate) return saveForReview('The transaction date needs review.')
  if (!validCurrency) return saveForReview('The currency needs review.')
  if (candidate.intent === 'unclear') return saveForReview(ambiguityReasons.transaction_type)
  if (sourceMatch.problem) return saveForReview('The named account ' + sourceMatch.problem + '.')
  if (missedAccount) return saveForReview('The phrase mentions an account that could not be matched confidently.')
  if (!payingAccount) {
    if (source && source.currency !== currency) return saveForReview('The account uses ' + source.currency + ', but the transaction uses ' + currency + '.')
    if (source) return saveForReview('The selected account cannot be used for this transaction type.')
    const role = isTransfer ? 'sending' : 'default ' + type
    return saveForReview('No active ' + role + ' account is selected.')
  }
  if (isTransfer) {
    if (destinationMatch.problem) return saveForReview('The receiving account ' + destinationMatch.problem + '.')
    const direction = candidate.account && candidate.destination && new RegExp(
      '(?<![\\p{L}\\p{N}])' + escape(normalize(candidate.account)) + '\\s*,?\\s*(?:\\bto\\b|→|->)\\s*'
      + escape(normalize(candidate.destination)) + '(?![\\p{L}\\p{N}])', 'u',
    ).test(raw)
    if (!direction || !compatibleDestination || !isQuickLogReceivingAccount(compatibleDestination)) {
      return saveForReview('The sending and receiving accounts need review.')
    }
    if (isCrossCurrency && (!knownCurrency || !receivedCurrency || received.value === null
      || !amountHasCurrency(raw, candidate.received, receivedCurrency))) {
      return saveForReview('The amount and currency received need review.')
    }
    if (candidate.received && (!validReceived
      || (!isCrossCurrency && received.value !== main.value))) {
      return saveForReview('The amount received and any fee need review.')
    }
    if ((candidate.fee || /\bfees?\b/.test(raw)) && !validFee) {
      return saveForReview('The transfer fee needs review.')
    }
  } else if (!/\p{L}/u.test(description) || candidate.destination !== null || candidate.fee !== null || candidate.received !== null
    || /\b(?:transfer|moved?|repay\w*|from .+ to|(?:card|loan) payment|credit card bill|paid (?:my |the )?(?:card|loan))\b/.test(raw)
    || (type === 'expense' && /\b(?:salary|payroll|received|income|wages)\b/.test(raw))) {
    return saveForReview('The transaction type needs review.')
  }
  if (!preferencesMatch) return saveForReview('A matching category rule uses a different transaction type.')
  if (candidate.ambiguous || candidate.ambiguity) {
    return saveForReview(candidate.ambiguity ? ambiguityReasons[candidate.ambiguity] : 'Some transaction details need review.')
  }
  if (!isTransfer && !category) return saveForReview('No matching ' + type + ' category was found.')
  return { ready: true, values, destinationCurrency: isTransfer ? compatibleDestination?.currency ?? null : null }
}
