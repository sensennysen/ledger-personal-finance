import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Wallet, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_COLORS,
  CURRENCIES,
  type AccountType,
} from '@/types'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn, formatCurrency } from '@/lib/utils'
import { DEFAULT_CURRENCY } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import type { Account } from '@/types'
import {
  daysUntilDayOfMonth,
  getBalanceSummary,
  getCreditCardSpending,
  getCreditUtilizationPct,
  normalizeCreditCardBalanceForStorage,
} from '@/lib/creditCards'
import {
  formatLoanSchedule,
  getLoanAmountOwed,
  LOAN_PAY_PERIOD_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/loans'

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(50),
    type: z.enum([
      'cash',
      'digital_wallet',
      'credit_card',
      'savings',
      'checking',
      'investment',
      'loan',
      'other',
    ]),
    currency: z.string().min(1),
    balance: z.coerce.number(),
    color: z.string(),
    credit_limit: z.coerce.number().nullable(),
    statement_day: z.coerce.number().int().min(1).max(31).nullable(),
    due_day: z.coerce.number().int().min(1).max(31).nullable(),
    utilization_target_pct: z.coerce.number().min(1).max(100).nullable(),
    payment_reminder_days: z.coerce.number().int().min(0).max(30).nullable(),
    loan_pay_period: z
      .enum([
        'monthly',
        'twice_monthly',
        'weekly',
        'daily',
        'quarterly',
        'bi_yearly',
        'yearly',
      ])
      .nullable(),
    loan_due_days: z.array(z.number().int().min(1).max(31)).nullable(),
    loan_due_weekday: z.number().int().min(0).max(6).nullable(),
    notes: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'loan') return
    if (
      data.loan_pay_period === 'twice_monthly' &&
      data.loan_due_days?.length !== 2
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter both monthly due days',
        path: ['loan_due_days'],
      })
    }
    if (
      data.loan_pay_period === 'twice_monthly' &&
      data.loan_due_days?.[0] === data.loan_due_days?.[1]
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose two different due days',
        path: ['loan_due_days'],
      })
    }
    if (data.loan_pay_period === 'weekly' && data.loan_due_weekday == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a due weekday',
        path: ['loan_due_weekday'],
      })
    }
    if (
      data.loan_pay_period &&
      !['daily', 'weekly', 'twice_monthly'].includes(data.loan_pay_period) &&
      !data.loan_due_days?.[0]
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a due day',
        path: ['loan_due_days'],
      })
    }
  })

export type AccountFormValues = z.output<typeof schema>

