import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Layers3, MoreVertical, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { LoanPurchaseForm } from '@/components/accounts/LoanPurchaseForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories } from '@/hooks/useCategories'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getLoanAmountOwed } from '@/lib/loans'
import type { Account, LoanPurchase } from '@/types'

interface LoanPurchaseTrackerProps {
  account: Account
  onAccountChanged: () => void
  loanData?: ReturnType<typeof useLoanPurchases>
}

const DEADLINES_PAGE_SIZE = 4

export function LoanPurchaseTracker({ account, onAccountChanged, loanData }: LoanPurchaseTrackerProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editPurchase, setEditPurchase] = useState<LoanPurchase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoanPurchase | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deadlinePage, setDeadlinePage] = useState(0)
  const [expandedDeadline, setExpandedDeadline] = useState<string | null>(null)
  const { categories } = useCategories()
  const internalLoanData = useLoanPurchases(account.id, !loanData)
  const { purchases, allocations, deadlines, loading, error, createPurchase, updatePurchase, deletePurchase } = loanData ?? internalLoanData
  const expenseCategories = categories.filter((category) => category.type === 'expense' || category.type === 'both')
  const purchaseById = useMemo(() => new Map(purchases.map((purchase) => [purchase.id, purchase])), [purchases])
  const recentAllocations = useMemo(
    () => [...allocations]
      .sort((left, right) => (right.transaction?.date ?? '').localeCompare(left.transaction?.date ?? '') || right.created_at.localeCompare(left.created_at))
      .slice(0, 8),
    [allocations],
  )
  const deadlinePageCount = Math.max(1, Math.ceil(deadlines.length / DEADLINES_PAGE_SIZE))
  const activeDeadlinePage = Math.min(deadlinePage, deadlinePageCount - 1)
  const visibleDeadlines = useMemo(
    () => deadlines.slice(activeDeadlinePage * DEADLINES_PAGE_SIZE, (activeDeadlinePage + 1) * DEADLINES_PAGE_SIZE),
    [activeDeadlinePage, deadlines],
  )

  return (
    <section className="space-y-4" aria-labelledby="financed-purchases-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="financed-purchases-title" className="text-base font-semibold">Financed Purchases</h2>
          <p className="text-xs text-muted-foreground">Each purchase keeps its own term while shared deadlines are totaled.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Add Purchase
        </Button>
      </div>

      {(error || formError) && <p role="alert" className="text-sm text-destructive">{formError ?? error}</p>}

      {loading ? (
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
              const progress = purchase.total_payable > 0 ? Math.min(100, (paid / purchase.total_payable) * 100) : 0
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
                  <Progress value={progress} className="mt-3 h-1.5" />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Paid {formatCurrency(paid, account.currency)}</span>
                    <span className="font-medium">{formatCurrency(remaining, account.currency)} remaining</span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Payment Deadlines</h3>
              </div>
              {visibleDeadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming payment deadlines.</p>
              ) : (
                <div className="space-y-3">
                {visibleDeadlines.map((deadline) => {
                  const isExpanded = expandedDeadline === deadline.dueDate
                  const breakdownId = `deadline-breakdown-${deadline.dueDate}`
                  return (
                    <div key={deadline.dueDate} className="border-b pb-2 last:border-0 last:pb-0">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={isExpanded}
                        aria-controls={breakdownId}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} payment breakdown for ${formatDate(deadline.dueDate)}`}
                        onClick={() => setExpandedDeadline(isExpanded ? null : deadline.dueDate)}
                      >
                        <span className="text-xs font-medium">{formatDate(deadline.dueDate)}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="money text-sm font-semibold">{formatCurrency(deadline.total, account.currency)}</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden />
                        </span>
                      </button>
                      {isExpanded && (
                        <div id={breakdownId} className="mt-1 space-y-0.5 pl-2">
                          {deadline.items.map((item) => (
                            <div key={`${item.purchaseId}-${item.installmentNumber}`} className="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground">
                              <span className="truncate">{item.purchaseName} · {item.installmentNumber}</span>
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
              {deadlinePageCount > 1 && (
                <nav className="mt-3 flex items-center justify-between gap-3 border-t pt-2.5" aria-label="Payment deadline pages">
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    Page {activeDeadlinePage + 1} of {deadlinePageCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={activeDeadlinePage === 0}
                      aria-label="Previous payment deadlines"
                      onClick={() => setDeadlinePage(Math.max(0, activeDeadlinePage - 1))}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={activeDeadlinePage >= deadlinePageCount - 1}
                      aria-label="Next payment deadlines"
                      onClick={() => setDeadlinePage(Math.min(deadlinePageCount - 1, activeDeadlinePage + 1))}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </nav>
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
                        <p className="text-[0.6875rem] text-muted-foreground">{allocation.transaction?.date ? formatDate(allocation.transaction.date) : 'Payment'}</p>
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
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-lg overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
          <DialogHeader><DialogTitle>Add Financed Purchase</DialogTitle></DialogHeader>
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          {purchases.length === 0 && getLoanAmountOwed(account) > 0 && (
            <p className="rounded-lg border border-yellow-400/60 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
              This account already has {formatCurrency(getLoanAmountOwed(account), account.currency)} of unitemized opening debt. A financed purchase will be added on top; set the account’s loan amount to 0 first if this purchase represents that same debt.
            </p>
          )}
          <LoanPurchaseForm
            accountId={account.id}
            currency={account.currency}
            categories={expenseCategories}
            onClose={() => setCreateOpen(false)}
            onSubmit={async (values) => {
              const result = await createPurchase(values)
              if (result.error) { setFormError(result.error); return }
              setFormError(null)
              setCreateOpen(false)
              onAccountChanged()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editPurchase)} onOpenChange={(open) => { if (!open) { setEditPurchase(null); setFormError(null) } }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-lg overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
          <DialogHeader><DialogTitle>Edit Financed Purchase</DialogTitle></DialogHeader>
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          {editPurchase && (
            <LoanPurchaseForm
              accountId={account.id}
              currency={account.currency}
              categories={expenseCategories}
              initialValues={editPurchase}
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
                if (result.error) { setFormError(result.error); return }
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
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return
              const result = await deletePurchase(deleteTarget.id)
              if (result.error) { setFormError(result.error); return }
              setDeleteTarget(null)
              onAccountChanged()
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
