import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Check, Target, Upload, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFirstRunChecklist } from '@/hooks/useFirstRunChecklist'
import {
  getStepStatus,
  isSetupComplete,
  shouldReserveChecklist,
  type FirstRunStep,
} from '@/lib/firstRunChecklist'
import type { Account, Transaction } from '@/types'
import type { TransactionKind } from '@/components/transactions/transactionKinds'

const STEP_ICONS: Record<FirstRunStep['id'], LucideIcon> = {
  account: Wallet,
  transaction: ArrowLeftRight,
  cycle: Target,
}

interface DashboardFirstRunChecklistProps {
  accounts: Account[]
  transactions: Transaction[]
  onAddTransaction: (kind: TransactionKind) => void
  /**
   * Accounts and transactions are still being read. The card then keeps its rows, titles and
   * descriptions (they do not depend on data) and greys out the counts and buttons, so Home does
   * not jump when it appears (LED-199). It renders only when it is known to show.
   */
  loading?: boolean
}

export function DashboardFirstRunChecklist({
  accounts,
  transactions,
  onAddTransaction,
  loading = false,
}: DashboardFirstRunChecklistProps) {
  const navigate = useNavigate()
  const { dismissed, dismiss, cycleConfirmed } = useFirstRunChecklist()

  const progress = {
    hasAccount: accounts.length > 0,
    hasTransaction: transactions.length > 0,
    cycleConfirmed,
  }
  const steps = getStepStatus(progress)
  const doneCount = steps.filter((step) => step.done).length
  const complete = isSetupComplete(progress)

  if (loading) {
    if (!shouldReserveChecklist({ dismissed, cycleConfirmed })) return null
  } else if (dismissed || complete) {
    return null
  }

  return (
    <div className="rounded-[20px] border border-border bg-card p-4 md:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Setup
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: loading ? 0 : `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {loading ? <SkeletonText className="w-8" /> : `${doneCount} of ${steps.length}`}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id]
          return (
            <div
              key={step.id}
              className={cn(
                // gap-x/gap-y split (not gap-4): the transaction step's button
                // group wraps below sm, and a 16px vertical gap there pushed
                // the row past its height target (LED-158).
                'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-4',
                // The unfinished row's second pixel is an inset ring, not border-2, so a row is the
                // same height finished, unfinished or loading and Home does not move (LED-199).
                !loading && !step.done ? 'border-primary ring-1 ring-inset ring-primary' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                  loading || step.done
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {!loading && step.done ? <Check className="size-5" /> : <Icon className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{step.title}</span>
                <span
                  className={cn(
                    'mt-0.5 block text-xs leading-relaxed text-muted-foreground',
                    // One line below sm: with the wrapped button row, two
                    // description lines pushed step 2 past ~130px (LED-158).
                    step.id === 'transaction' && (loading || !step.done) && 'line-clamp-1 sm:line-clamp-none',
                  )}
                >
                  {step.description}
                </span>
              </span>
              {/* Widths are the real buttons' (94, 78 + 77, 98px): a wider block wraps the text column a line sooner. */}
              {loading && step.id === 'account' && <Skeleton className="h-7 w-[94px] shrink-0 rounded-full" />}
              {loading && step.id === 'transaction' && (
                <span className="flex w-full basis-full shrink-0 items-center gap-2 sm:w-auto sm:basis-auto">
                  <Skeleton className="h-7 w-[78px] rounded-full" />
                  <Skeleton className="h-7 w-[77px] rounded-full" />
                </span>
              )}
              {loading && step.id === 'cycle' && <Skeleton className="h-7 w-[98px] shrink-0 rounded-full" />}
              {!loading && !step.done && step.id === 'account' && (
                <Button size="sm" className="shrink-0" onClick={() => navigate('/accounts')}>
                  Add account
                </Button>
              )}
              {!loading && !step.done && step.id === 'transaction' && (
                // Full-width below sm forces this onto its own line instead of
                // squeezing the text column down to a few characters (LED-158).
                <span className="flex w-full basis-full shrink-0 items-center gap-2 sm:w-auto sm:basis-auto">
                  <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
                    <Upload className="size-3.5" />
                    Import
                  </Button>
                  <Button size="sm" onClick={() => onAddTransaction('expense')}>
                    Add entry
                  </Button>
                </span>
              )}
              {!loading && !step.done && step.id === 'cycle' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate('/settings')}
                >
                  Choose cycle
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Or{' '}
        {loading ? (
          <span className="font-semibold text-primary">skip setup</span>
        ) : (
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={dismiss}
          >
            skip setup
          </button>
        )}{' '}
        and explore — nothing here is permanent.
      </p>
    </div>
  )
}
