export const QUICK_LOG_PHRASE_LIMIT = 500

export const QUICK_LOG_INTENTS = ['expense', 'income', 'transfer', 'card-payment', 'loan-repayment', 'unclear'] as const
type QuickLogIntent = (typeof QUICK_LOG_INTENTS)[number]
export const QUICK_LOG_AMBIGUITIES = ['multiple_transactions', 'transaction_type', 'account', 'amount', 'currency', 'date', 'transfer_details'] as const
type QuickLogAmbiguity = (typeof QUICK_LOG_AMBIGUITIES)[number]

export interface QuickLogAmount {
  text: string
  decimal: string
}

export interface QuickLogExtraction {
  intent: QuickLogIntent
  description: string | null
  account: string | null
  accountRef: string | null
  destination: string | null
  destinationRef: string | null
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
  ambiguity: QuickLogAmbiguity | null
}

export interface QuickLogCandidate extends Omit<QuickLogExtraction, 'category' | 'subcategory' | 'accountRef' | 'destinationRef' | 'ambiguity'> {
  accountId?: string | null
  destinationAccountId?: string | null
  ambiguity?: QuickLogAmbiguity | null
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
const stringFields = ['description', 'account', 'accountRef', 'destination', 'destinationRef', 'currency', 'date', 'dateText',
  'receivedCurrency', 'feeCurrency', 'category', 'subcategory'] as const
const amountFields = ['amount', 'received', 'fee'] as const
const properties = {
  intent: { type: 'string', enum: QUICK_LOG_INTENTS },
  ...Object.fromEntries(stringFields.map((key) => [key, nullableString])),
  ...Object.fromEntries(amountFields.map((key) => [key, nullableAmount])),
  ambiguous: { type: 'boolean' },
  ambiguity: { type: ['string', 'null'], enum: [...QUICK_LOG_AMBIGUITIES, null] },
}

export const quickLogResponseFormat = {
  type: 'json_schema',
  name: 'quick_log_transaction',
  strict: true,
  schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
}

export function quickLogFormatForReferences(accountRefs: string[], categoryRefs: string[], subcategoryRefs: string[]) {
  // Structured Outputs limits the total number of enum values. Large account
  // sets still go through the same reference lookups after extraction.
  if (2 * accountRefs.length + categoryRefs.length + subcategoryRefs.length > 900) return quickLogResponseFormat
  const referenceField = (refs: string[]) => refs.length ? { ...nullableString, enum: [...refs, null] } : { type: 'null' }
  const account = referenceField(accountRefs)
  return {
    ...quickLogResponseFormat,
    schema: {
      ...quickLogResponseFormat.schema,
      properties: {
        ...properties,
        accountRef: account,
        destinationRef: account,
        category: referenceField(categoryRefs),
        subcategory: referenceField(subcategoryRefs),
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isQuickLogExtraction(value: unknown): value is QuickLogExtraction {
  if (!isRecord(value) || Object.keys(value).length !== Object.keys(properties).length) return false
  return QUICK_LOG_INTENTS.some((intent) => value.intent === intent)
    && typeof value.ambiguous === 'boolean'
    && (value.ambiguity === null || QUICK_LOG_AMBIGUITIES.some((reason) => reason === value.ambiguity))
    && stringFields.every((key) => value[key] === null || typeof value[key] === 'string')
    && amountFields.every((key) => {
      const amount = value[key]
      return amount === null || (isRecord(amount) && typeof amount.text === 'string' && typeof amount.decimal === 'string')
    })
}
