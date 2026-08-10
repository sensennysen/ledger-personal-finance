import { useEffect, useState, type FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CreateLoanPurchaseValues } from '@/hooks/useLoanPurchases'
import { calculateFlatMonthlyInstallment, roundMoney } from '@/lib/loanInstallments'
import { formatCurrency, getLocalDateString } from '@/lib/utils'
import type { Category, LoanPurchase } from '@/types'

const purchaseSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  category_id: z.string().min(1, 'Expense category is required'),
  principal_amount: z.coerce.number().positive('Purchase amount must be positive'),
  term_months: z.coerce.number().int().min(1).max(120),
  monthly_interest_rate: z.coerce.number().min(0, 'Interest cannot be negative'),
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
  onSubmit: (values: CreateLoanPurchaseValues) => Promise<void>
  onClose: () => void
}

export function LoanPurchaseForm({ accountId, currency, categories, initialValues, onSubmit, onClose }: LoanPurchaseFormProps) {
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

  useEffect(() => {
    if (installmentEdited) return
    form.setValue('monthly_installment', calculateFlatMonthlyInstallment(Number(principal), Number(termMonths), Number(rate)))
  }, [form, installmentEdited, principal, rate, termMonths])

  const totalPayable = roundMoney(Number(installment || 0) * Number(termMonths || 0))
  const openingPaidAmount = roundMoney(Math.min(totalPayable, Number(installment || 0) * Number(installmentsPaid || 0)))

  const advanceToRepayment = async () => {
    const valid = await form.trigger(['name', 'category_id', 'principal_amount', 'term_months'])
    if (valid) setStep(2)
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 1) {
      await advanceToRepayment()
      return
    }

    await form.handleSubmit(async (values) => onSubmit({
      ...values,
      account_id: accountId,
      opening_paid_amount: openingPaidAmount,
    }))(event)
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={handleFormSubmit}>
        <div className="flex items-center gap-2" aria-label={`Step ${step} of 2`}>
          {[1, 2].map((item) => (
            <div key={item} className="flex flex-1 items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step >= item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {item}
              </span>
              <span className={`text-xs ${step === item ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {item === 1 ? 'Purchase' : 'Repayment'}
              </span>
              {item === 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase</FormLabel>
                <FormControl><Input autoFocus placeholder="e.g. Microwave oven" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="principal_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Amount</FormLabel>
                  <FormControl><Input inputMode="decimal" type="number" min="0" step="0.01" name={field.name} ref={field.ref} onBlur={field.onBlur} value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''} onChange={(event) => field.onChange(event.target.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="term_months" render={({ field }) => (
                <FormItem>
                  <FormLabel>Term (months)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={1}
                      max={120}
                      step={1}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="monthly_interest_rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Interest %</FormLabel>
                  <FormControl><Input inputMode="decimal" type="number" min="0" step="0.01" name={field.name} ref={field.ref} onBlur={field.onBlur} value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''} onChange={(event) => field.onChange(event.target.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="monthly_installment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Installment</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                      onChange={(event) => { setInstallmentEdited(true); field.onChange(event.target.value) }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <p className="text-xs text-muted-foreground">Estimated using flat monthly interest. You can replace it with the lender's quoted installment.</p>
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
                  <FormLabel>Already Paid</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={0}
                      max={Number(termMonths)}
                      step={1}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <p className="text-xs text-muted-foreground">Already-paid installments set opening progress without creating past expenses.</p>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Textarea rows={2} value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || null)} /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 divide-x rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <div className="pr-3">
                <p className="text-xs text-muted-foreground">Total payable</p>
                <p className="money mt-0.5 font-semibold">{formatCurrency(totalPayable, currency)}</p>
              </div>
              <div className="pl-3">
                <p className="text-xs text-muted-foreground">Imported paid</p>
                <p className="money mt-0.5 font-semibold">{formatCurrency(openingPaidAmount, currency)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          {step === 1 ? (
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
          )}
          {step === 1 ? (
            <Button
              key="continue-purchase"
              type="button"
              onClick={(event) => {
                event.preventDefault()
                void advanceToRepayment()
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
