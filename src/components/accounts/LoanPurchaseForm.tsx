import { useEffect, useState, type ChangeEvent, type FormEvent, type Ref } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CreateLoanPurchaseValues } from '@/hooks/useLoanPurchases'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { calculateFlatMonthlyInstallment } from '@/lib/loanInstallments'
import { getLoanEffect, getPurchaseCostPreview, type LoanContext } from '@/lib/loanSummary'
import { MAX_MONTHLY_INTEREST_PCT, monthlyRateSchema } from '@/lib/loanRate'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils'
import type { Category, LoanPurchase } from '@/types'

const purchaseSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  category_id: z.string().min(1, 'Expense category is required'),
  principal_amount: z.coerce.number().positive('Purchase amount must be positive'),
  term_months: z.coerce.number().int().min(1).max(120),
  monthly_interest_rate: monthlyRateSchema,
  monthly_installment: z.coerce.number().positive('Monthly installment must be positive'),
  opening_installments_paid: z.coerce.number().int().min(0, 'Paid installments cannot be negative'),
  first_due_date: z.string().min(1, 'First due date is required'),
  notes: z.string().nullable(),
}).superRefine((values, ctx) => {
  if (values.opening_installments_paid > values.term_months) {
    ctx.addIssue({ code: 'custom', message: 'Paid installments cannot exceed the loan term', path: ['opening_installments_paid'] })
  }
})

type PurchaseFormValues = z.output<typeof purchaseSchema>
type PurchaseFormInput = z.input<typeof purchaseSchema>
type PurchaseFormStep = 1 | 2

interface LoanPurchaseFormProps {
  accountId: string
  currency: string
  categories: Category[]
  initialValues?: LoanPurchase
  /** The parent loan without this purchase, for the "adds to this loan" figures. */
  loanContext?: LoanContext
  onSubmit: (values: CreateLoanPurchaseValues) => Promise<void>
  onClose: () => void
}

