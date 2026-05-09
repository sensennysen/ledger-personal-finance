import { z } from 'zod'
import { RECURRING_INTERVALS } from '@/lib/recurringTransactions'

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  to_account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  subcategory_id: z.string().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  exchange_rate: z.coerce.number().default(1),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().nullable(),
  date: z.string().min(1),
  transfer_fee: z.coerce.number().min(0).nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.enum(RECURRING_INTERVALS).nullable(),
  recurrence_end_date: z.string().nullable(),
  receipt_url: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  goal_id: z.string().nullable().default(null),
}).superRefine((data, ctx) => {
  if (data.type === 'transfer' && !data.to_account_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Destination account is required for transfers',
      path: ['to_account_id'],
    })
  }
})

export type TransactionFormInput = z.input<typeof transactionSchema>
export type TransactionFormValues = z.output<typeof transactionSchema>
