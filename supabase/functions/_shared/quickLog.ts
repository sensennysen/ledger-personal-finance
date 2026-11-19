export const QUICK_LOG_PHRASE_LIMIT = 500

export const QUICK_LOG_INTENTS = ['expense', 'income', 'transfer', 'card-payment', 'loan-repayment', 'unclear'] as const
type QuickLogIntent = (typeof QUICK_LOG_INTENTS)[number]

export interface QuickLogAmount {
  text: string
  decimal: string
}

export interface QuickLogExtraction {
  intent: QuickLogIntent
  description: string | null
  account: string | null
  destination: string | null
  amount: QuickLogAmount | null
  currency: string | null
  date: string | null
  dateText: string | null
  received: QuickLogAmount | null
  receivedCurrency: string | null
  fee: QuickLogAmount | null
  feeCurrency: string | null
  category: string | null
  subcategory: string | null
  ambiguous: boolean
}

export interface QuickLogCandidate extends Omit<QuickLogExtraction, 'category' | 'subcategory'> {
  categoryId: string | null
  subcategoryId: string | null
  subcategoryParentId: string | null
  defaultCurrency: string
  numberLocale: string
}

export type QuickLogErrorCode = 'invalid_input' | 'auth_required' | 'rate_limited' | 'unavailable' | 'timeout' | 'no_extraction'

export function isQuickLogDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const nullableString = { type: ['string', 'null'] }
const nullableAmount = {
  anyOf: [
    {
      type: 'object',
      properties: { text: { type: 'string' }, decimal: { type: 'string' } },
      required: ['text', 'decimal'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
}
const stringFields = ['description', 'account', 'destination', 'currency', 'date', 'dateText',
  'receivedCurrency', 'feeCurrency', 'category', 'subcategory'] as const
const amountFields = ['amount', 'received', 'fee'] as const
const properties = {
  intent: { type: 'string', enum: QUICK_LOG_INTENTS },
  ...Object.fromEntries(stringFields.map((key) => [key, nullableString])),
  ...Object.fromEntries(amountFields.map((key) => [key, nullableAmount])),
  ambiguous: { type: 'boolean' },
}

export const quickLogResponseFormat = {
  type: 'json_schema',
  name: 'quick_log_transaction',
  strict: true,
  schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isQuickLogExtraction(value: unknown): value is QuickLogExtraction {
  if (!isRecord(value) || Object.keys(value).length !== Object.keys(properties).length) return false
  return QUICK_LOG_INTENTS.some((intent) => value.intent === intent)
    && typeof value.ambiguous === 'boolean'
    && stringFields.every((key) => value[key] === null || typeof value[key] === 'string')
    && amountFields.every((key) => {
      const amount = value[key]
      return amount === null || (isRecord(amount) && typeof amount.text === 'string' && typeof amount.decimal === 'string')
    })
}
