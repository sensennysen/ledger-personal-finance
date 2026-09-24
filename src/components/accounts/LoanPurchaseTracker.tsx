import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ChevronDown, CloudOff, Layers3, MoreVertical, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { LoanPurchaseForm } from '@/components/accounts/LoanPurchaseForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState, InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import { withDetail, type FormErrorValue, type MutationResult } from '@/lib/dataErrors'
import { resolveLoadState } from '@/lib/loadState'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories } from '@/hooks/useCategories'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getLoanAmountOwed } from '@/lib/loans'
import { getItemizationGap, labelAllocationInstallments, splitPurchaseProgress, type LoanContext } from '@/lib/loanSummary'
import { daysUntilDate } from '@/lib/accountsOverview'
import type { LoanDeadline } from '@/lib/loanInstallments'
import type { Account, LoanPurchase } from '@/types'

/**
 * Local, listener-only connectivity flag for UI gating. Deliberately not
 * useNetworkStatus(): that hook also drives the offline-queue drain on
 * reconnect and isn't a singleton, so a second instance here would race
 * AppLayout's and could double-submit queued writes.
 */
function useIsOnline() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return isOnline
}

interface LoanPurchaseTrackerProps {
  account: Account
  onAccountChanged: () => void
  loanData?: ReturnType<typeof useLoanPurchases>
  /** Sets what the loan owes; the page routes it through the balance-adjustment path. */
  onSetLoanAmount?: (owed: number) => Promise<MutationResult>
  /** Opens the loan-repayment form prefilled for this deadline. */
  onRecordPayment?: (deadline: LoanDeadline) => void
}

