import { TriangleAlert } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_COLORS, CURRENCIES, type Account, type AccountType } from '@/types'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn, formatCurrency } from '@/lib/utils'
import { ACCOUNT_ICONS, DEFAULT_CURRENCY } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getCreditCardSpending } from '@/lib/creditCards'
import { formatLoanSchedule, getLoanAmountOwed, LOAN_PAY_PERIOD_LABELS, WEEKDAY_LABELS } from '@/lib/loans'
import { accountSchema, loanScheduleControl, type AccountFormValues, type LoanScheduleControl } from '@/lib/accountSchema'
import { availableCredit, daysToPay, ordinal } from '@/lib/accountFormHints'

export type { AccountFormValues }

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

const SCHEDULE_CONTROL_HINTS: Record<LoanScheduleControl, string> = {
  'two-days': 'Twice-a-month loans need two different days of the month.',
  weekday: 'Weekly loans need the weekday payments fall on.',
  none: 'Daily loans need no due day.',
  'one-day': 'Pick the day of the month payments are due.',
}

function OptionalMark() {
  return <span className="font-normal text-muted-foreground">(optional)</span>
}

function accountToFormValues(account: Account): Partial<AccountFormValues> {
  return {
    ...account,
    balance: account.type === 'credit_card'
      ? getCreditCardSpending(account)
      : account.type === 'loan'
        ? getLoanAmountOwed(account)
        : account.balance,
    currency: account.currency || DEFAULT_CURRENCY,
    utilization_target_pct: account.utilization_target_pct ?? 30,
    payment_reminder_days: account.payment_reminder_days ?? 3,
  }
}

