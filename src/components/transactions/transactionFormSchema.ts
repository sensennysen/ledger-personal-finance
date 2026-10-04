import { z } from 'zod'
import { RECURRING_INTERVALS } from '@/lib/recurringTransactions'
import { isCrossCurrencyTransfer } from '@/lib/transferCredit'

const transactionFields = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  to_account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  subcategory_id: z.string().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  exchange_rate: z.coerce.number().default(1),
  // What the destination receives, for a transfer between two currencies (LED-185). An empty field is null.
  destination_amount: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.number().nullable(),
  ).default(null),
  description: z.string(),
  notes: z.string().nullable(),
  date: z.string().min(1),
  transfer_fee: z.coerce.number().min(0).nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.enum(RECURRING_INTERVALS).nullable(),
  recurrence_end_date: z.string().nullable(),
  receipt_url: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  goal_id: z.string().nullable().default(null),
})

/**
 * A loan repayment is an expense with a destination and needs a category; a card payment has
 * none by design (LED-146), so its form validates without that rule. `accountCurrency` names the
 * currency of an account, so a transfer into an account in another currency must say what arrives.
 */
export function buildTransactionSchema({
  destinationNeedsCategory = true,
  accountCurrency,
}: {
  destinationNeedsCategory?: boolean
  accountCurrency?: (accountId: string) => string | undefined
} = {}) {
  return transactionFields.superRefine((data, ctx) => {
    if (data.type !== 'transfer' && data.description.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Description is required',
        path: ['description'],
      })
    }

    if (data.type === 'transfer' && !data.to_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Destination account is required for transfers',
        path: ['to_account_id'],
      })
    }

    if (data.type !== 'expense' && data.type !== 'transfer' && data.to_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only expenses and transfers can have a destination account',
        path: ['to_account_id'],
      })
    }

    const toCurrency = data.to_account_id ? accountCurrency?.(data.to_account_id) : undefined
    if (isCrossCurrencyTransfer(data, toCurrency) && !(data.destination_amount != null && data.destination_amount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Enter the amount ${toCurrency} the account received`,
        path: ['destination_amount'],
      })
    }

    if (destinationNeedsCategory && data.type === 'expense' && data.to_account_id && !data.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose an expense category for this loan repayment',
        path: ['category_id'],
      })
    }
  })
}

export const transactionSchema = buildTransactionSchema()
export const cardPaymentSchema = buildTransactionSchema({ destinationNeedsCategory: false })

export type TransactionFormInput = z.input<typeof transactionSchema>
export type TransactionFormValues = z.output<typeof transactionSchema>
