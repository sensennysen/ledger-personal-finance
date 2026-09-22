import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Check, Target, Upload, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFirstRunChecklist } from '@/hooks/useFirstRunChecklist'
import {
  getStepStatus,
  isSetupComplete,
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
}

export function DashboardFirstRunChecklist({
  accounts,
  transactions,
  onAddTransaction,
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

  if (dismissed || complete) return null

  return (
    <div className="rounded-[20px] border border-border bg-card p-4 md:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Setup
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {doneCount} of {steps.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id]
          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-wrap items-center gap-4 rounded-2xl border p-4',
                step.done ? 'border-border' : 'border-2 border-primary',
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-2xl',
                  step.done
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {step.done ? <Check className="size-5" /> : <Icon className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </span>
              </span>
              {!step.done && step.id === 'account' && (
                <Button size="sm" className="shrink-0" onClick={() => navigate('/accounts')}>
                  Add account
                </Button>
              )}
              {!step.done && step.id === 'transaction' && (
                <span className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
                    <Upload className="size-3.5" />
                    Import
                  </Button>
                  <Button size="sm" onClick={() => onAddTransaction('expense')}>
                    Add entry
                  </Button>
                </span>
              )}
              {!step.done && step.id === 'cycle' && (
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
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={dismiss}
        >
          skip setup
        </button>{' '}
        and explore — nothing here is permanent.
      </p>
    </div>
  )
}