/** One form for creating and editing accounts. Pass `account` to edit. */
export function AccountForm({
  account,
  defaultValues,
  onSubmit,
  onClose,
}: {
  account?: Account
  defaultValues?: Partial<AccountFormValues>
  onSubmit: (values: AccountFormValues) => Promise<void>
  onClose: () => void
}) {
  const originalBalance = account?.balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<AccountFormValues, any, AccountFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as any,
    // Errors show once a field is left, then update as you type (LED-85), not only on submit.
    mode: 'onTouched',
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
      ...(account ? accountToFormValues(account) : {}),
      ...defaultValues,
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const loanPayPeriod = useWatch({ control: form.control, name: 'loan_pay_period' })
  const watchedBalance = useWatch({ control: form.control, name: 'balance' })
  const normalizedWatchedBalance = (type === 'credit_card' || type === 'loan') && Number(watchedBalance) > 0
    ? -Number(watchedBalance)
    : Number(watchedBalance)
  const balanceChanged = originalBalance !== undefined && normalizedWatchedBalance !== originalBalance
  const isLiability = type === 'credit_card' || type === 'loan'
  const creditLimit = useWatch({ control: form.control, name: 'credit_limit' })
  const statementDay = useWatch({ control: form.control, name: 'statement_day' })
  const dueDay = useWatch({ control: form.control, name: 'due_day' })
  const loanDueDays = useWatch({ control: form.control, name: 'loan_due_days' })
  const loanDueWeekday = useWatch({ control: form.control, name: 'loan_due_weekday' })
  const scheduleControl = loanScheduleControl(loanPayPeriod)
  const paymentWindow = daysToPay(statementDay, dueDay)
  const available = availableCredit(creditLimit, Number(watchedBalance) || 0)
  const scheduleReady = scheduleControl === 'none'
    || (scheduleControl === 'weekday' && loanDueWeekday != null)
    || (scheduleControl === 'one-day' && Boolean(loanDueDays?.[0]))
    || (scheduleControl === 'two-days' && loanDueDays?.length === 2 && Boolean(loanDueDays[0]) && Boolean(loanDueDays[1]) && loanDueDays[0] !== loanDueDays[1])
  const schedulePreview = scheduleReady
    ? formatLoanSchedule({ type: 'loan', loan_pay_period: loanPayPeriod, loan_due_days: loanDueDays, loan_due_weekday: loanDueWeekday })
    : null

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <p className="text-xs text-muted-foreground">The type decides which fields you'll be asked for.</p>
              <div role="radiogroup" aria-label="Account type" className="grid grid-cols-4 gap-2">
                {ACCOUNT_TYPES.map((value, index) => {
                  const TypeIcon = ACCOUNT_ICONS[value]
                  const selected = field.value === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => field.onChange(value)}
                      onKeyDown={(event) => {
                        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
                        if (!step) return
                        event.preventDefault()
                        const nextIndex = (index + step + ACCOUNT_TYPES.length) % ACCOUNT_TYPES.length
                        field.onChange(ACCOUNT_TYPES[nextIndex])
                        const siblings = event.currentTarget.parentElement?.children
                        ;(siblings?.[nextIndex] as HTMLElement | undefined)?.focus()
                      }}
                      className={cn(
                        'flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[0.6875rem] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                        selected ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <TypeIcon className="size-4 shrink-0" aria-hidden />
                      <span className="text-center">{ACCOUNT_TYPE_LABELS[value]}</span>
                    </button>
                  )
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{type === 'loan' ? 'Loan Name' : 'Account Name'}</FormLabel>
                <FormControl><Input placeholder={type === 'loan' ? 'e.g. Home loan' : 'e.g. My Savings'} {...field} /></FormControl>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ?? 'Select currency'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
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
              <FormLabel>{isLiability ? 'Amount currently owed' : 'Current Balance'}</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
              <FormMessage />
              {balanceChanged && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30 p-2.5 text-sm text-yellow-800 dark:text-yellow-300">
                  <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Changing the balance will create a <strong>Balance Adjustment</strong> transaction for the difference ({normalizedWatchedBalance > originalBalance! ? '+' : ''}{formatCurrency(normalizedWatchedBalance - originalBalance!, account?.currency ?? 'USD')}). This keeps your transaction history accurate.
                  </span>
                </div>
              )}
              {isLiability && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Enter what you owe as a positive number — Ledger stores it as a liability and subtracts it from net worth.
                    {Number(watchedBalance) < 0 && ` ${formatCurrency(Number(watchedBalance), account?.currency ?? DEFAULT_CURRENCY)} is saved the same way, as ${formatCurrency(Math.abs(Number(watchedBalance)), account?.currency ?? DEFAULT_CURRENCY)} owed.`}
                  </p>
                  {type === 'loan' && (
                    <p>Use 0 when you will add financed purchases separately. Any amount entered here is treated as additional unitemized opening debt.</p>
                  )}
                </div>
              )}
            </FormItem>
          )}
        />
        {type === 'credit_card' && (
          <div className="space-y-4 rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">Credit card details</p>
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit <OptionalMark /></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Needed for the utilisation bar on Home and Accounts.</p>
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
                    <FormLabel>Statement closes on day <OptionalMark /></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
                    <FormLabel>Payment due on day <OptionalMark /></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {statementDay && dueDay && paymentWindow !== null
                ? <>Statement closes the <strong className="text-foreground">{ordinal(statementDay)}</strong>, payment due the <strong className="text-foreground">{ordinal(dueDay)}</strong> — about {paymentWindow} days to pay. Both appear as countdowns on Home.</>
                : 'Statement and due days can be left blank — countdowns just won\'t show.'}
            </p>
            {available !== null && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Available credit <span className="text-xs">· limit minus what you owe</span></span>
                <span className="money font-semibold" style={{ color: available < 0 ? 'var(--expense)' : undefined }}>
                  {formatCurrency(available, form.getValues('currency'))}
                </span>
              </div>
            )}
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
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
                    <FormLabel>Remind Days Before Due</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
          <div className="space-y-4 rounded-lg border border-border/60 p-3">
            <FormField
              control={form.control}
              name="loan_pay_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repayment period <OptionalMark /></FormLabel>
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
                          {field.value ? LOAN_PAY_PERIOD_LABELS[field.value] : 'No shared schedule'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="no_schedule">No shared schedule</SelectItem>
                      {Object.entries(LOAN_PAY_PERIOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {scheduleControl ? SCHEDULE_CONTROL_HINTS[scheduleControl] : 'Each financed purchase can keep its own first due date and repayment term.'}
                  </p>
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
                      onValueChange={(value) => {
                        field.onChange(Number(value))
                        void form.trigger('loan_due_weekday')
                      }}
                      value={field.value == null ? '' : String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weekday">
                            {field.value == null ? 'Select weekday' : WEEKDAY_LABELS[field.value]}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAY_LABELS.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}
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
                          aria-label={index === 0 ? 'First due day' : 'Second due day'}
                          onBlur={field.onBlur}
                          value={field.value?.[index] || ''}
                          onChange={(event) => {
                            const next = [...(field.value ?? [])]
                            next[index] = event.target.value ? Number(event.target.value) : 0
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
            {loanPayPeriod && !['daily', 'weekly', 'twice_monthly'].includes(loanPayPeriod) && (
              <FormField
                control={form.control}
                name="loan_due_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Due Day</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} placeholder="Day of month" onBlur={field.onBlur} value={field.value?.[0] ?? ''} onChange={(event) => field.onChange(event.target.value ? [Number(event.target.value)] : null)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {schedulePreview && (
              <p className="text-xs text-muted-foreground">
                Reads <strong className="text-foreground">{schedulePreview}</strong> on the Accounts page and drives the repayment reminders.
              </p>
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
              <FormLabel>Notes <OptionalMark /></FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any notes about this account..."
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Account'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