function formatDueIn(days: number) {
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'due today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

export function LoanPurchaseTracker({ account, onAccountChanged, loanData, onSetLoanAmount, onRecordPayment }: LoanPurchaseTrackerProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editPurchase, setEditPurchase] = useState<LoanPurchase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoanPurchase | null>(null)
  const [formError, setFormError] = useState<FormErrorValue>(null)
  const [expandedDeadline, setExpandedDeadline] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)
  const { categories } = useCategories()
  const isOnline = useIsOnline()
  const internalLoanData = useLoanPurchases(account.id, !loanData)
  const { purchases, allocations, deadlines, loading, error, errorDetail, refetch, createPurchase, updatePurchase, deletePurchase } = loanData ?? internalLoanData
  const loadState = resolveLoadState({ loading, error, hasData: purchases.length > 0 })
  const owed = getLoanAmountOwed(account)
  const { itemized, gap } = getItemizationGap(owed, purchases)
  // Only a settled read can be reconciled: a stale or in-flight list would report a gap that isn't there.
  const showReconciliation = !loading && (loadState === 'ready' || loadState === 'empty') && gap !== 0
  const expenseCategories = categories.filter((category) => category.type === 'expense' || category.type === 'both')
  const purchaseById = useMemo(() => new Map(purchases.map((purchase) => [purchase.id, purchase])), [purchases])
  const recentAllocations = useMemo(
    () => [...allocations]
      .sort((left, right) => (right.transaction?.date ?? '').localeCompare(left.transaction?.date ?? '') || right.created_at.localeCompare(left.created_at))
      .slice(0, 8),
    [allocations],
  )
  const installmentLabels = labelAllocationInstallments(purchases, allocations)
  const [nextDeadline, ...laterDeadlines] = deadlines
  const hasImportedProgress = purchases.some((purchase) => purchase.opening_paid_amount > 0)
  // The loan as it stands without `excluded`, so the form can show what saving it does.
  const loanContextWithout = (excluded: LoanPurchase | null): LoanContext => {
    const others = purchases.filter((purchase) => purchase.id !== excluded?.id && (purchase.remaining_balance ?? purchase.total_payable) > 0)
    return {
      baseOwed: owed - (excluded?.remaining_balance ?? 0),
      baseMonthly: others.reduce((sum, purchase) => sum + purchase.monthly_installment, 0),
      baseCount: others.length,
      allocatedToThis: excluded ? (excluded.paid_amount ?? 0) - excluded.opening_paid_amount : 0,
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="financed-purchases-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="financed-purchases-title" className="text-base font-semibold">Financed Purchases</h2>
          <p className="text-xs text-muted-foreground">Each purchase keeps its own term while shared deadlines are totaled.</p>
        </div>
        <Button size="sm" className="gap-1.5" disabled={!isOnline} onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Add Purchase
        </Button>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-3 rounded-lg bg-muted px-3.5 py-3 text-xs text-muted-foreground">
          <CloudOff className="h-4 w-4 shrink-0" />
          Financed purchases need a connection — they can't be queued.
        </div>
      )}

      <FormError error={formError} />
      {loadState === 'stale-error' && (
        <InlineLoadError message="Couldn't refresh your financed purchases. Showing what was last loaded." onRetry={() => void refetch()} />
      )}

      {showReconciliation && (
        <div role="status" className="flex items-start gap-2.5 rounded-lg border border-yellow-400/60 bg-yellow-50 px-3.5 py-3 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-2">
            {gap > 0 ? (
              <>
                <p className="font-semibold">{purchases.length === 0 ? "None of this loan is itemized" : "Some of this loan isn't itemized"}</p>
                <p>
                  The account carries {formatCurrency(owed, account.currency)} owed
                  {purchases.length > 0 && <>, but the purchases below account for {formatCurrency(itemized, account.currency)} of it</>}.
                  {' '}The remaining {formatCurrency(gap, account.currency)} has no schedule, so it never appears in a deadline.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">The purchases add up to more than this loan owes</p>
                <p>
                  The purchases below have {formatCurrency(itemized, account.currency)} left to pay, but the account carries only {formatCurrency(owed, account.currency)} owed. The {formatCurrency(-gap, account.currency)} difference is scheduled but not counted in the loan's balance.
                </p>
              </>
            )}
            {purchases.length > 0 && onSetLoanAmount && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-yellow-400/60 bg-transparent text-xs"
                disabled={!isOnline || reconciling}
                onClick={async () => {
                  setReconciling(true)
                  const result = await onSetLoanAmount(itemized)
                  setReconciling(false)
                  setFormError(withDetail(result))
                }}
              >
                {reconciling ? 'Saving...' : `Set the loan amount to ${formatCurrency(itemized, account.currency)}`}
              </Button>
            )}
          </div>
        </div>
      )}

      {loadState === 'error' ? (
        <ErrorState title="Couldn't load your financed purchases" description={error} detail={errorDetail} onRetry={() => void refetch()} />
      ) : loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading financed purchases">
          {[0, 1].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
        </div>
      ) : purchases.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
          <Layers3 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No financed purchases yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add each item separately to build a combined repayment schedule.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {purchases.map((purchase) => {
              const paid = purchase.paid_amount ?? 0
              const remaining = purchase.remaining_balance ?? purchase.total_payable
              const split = splitPurchaseProgress(purchase)
              return (
                <article key={purchase.id} className="rounded-xl border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{purchase.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{purchase.term_months} month{purchase.term_months === 1 ? '' : 's'}</span>
                        <span aria-hidden>·</span>
                        <span>{purchase.monthly_interest_rate}% monthly</span>
                        {purchase.opening_installments_paid > 0 && (
                          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[0.625rem]">
                            {purchase.opening_installments_paid} imported paid
                          </Badge>
                        )}
                        {purchase.category && <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[0.625rem]">{purchase.category.name}</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <div className="mr-1 text-right">
                        <p className="money text-sm font-semibold">{formatCurrency(purchase.monthly_installment, account.currency)}/mo</p>
                        <p className="text-[0.6875rem] text-muted-foreground">from {formatDate(purchase.first_due_date)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 text-muted-foreground sm:hidden" />}>
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions for {purchase.name}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setFormError(null); setEditPurchase(purchase) }}>
                            <Pencil /> Edit purchase
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => { setFormError(null); setDeleteTarget(purchase) }}>
                            <Trash2 /> Remove purchase
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="hidden items-center gap-1 sm:flex">
                        <Button variant="ghost" size="icon-xs" aria-label={`Edit ${purchase.name}`} title="Edit purchase" onClick={() => { setFormError(null); setEditPurchase(purchase) }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${purchase.name}`} title="Remove purchase" onClick={() => { setFormError(null); setDeleteTarget(purchase) }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div
                    role="img"
                    aria-label={`${formatCurrency(split.repaidAmount, account.currency)} paid through Ledger, ${formatCurrency(split.importedAmount, account.currency)} imported as already paid, of ${formatCurrency(purchase.total_payable, account.currency)}`}
                    className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full bg-primary/40" style={{ width: `${split.importedPct}%` }} />
                    <div className="h-full bg-primary" style={{ width: `${split.repaidPct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Paid {formatCurrency(paid, account.currency)}</span>
                    <span className="font-medium">{formatCurrency(remaining, account.currency)} remaining</span>
                  </div>
                </article>
              )
            })}
            {hasImportedProgress && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.6875rem] text-muted-foreground" aria-hidden>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Paid through Ledger</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/40" />Imported as already paid</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Payment schedule</h3>
                </div>
                {deadlines.length > 0 && <span className="text-xs text-muted-foreground">{deadlines.length} remaining</span>}
              </div>
              {!nextDeadline ? (
                <p className="text-xs text-muted-foreground">No upcoming payment deadlines.</p>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/40 p-3" aria-labelledby="next-loan-payment">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p id="next-loan-payment" className="text-xs font-medium text-muted-foreground">Next payment</p>
                        <p className="text-sm font-semibold">
                          {formatDate(nextDeadline.dueDate)}
                          <span className="font-normal text-muted-foreground"> · {formatDueIn(daysUntilDate(nextDeadline.dueDate, new Date()))}</span>
                        </p>
                      </div>
                      <span className="money shrink-0 text-base font-bold">{formatCurrency(nextDeadline.total, account.currency)}</span>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {nextDeadline.items.map((item) => (
                        <div key={`${item.purchaseId}-${item.installmentNumber}`} className="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground">
                          <span className="truncate">{item.purchaseName} · installment {item.installmentNumber}</span>
                          <span className="money">{formatCurrency(item.remainingAmount, account.currency)}</span>
                        </div>
                      ))}
                    </div>
                    {onRecordPayment && (
                      <Button size="sm" className="mt-3 w-full" onClick={() => onRecordPayment(nextDeadline)}>
                        Record this payment
                      </Button>
                    )}
                  </div>
                  {laterDeadlines.length > 0 && (
                    <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1" role="region" aria-label="Later payments" tabIndex={0}>
                      {laterDeadlines.map((deadline) => {
                        const isExpanded = expandedDeadline === deadline.dueDate
                        const breakdownId = `deadline-breakdown-${deadline.dueDate}`
                        return (
                          <div key={deadline.dueDate} className="border-b pb-1 last:border-0 last:pb-0">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
                              aria-expanded={isExpanded}
                              aria-controls={breakdownId}
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} payment breakdown for ${formatDate(deadline.dueDate)}`}
                              onClick={() => setExpandedDeadline(isExpanded ? null : deadline.dueDate)}
                            >
                              <span className="text-xs">
                                <span className="font-medium">{formatDate(deadline.dueDate)}</span>
                                <span className="text-muted-foreground"> · {deadline.items.length} purchase{deadline.items.length === 1 ? '' : 's'}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="money text-sm font-semibold">{formatCurrency(deadline.total, account.currency)}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden />
                              </span>
                            </button>
                            {isExpanded && (
                              <div id={breakdownId} className="mt-1 space-y-0.5 pl-2">
                                {deadline.items.map((item) => (
                                  <div key={`${item.purchaseId}-${item.installmentNumber}`} className="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground">
                                    <span className="truncate">{item.purchaseName} · installment {item.installmentNumber}</span>
                                    <span>{formatCurrency(item.remainingAmount, account.currency)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Recent Payment Splits</h3>
              </div>
              {recentAllocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Repayments will show how much was applied to each purchase.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentAllocations.map((allocation) => (
                    <div key={allocation.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{purchaseById.get(allocation.loan_purchase_id)?.name ?? 'Purchase'}</p>
                        <p className="text-[0.6875rem] text-muted-foreground">
                          {installmentLabels.get(allocation.id) ?? 'Payment'}
                          {allocation.transaction?.date && <> · {formatDate(allocation.transaction.date)}</>}
                        </p>
                      </div>
                      <span className="money shrink-0 font-semibold">{formatCurrency(allocation.amount, account.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setFormError(null) }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-lg overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4 lg:max-w-3xl">
          <DialogHeader><DialogTitle>Add Financed Purchase</DialogTitle></DialogHeader>
          <FormError error={formError} />
          {showReconciliation && gap > 0 && (
            <p className="rounded-lg border border-yellow-400/60 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
              This account already has {formatCurrency(gap, account.currency)} of unitemized debt. A financed purchase will be added on top; lower the account’s loan amount by {formatCurrency(gap, account.currency)} first if this purchase represents that same debt.
            </p>
          )}
          <LoanPurchaseForm
            accountId={account.id}
            currency={account.currency}
            categories={expenseCategories}
            loanContext={loanContextWithout(null)}
            onClose={() => setCreateOpen(false)}
            onSubmit={async (values) => {
              const result = await createPurchase(values)
              if (result.error) { setFormError(withDetail(result)); return }
              setFormError(null)
              setCreateOpen(false)
              onAccountChanged()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editPurchase)} onOpenChange={(open) => { if (!open) { setEditPurchase(null); setFormError(null) } }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-lg overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4 lg:max-w-3xl">
          <DialogHeader><DialogTitle>Edit Financed Purchase</DialogTitle></DialogHeader>
          <FormError error={formError} />
          {editPurchase && (
            <LoanPurchaseForm
              accountId={account.id}
              currency={account.currency}
              categories={expenseCategories}
              initialValues={editPurchase}
              loanContext={loanContextWithout(editPurchase)}
              onClose={() => setEditPurchase(null)}
              onSubmit={async (values) => {
                const result = await updatePurchase(editPurchase.id, {
                  category_id: values.category_id,
                  name: values.name,
                  principal_amount: values.principal_amount,
                  term_months: values.term_months,
                  monthly_interest_rate: values.monthly_interest_rate,
                  monthly_installment: values.monthly_installment,
                  opening_installments_paid: values.opening_installments_paid,
                  opening_paid_amount: values.opening_paid_amount,
                  first_due_date: values.first_due_date,
                  notes: values.notes,
                })
                if (result.error) { setFormError(withDetail(result)); return }
                setFormError(null)
                setEditPurchase(null)
                onAccountChanged()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove financed purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name ?? ''}” will be removed from the schedule and its unpaid balance will be removed from the loan. Existing repayment transactions remain in your expense history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormError error={formError} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return
              const result = await deletePurchase(deleteTarget.id)
              if (result.error) { setFormError(withDetail(result)); return }
              setDeleteTarget(null)
              onAccountChanged()
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
