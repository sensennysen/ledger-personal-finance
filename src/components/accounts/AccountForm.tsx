import { TriangleAlert } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_COLORS, CURRENCIES, type Account, type AccountType } from '@/types'
import { ColorPicker } from '@/components/ui/color-picker'
import { formatCurrency } from '@/lib/utils'
import { DEFAULT_CURRENCY } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getCreditCardSpending } from '@/lib/creditCards'
import { getLoanAmountOwed, LOAN_PAY_PERIOD_LABELS, WEEKDAY_LABELS } from '@/lib/loans'
import { accountSchema, type AccountFormValues } from '@/lib/accountSchema'

export type { AccountFormValues }

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ? ACCOUNT_TYPE_LABELS[v as AccountType] : 'Select type'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
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
              <FormLabel>{type === 'loan' ? 'Loan Amount' : type === 'credit_card' ? 'Current Debt' : 'Current Balance'}</FormLabel>
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
              {(type === 'credit_card' || type === 'loan') && (
                <p className="text-xs text-muted-foreground">
                  {type === 'loan'
                    ? 'Use 0 when you will add financed purchases separately. Any amount entered here is treated as additional unitemized opening debt.'
                    : 'Enter the amount owed. It will reduce net worth instead of increasing total assets.'}
                </p>
              )}
            </FormItem>
          )}
        />
        {type === 'credit_card' && (
          <div className="space-y-4 rounded-lg border border-border/60 p-3">
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
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
                    <FormLabel>Due Day</FormLabel>
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
                  <FormLabel>Pay Period <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
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
                  {!loanPayPeriod && (
                    <p className="text-xs text-muted-foreground">Each financed purchase can keep its own first due date and repayment term.</p>
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
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value == null ? '' : String(field.value)}>
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
                      <Input type="number" min={1} max={31} placeholder="Day of month" value={field.value?.[0] ?? ''} onChange={(event) => field.onChange(event.target.value ? [Number(event.target.value)] : null)} />
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
