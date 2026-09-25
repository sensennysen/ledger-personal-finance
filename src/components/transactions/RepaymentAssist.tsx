import { useEffect, useMemo, useRef } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { StatsBand } from '@/components/transactions/StatsBand'
import type { TransactionFormInput, TransactionFormValues } from '@/components/transactions/transactionFormSchema'
import { Button } from '@/components/ui/button'
import { InlineLoadError } from '@/components/ui/error-state'
import { useAuth } from '@/contexts/AuthContext'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { monthCycleRange } from '@/lib/cycleRange'
import { resolveLoadState } from '@/lib/loadState'
import { getLoanDeadlines } from '@/lib/loanInstallments'
import { nextDeadlineInCycle } from '@/lib/loanPicker'
import { getRepaymentPresets, previewLoanAllocation, summariseRepayment } from '@/lib/loanRepayment'
import { getLoanAmountOwed } from '@/lib/loans'
import { formatCurrency, formatDate, formatDateShort, getCurrentCycleMonthKey, getLocalDateString } from '@/lib/utils'
import type { Account } from '@/types'

interface RepaymentAssistProps {
  loan: Account
  form: UseFormReturn<TransactionFormInput, unknown, TransactionFormValues>
}

function dueInLabel(days: number): string {
  if (days === 0) return 'due today'
  if (days === 1) return 'in 1 day'
  if (days > 1) return `in ${days} days`
  return days === -1 ? '1 day overdue' : `${-days} days overdue`
}

/**
 * The figures a loan repayment depends on, shown before they are discovered as errors (5b):
 * outstanding, installment due and the balance after this payment, plus amount presets.
 * Render it with `key={loan.id}`: it reads that loan's purchases once and must not show another loan's.
 */
export function RepaymentAssist({ loan, form }: RepaymentAssistProps) {
  const { profile } = useAuth()
  const { purchases, allocations, loading, error, refetch } = useLoanPurchases(loan.id)
  const amountValue = useWatch({ control: form.control, name: 'amount' })
  const date = useWatch({ control: form.control, name: 'date' })
  const defaulted = useRef(false)

  const startDay = profile?.month_start_day ?? 1
  const cycleEnd = monthCycleRange(getCurrentCycleMonthKey(startDay), startDay).end
  const deadline = useMemo(
    () => nextDeadlineInCycle(getLoanDeadlines(purchases, allocations), cycleEnd),
    [allocations, cycleEnd, purchases],
  )
  const outstanding = getLoanAmountOwed(loan)
  const presets = useMemo(() => getRepaymentPresets(outstanding, deadline), [deadline, outstanding])
  const amount = Number(amountValue)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : null
  const summary = summariseRepayment({
    outstanding,
    deadline,
    amount,
    date: validDate ?? getLocalDateString(),
    purchases,
    allocations,
    today: new Date(),
  })
  // The split depends on what is due on the payment's date, so the preview follows the Date field.
  const preview = useMemo(
    () =>
      validDate && amount > 0 && !summary.overpays && purchases.length > 0
        ? previewLoanAllocation(purchases, allocations, amount, validDate)
        : null,
    [allocations, amount, purchases, summary.overpays, validDate],
  )
  const loadState = resolveLoadState({ loading, error, hasData: purchases.length > 0 })
  const deadlineKnown = loadState !== 'error' && loadState !== 'loading'

  // Installment is the default once the deadline is known, unless the caller already supplied an amount.
  useEffect(() => {
    if (defaulted.current || loading || error) return
    defaulted.current = true
    if (presets.defaultPreset === 'installment' && presets.installment != null && !Number(form.getValues('amount'))) {
      form.setValue('amount', presets.installment, { shouldValidate: true })
    }
  }, [error, form, loading, presets])

  const active =
    presets.installment != null && amount === presets.installment
      ? 'installment'
      : amount === presets.full && amount > 0
        ? 'full'
        : 'custom'
  const setAmount = (value: number) => form.setValue('amount', value, { shouldValidate: true })
  const money = (value: number) => formatCurrency(value, loan.currency)

  return (
    <div className="space-y-2">
      {loadState === 'error' && error && (
        <InlineLoadError message={error} onRetry={() => void refetch()} />
      )}
      <StatsBand
        items={[
          { label: 'Outstanding', value: money(summary.outstanding) },
          {
            label: 'Installment due',
            value: summary.installmentDue ? money(summary.installmentDue.amount) : '—',
            note: summary.installmentDue
              ? `${formatDateShort(summary.installmentDue.date)} · ${dueInLabel(summary.installmentDue.inDays)}`
              : loading
                ? 'Loading…'
                : deadlineKnown
                  ? 'None due this cycle'
                  : 'Unavailable',
          },
          {
            label: 'After this payment',
            value: summary.after == null ? '—' : money(summary.after),
            note: summary.overpays ? (
              <span className="text-destructive">Payment cannot exceed the outstanding loan amount</span>
            ) : summary.installments ? (
              `${summary.installments.paid} of ${summary.installments.total} → ${summary.installments.paidAfter} of ${summary.installments.total} paid`
            ) : undefined,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Amount presets">
        {presets.installment != null && presets.installment > 0 && (
          <Button
            type="button"
            size="sm"
            variant={active === 'installment' ? 'default' : 'outline'}
            aria-pressed={active === 'installment'}
            onClick={() => setAmount(presets.installment ?? 0)}
          >
            Installment
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={active === 'full' ? 'default' : 'outline'}
          aria-pressed={active === 'full'}
          disabled={presets.full <= 0}
          onClick={() => setAmount(presets.full)}
        >
          Pay in full
        </Button>
        <Button
          type="button"
          size="sm"
          variant={active === 'custom' ? 'default' : 'outline'}
          aria-pressed={active === 'custom'}
          onClick={() => form.setFocus('amount')}
        >
          Custom
        </Button>
      </div>
      {preview && validDate && preview.rows.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border/70 p-3 text-sm" aria-label="How this payment is applied">
          <p className="text-xs text-muted-foreground">
            How this payment is applied, as paid on {formatDate(validDate)}
          </p>
          <ul className="space-y-1.5">
            {preview.rows.map((row) => (
              <li key={row.purchaseId} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.purchaseName}</span>
                  <span className="block text-xs text-muted-foreground">
                    Installment {row.installmentNumber} of {row.termMonths}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{money(row.applied)}</span>
                  <span className="block text-xs text-muted-foreground">{money(row.remainingAfter)} left</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