export function AccountForm({
  defaultValues,
  onSubmit,
  onClose,
  originalBalance,
}: {
  defaultValues?: Partial<AccountFormValues>
  onSubmit: (values: AccountFormValues) => Promise<void>
  onClose: () => void
  originalBalance?: number
}) {
  const form = useForm<AccountFormValues, unknown, AccountFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      type: 'cash',
      currency: DEFAULT_CURRENCY,
      balance: 0,
      color: ACCOUNT_COLORS[0],
      credit_limit: null,
      statement_day: null,
      due_day: null,
      utilization_target_pct: 30,
      payment_reminder_days: 3,
      loan_pay_period: null,
      loan_due_days: null,
      loan_due_weekday: null,
      notes: null,
      ...defaultValues,
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const loanPayPeriod = useWatch({ control: form.control, name: 'loan_pay_period' })
  const watchedBalance = useWatch({ control: form.control, name: 'balance' })
  const normalizedWatchedBalance =
    (type === 'credit_card' || type === 'loan') && Number(watchedBalance) > 0
      ? -Number(watchedBalance)
      : Number(watchedBalance)
  const balanceChanged =
    originalBalance !== undefined && normalizedWatchedBalance !== originalBalance

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {type === 'loan' ? 'Loan Name' : 'Account Name'}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    type === 'loan' ? 'e.g. Home loan' : 'e.g. My Savings'
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? ACCOUNT_TYPE_LABELS[v as AccountType]
                            : 'Select type'
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) => v ?? 'Select currency'}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {type === 'loan'
                  ? 'Loan Amount'
                  : type === 'credit_card'
                    ? 'Current Debt'
                    : 'Current Balance'}
              </FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
              {balanceChanged && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-400/60 bg-yellow-50 p-2.5 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Changing the balance will create a{' '}
                    <strong>Balance Adjustment</strong> transaction for the
                    difference (
                    {normalizedWatchedBalance > originalBalance! ? '+' : ''}
                    {formatCurrency(
                      normalizedWatchedBalance - originalBalance!,
                      defaultValues?.currency ?? 'USD',
                    )}
                    ). This keeps your transaction history accurate.
                  </span>
                </div>
              )}
              {(type === 'credit_card' || type === 'loan') && (
                <p className="text-xs text-muted-foreground">
                  {type === 'loan'
                    ? 'Use 0 when you will add financed purchases separately. Any amount entered here is treated as additional unitemized opening debt.'
                    : 'Enter the amount owed. It reduces net worth instead of increasing total assets.'}
                </p>
              )}
            </FormItem>
          )}
        />
        {type === 'credit_card' && (
          <div className="space-y-4 rounded-xl border border-outline-variant p-3.5">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-foreground">
              Credit Card Details
            </p>
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="statement_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statement Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="utilization_target_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Utilization Target %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_reminder_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remind Days Before</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
        {type === 'loan' && (
          <div className="space-y-4 rounded-xl border border-outline-variant p-3.5">
            <FormField
              control={form.control}
              name="loan_pay_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Pay Period{' '}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === 'no_schedule' ? null : value)
                      form.setValue('loan_due_days', null)
                      form.setValue('loan_due_weekday', null)
                    }}
                    value={field.value ?? 'no_schedule'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {field.value
                            ? LOAN_PAY_PERIOD_LABELS[field.value]
                            : 'No shared schedule'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="no_schedule">
                        No shared schedule
                      </SelectItem>
                      {Object.entries(LOAN_PAY_PERIOD_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {!loanPayPeriod && (
                    <p className="text-xs text-muted-foreground">
                      Each financed purchase can keep its own first due date and
                      repayment term.
                    </p>
                  )}
                </FormItem>
              )}
            />
            {loanPayPeriod === 'weekly' && (
              <FormField
                control={form.control}
                name="loan_due_weekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Due</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value == null ? '' : String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weekday">
                            {field.value == null
                              ? 'Select weekday'
                              : WEEKDAY_LABELS[field.value]}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAY_LABELS.map((day, index) => (
                          <SelectItem key={day} value={String(index)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {loanPayPeriod === 'twice_monthly' && (
              <FormField
                control={form.control}
                name="loan_due_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payments Due</FormLabel>
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1].map((index) => (
                        <Input
                          key={index}
                          type="number"
                          min={1}
                          max={31}
                          placeholder={index === 0 ? 'First day' : 'Second day'}
                          value={field.value?.[index] || ''}
                          onChange={(event) => {
                            const next = [...(field.value ?? [])]
                            next[index] = event.target.value
                              ? Number(event.target.value)
                              : 0
                            field.onChange(next)
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {loanPayPeriod &&
              !['daily', 'weekly', 'twice_monthly'].includes(loanPayPeriod) && (
                <FormField
                  control={form.control}
                  name="loan_due_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Due Day</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="Day of month"
                          value={field.value?.[0] ?? ''}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                ? [Number(event.target.value)]
                                : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
          </div>
        )}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  palette={ACCOUNT_COLORS}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any notes about this account…"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save Account'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

const LIABILITY_TYPES: AccountType[] = ['credit_card', 'loan']

function AssetRow({ account }: { account: Account }) {
  const navigate = useNavigate()
  const Icon = ACCOUNT_ICONS[account.type]
  return (
    <button
      type="button"
      onClick={() => navigate(`/accounts/${account.id}`)}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-outline-variant px-5 py-4 text-left first:border-t-0"
    >
      <span
        className="flex size-[38px] items-center justify-center rounded-xl"
        style={{ background: account.color + '22', color: account.color }}
      >
        <Icon className="size-[17px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-foreground">
          {account.name}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {ACCOUNT_TYPE_LABELS[account.type]}
        </span>
      </span>
      <span className="money text-[16px] font-bold text-foreground">
        {formatCurrency(account.balance, account.currency)}
      </span>
    </button>
  )
}

function LiabilityCard({ account }: { account: Account }) {
  const navigate = useNavigate()
  const Icon = ACCOUNT_ICONS[account.type]
  const isCard = account.type === 'credit_card'
  const owed = isCard
    ? getCreditCardSpending(account)
    : getLoanAmountOwed(account)
  const util = isCard ? getCreditUtilizationPct(account) : 0
  const dueDays = isCard
    ? daysUntilDayOfMonth(account.due_day)
    : daysUntilDayOfMonth(account.loan_due_days?.[0] ?? null)

  return (
    <button
      type="button"
      onClick={() => navigate(`/accounts/${account.id}`)}
      className="relative overflow-hidden rounded-[20px] bg-card p-5 text-left"
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: account.color }}
      />
      <div className="mb-3.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-[10px]"
            style={{ background: account.color + '22', color: account.color }}
          >
            <Icon className="size-[17px]" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-foreground">
              {account.name}
            </p>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}
            </span>
          </div>
        </div>
        {dueDays !== null && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: 'var(--expense-container)',
              color: 'var(--expense)',
            }}
          >
            Due in {dueDays}d
          </span>
        )}
      </div>
      <p
        className="money mb-1 text-[24px] font-bold"
        style={{ color: 'var(--expense)' }}
      >
        &minus;{formatCurrency(owed, account.currency)}
      </p>
      {isCard ? (
        <>
          <p className="mb-2.5 text-[11px] text-muted-foreground">
            Limit {formatCurrency(account.credit_limit ?? 0, account.currency)} ·{' '}
            {util.toFixed(1)}% used
          </p>
          <div className="h-1.5 rounded-full bg-surface-container">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, util)}%`,
                background: 'var(--expense)',
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {formatLoanSchedule(account) ?? 'Repayment schedule'}
        </p>
      )}
    </button>
  )
}

export default function AccountsPage() {
  const { profile } = useAuth()
  const { accounts, loading, createAccount } = useAccounts()
  const [createOpen, setCreateOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const defaultCurrency = profile?.default_currency ?? 'USD'
  const summary = getBalanceSummary(accounts)
  const liabilitiesTotal = summary.totalCreditCardDebt + summary.totalLoanDebt
  const assetAccounts = accounts.filter(
    (a) => !LIABILITY_TYPES.includes(a.type),
  )
  const liabilityAccounts = accounts.filter((a) =>
    LIABILITY_TYPES.includes(a.type),
  )

  const handleCreate = async (values: AccountFormValues) => {
    const { error } = await createAccount({
      ...normalizeCreditCardBalanceForStorage(values),
      is_active: true,
      icon: null,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setCreateOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 md:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-foreground">
            Accounts
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 max-md:size-10 max-md:p-0">
                <Plus className="size-4" />
                <span className="hidden md:inline">Add Account</span>
              </Button>
            }
          />
          <DialogContent className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto sm:max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
            </DialogHeader>
            {formError && (
              <p className="-mt-2 px-1 text-sm text-expense">{formError}</p>
            )}
            <AccountForm
              onSubmit={handleCreate}
              onClose={() => {
                setCreateOpen(false)
                setFormError(null)
              }}
              defaultValues={{ currency: defaultCurrency }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-[20px]" />
          <Skeleton className="h-40 rounded-[20px]" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to get started"
        />
      ) : (
        <>
          {/* Breakdown */}
          <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5 lg:flex-row lg:items-center lg:gap-6 lg:px-7">
            <div className="flex min-w-0 items-baseline justify-between gap-3 lg:flex-1 lg:flex-col lg:items-start lg:gap-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-income">
                Assets
              </span>
              <p className="money min-w-0 truncate text-[18px] font-bold text-foreground lg:mt-1.5 lg:text-[22px] xl:text-[26px]">
                {formatCurrency(summary.totalAssets, defaultCurrency)}
              </p>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3 lg:flex-1 lg:flex-col lg:items-start lg:gap-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-expense">
                Liabilities
              </span>
              <p className="money min-w-0 truncate text-[18px] font-bold text-foreground lg:mt-1.5 lg:text-[22px] xl:text-[26px]">
                {formatCurrency(liabilitiesTotal, defaultCurrency)}
              </p>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-outline-variant pt-3 lg:flex-1 lg:flex-col lg:items-start lg:gap-0 lg:border-l-2 lg:border-t-0 lg:pl-6 lg:pt-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Net Worth
              </span>
              <p className="money min-w-0 truncate text-[19px] font-bold text-foreground lg:mt-1.5 lg:text-[24px] xl:text-[28px]">
                {formatCurrency(summary.netWorth, defaultCurrency)}
              </p>
            </div>
          </div>

          <div className="space-y-7">
            {assetAccounts.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Assets
                  </span>
                  <span className="money text-[13px] font-semibold text-foreground">
                    {formatCurrency(summary.totalAssets, defaultCurrency)}
                  </span>
                </div>
                <div className="overflow-hidden rounded-[20px] bg-card">
                  {assetAccounts.map((account) => (
                    <AssetRow key={account.id} account={account} />
                  ))}
                </div>
              </section>
            )}

            {liabilityAccounts.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Liabilities
                  </span>
                  <span
                    className="money text-[13px] font-semibold"
                    style={{ color: 'var(--expense)' }}
                  >
                    &minus;{formatCurrency(liabilitiesTotal, defaultCurrency)}
                  </span>
                </div>
                <div
                  className={cn(
                    'grid gap-4',
                    liabilityAccounts.length > 1 && 'sm:grid-cols-2',
                  )}
                >
                  {liabilityAccounts.map((account) => (
                    <LiabilityCard key={account.id} account={account} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