function formatPct(pct: number) {
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`
}

export function LoanPurchaseForm({ accountId, currency, categories, initialValues, loanContext, onSubmit, onClose }: LoanPurchaseFormProps) {
  // Below sm the form stays a two-step wizard; wider, it is one form with its cost panel.
  const isWide = useMediaQuery('(min-width: 640px)')
  const [step, setStep] = useState<PurchaseFormStep>(1)
  const [installmentEdited, setInstallmentEdited] = useState(Boolean(initialValues))
  const form = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      category_id: initialValues?.category_id ?? '',
      principal_amount: initialValues?.principal_amount ?? '',
      term_months: initialValues?.term_months ?? 3,
      monthly_interest_rate: initialValues?.monthly_interest_rate ?? '',
      monthly_installment: initialValues?.monthly_installment ?? '',
      opening_installments_paid: initialValues?.opening_installments_paid ?? '',
      first_due_date: initialValues?.first_due_date ?? getLocalDateString(),
      notes: initialValues?.notes ?? null,
    },
  })
  const principal = useWatch({ control: form.control, name: 'principal_amount' })
  const termMonths = useWatch({ control: form.control, name: 'term_months' })
  const rate = useWatch({ control: form.control, name: 'monthly_interest_rate' })
  const installment = useWatch({ control: form.control, name: 'monthly_installment' })
  const installmentsPaid = useWatch({ control: form.control, name: 'opening_installments_paid' })
  const firstDueDate = useWatch({ control: form.control, name: 'first_due_date' })

  const rateValue = Number(rate)
  const computedInstallment = calculateFlatMonthlyInstallment(
    Number(principal),
    Number(termMonths),
    rateValue > MAX_MONTHLY_INTEREST_PCT ? 0 : rateValue,
  )

  useEffect(() => {
    if (installmentEdited) return
    form.setValue('monthly_installment', computedInstallment)
  }, [form, installmentEdited, computedInstallment])

  const recalculateInstallment = () => {
    setInstallmentEdited(false)
    form.setValue('monthly_installment', computedInstallment, { shouldDirty: true, shouldValidate: true })
  }

  const preview = getPurchaseCostPreview({
    principal: Number(principal),
    installment: Number(installment),
    termMonths: Number(termMonths),
    firstDueDate,
    installmentsPaid: Number(installmentsPaid),
  })
  const openingPaidAmount = preview?.openingPaidAmount ?? 0
  const loanEffect = preview && loanContext ? getLoanEffect(loanContext, preview, Number(installment)) : null
  const showPurchase = isWide || step === 1
  const showFinancing = isWide || step === 2

  const advanceToFinancing = async () => {
    const valid = await form.trigger(['name', 'category_id', 'principal_amount'])
    if (valid) setStep(2)
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isWide && step === 1) {
      await advanceToFinancing()
      return
    }

    await form.handleSubmit(async (values) => onSubmit({
      ...values,
      account_id: accountId,
      opening_paid_amount: openingPaidAmount,
    }))(event)
  }

  const numberInputProps = (field: { name: string; ref: Ref<HTMLInputElement>; onBlur: () => void; value: unknown; onChange: (value: string) => void }) => ({
    name: field.name,
    ref: field.ref,
    onBlur: field.onBlur,
    value: typeof field.value === 'number' || typeof field.value === 'string' ? field.value : '',
    onChange: (event: ChangeEvent<HTMLInputElement>) => field.onChange(event.target.value),
  })

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={handleFormSubmit}>
        {!isWide && (
          <div className="flex items-center gap-2" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((item) => (
              <div key={item} className="flex flex-1 items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step >= item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {item}
                </span>
                <span className={`text-xs ${step === item ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {item === 1 ? 'Purchase' : 'Financing'}
                </span>
                {item === 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 space-y-4">
            {showPurchase && (
              <section className="space-y-3" aria-labelledby="loan-purchase-section">
                <h3 id="loan-purchase-section" className="text-xs font-semibold text-muted-foreground">The purchase</h3>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase</FormLabel>
                    <FormControl><Input placeholder="e.g. Microwave oven" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField control={form.control} name="category_id" render={({ field }) => {
                    const selected = categories.find((category) => category.id === field.value)
                    return (
                      <FormItem>
                        <FormLabel>Expense Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select expense category">{selected ? `${selected.icon} ${selected.name}` : 'Select expense category'}</SelectValue></SelectTrigger></FormControl>
                          <SelectContent>
                            {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }} />
                  <FormField control={form.control} name="principal_amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Amount</FormLabel>
                      <FormControl><Input inputMode="decimal" type="number" min="0" step="0.01" {...numberInputProps(field)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </section>
            )}

            {showFinancing && (
              <>
                <section className="space-y-3" aria-labelledby="loan-financing-section">
                  <h3 id="loan-financing-section" className="text-xs font-semibold text-muted-foreground">The financing</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <FormField control={form.control} name="term_months" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (months)</FormLabel>
                        <FormControl><Input inputMode="numeric" type="number" min={1} max={120} step={1} {...numberInputProps(field)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="monthly_interest_rate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Interest %</FormLabel>
                        <FormControl><Input inputMode="decimal" type="number" min="0" step="0.01" {...numberInputProps(field)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="monthly_installment" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1">
                        <FormLabel>Monthly Installment</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            type="number"
                            min="0"
                            step="0.01"
                            {...numberInputProps(field)}
                            onChange={(event) => { setInstallmentEdited(true); field.onChange(event.target.value) }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Calculated at flat monthly interest: charged on the full {Number(principal) > 0 ? formatCurrency(Number(principal), currency) : 'purchase amount'} every month, not the shrinking balance, so the effective rate is roughly double a reducing-balance loan's. Replace it with the lender's quoted installment if you have one.
                    </p>
                    {installmentEdited && Number(installment) !== computedInstallment && (
                      <Button type="button" variant="link" size="sm" className="h-auto shrink-0 p-0 text-xs" onClick={recalculateInstallment}>Recalculate</Button>
                    )}
                  </div>
                </section>

                <section className="space-y-3" aria-labelledby="loan-start-section">
                  <h3 id="loan-start-section" className="text-xs font-semibold text-muted-foreground">Where it starts</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="first_due_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Due Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="opening_installments_paid" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installments already paid</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl className="min-w-0 flex-1"><Input inputMode="numeric" type="number" min={0} max={Number(termMonths)} step={1} {...numberInputProps(field)} /></FormControl>
                          <span className="shrink-0 text-xs text-muted-foreground">of {Number(termMonths) || '—'}</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <p className="text-xs text-muted-foreground">Opening progress only: no past expenses are created, and nothing lands in your transaction history.</p>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                      <FormControl><Textarea rows={2} value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl>
                    </FormItem>
                  )} />
                </section>
              </>
            )}
          </div>

          {showFinancing && (
            <aside className="space-y-3 self-start rounded-lg border bg-muted/30 p-3 text-sm" aria-label="What this costs" aria-live="polite">
              <h3 className="text-xs font-semibold text-muted-foreground">What this costs</h3>
              {!preview ? (
                <p className="text-xs text-muted-foreground">Enter the amount, term and installment to see the total cost and schedule.</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Total payable</p>
                    <p className="money text-lg font-bold">{formatCurrency(preview.totalPayable, currency)}</p>
                    <dl className="mt-1 space-y-0.5 text-xs">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Purchase</dt><dd className="money">{formatCurrency(Number(principal), currency)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Interest</dt><dd className="money font-semibold">{formatCurrency(preview.interest, currency)}</dd></div>
                    </dl>
                    <p className="mt-1.5 text-xs">
                      {preview.interest > 0
                        ? `You'll pay ${formatPct(preview.interestPct)} more than the sticker price over ${Number(termMonths)} month${Number(termMonths) === 1 ? '' : 's'}.`
                        : preview.interest < 0
                          ? 'The installments add up to less than the purchase amount. Check the installment.'
                          : 'No interest: you pay the sticker price.'}
                    </p>
                  </div>
                  <div className="border-t pt-2.5">
                    <p className="text-xs font-semibold">Schedule</p>
                    <dl className="mt-1 space-y-0.5 text-xs">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">First payment</dt><dd>{formatDate(preview.firstDate)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Final payment</dt><dd>{formatDate(preview.finalDate)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last installment</dt><dd className="money">{formatCurrency(preview.finalInstallment, currency)}</dd></div>
                      {Number(installmentsPaid) > 0 && (
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Opening progress</dt><dd>{Number(installmentsPaid)} of {Number(termMonths)}</dd></div>
                      )}
                    </dl>
                    {Number(installmentsPaid) > 0 && (
                      <p className="mt-0.5 text-right text-xs text-muted-foreground">{formatCurrency(openingPaidAmount, currency)} treated as already paid</p>
                    )}
                  </div>
                  {loanEffect && loanContext && (
                    <div className="border-t pt-2.5">
                      <p className="text-xs font-semibold">{initialValues ? 'Effect on this loan' : 'Adds to this loan'}</p>
                      <dl className="mt-1 space-y-0.5 text-xs">
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Outstanding now</dt><dd className="money">{formatCurrency(loanContext.baseOwed + (initialValues?.remaining_balance ?? 0), currency)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{initialValues ? 'After saving' : 'After adding'}</dt><dd className="money font-semibold">{formatCurrency(loanEffect.owedAfter, currency)}</dd></div>
                      </dl>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Monthly obligation {initialValues ? 'becomes' : 'rises to'} {formatCurrency(loanEffect.monthlyAfter, currency)} across {loanEffect.countAfter} purchase{loanEffect.countAfter === 1 ? '' : 's'}.
                      </p>
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          {isWide || step === 1 ? (
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
          )}
          {!isWide && step === 1 ? (
            <Button
              key="continue-purchase"
              type="button"
              onClick={(event) => {
                event.preventDefault()
                void advanceToFinancing()
              }}
            >
              Continue
            </Button>
          ) : (
            <Button key="save-purchase" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Saving...' : initialValues ? 'Save Changes' : 'Add Purchase'}</Button>
          )}
        </div>
      </form>
    </Form>
  )
}
