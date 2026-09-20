import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['cash', 'digital_wallet', 'credit_card', 'savings', 'checking', 'investment', 'loan', 'other']),
  currency: z.string().min(1),
  balance: z.coerce.number(),
  color: z.string(),
  credit_limit: z.coerce.number().nullable(),
  statement_day: z.coerce.number().int().min(1).max(31).nullable(),
  due_day: z.coerce.number().int().min(1).max(31).nullable(),
  utilization_target_pct: z.coerce.number().min(1).max(100).nullable(),
  payment_reminder_days: z.coerce.number().int().min(0).max(30).nullable(),
  loan_pay_period: z.enum(['monthly', 'twice_monthly', 'weekly', 'daily', 'quarterly', 'bi_yearly', 'yearly']).nullable(),
  loan_due_days: z.array(z.number().int().min(1).max(31)).nullable(),
  loan_due_weekday: z.number().int().min(0).max(6).nullable(),
  notes: z.string().nullable(),
}).superRefine((data, ctx) => {
  if (data.type !== 'loan') return
  if (data.loan_pay_period === 'twice_monthly' && data.loan_due_days?.length !== 2) {
    ctx.addIssue({ code: 'custom', message: 'Enter both monthly due days', path: ['loan_due_days'] })
  }
  if (data.loan_pay_period === 'twice_monthly' && data.loan_due_days?.[0] === data.loan_due_days?.[1]) {
    ctx.addIssue({ code: 'custom', message: 'Choose two different due days', path: ['loan_due_days'] })
  }
  if (data.loan_pay_period === 'weekly' && data.loan_due_weekday == null) {
    ctx.addIssue({ code: 'custom', message: 'Select a due weekday', path: ['loan_due_weekday'] })
  }
  if (data.loan_pay_period && !['daily', 'weekly', 'twice_monthly'].includes(data.loan_pay_period) && !data.loan_due_days?.[0]) {
    ctx.addIssue({ code: 'custom', message: 'Enter a due day', path: ['loan_due_days'] })
  }
})

export type AccountFormValues = z.output<typeof accountSchema>
