import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { KIND_VISUALS } from '@/components/transactions/kindVisuals'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import {
  TRANSACTION_KIND_DIALOG_TITLES,
  TRANSACTION_KIND_LABELS,
  type TransactionKind,
} from '@/components/transactions/transactionKinds'
import { useAccounts } from '@/hooks/useAccounts'
import { useKindMenuItems } from '@/hooks/useKindMenuItems'
import { resolveEditTarget } from '@/lib/editTarget'
import { canChangeKind, kindDialogSubtitle } from '@/lib/kindMenu'
import type { TransactionType } from '@/types'

interface TransactionEntryHeaderProps {
  kind: TransactionKind
  /** Overrides the kind's title, e.g. "Pay Car loan" on a loan's own page. */
  title?: string
  /** Opens the kind menu from the header; the form swaps kind and keeps shared fields. */
  onChangeKind?: (kind: TransactionKind) => void
  /** Same visibility the page gives its own kind menu, so Change kind never offers what Add hides. */
  showLoanRepayment?: boolean
  showCardPayment?: boolean
}

/**
 * A new-transaction dialog's identity: the kind the user just picked, stated once
 * (4c, 5b, 12a), with a Change kind link back to the menu so a mis-pick is not a dead end.
 */
export function TransactionEntryHeader({
  kind,
  title,
  onChangeKind,
  showLoanRepayment,
  showCardPayment,
}: TransactionEntryHeaderProps) {
  const items = useKindMenuItems({ showLoanRepayment, showCardPayment })
  const { icon: Icon, tile, color } = KIND_VISUALS[kind]
  const subtitle = kindDialogSubtitle(kind, items)
  return (
    <DialogHeader className="flex-row items-center gap-3 pr-8">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tile}`} aria-hidden>
        <Icon className={color} />
      </span>
      <div className="min-w-0 space-y-1">
        <DialogTitle>{title ?? TRANSACTION_KIND_DIALOG_TITLES[kind]}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          {subtitle}
          {onChangeKind && canChangeKind(kind) && (
            <>
              {' · '}
              <TransactionKindMenu
                selectedKind={kind}
                showLoanRepayment={showLoanRepayment}
                showCardPayment={showCardPayment}
                onSelect={onChangeKind}
                align="start"
                trigger={
                  <Button type="button" variant="link" className="h-auto p-0 text-sm">
                    Change kind
                  </Button>
                }
              />
            </>
          )}
        </p>
      </div>
    </DialogHeader>
  )
}

/**
 * The edit dialog's title. A plain entry is "Edit transaction" and its Kind selector is the
 * form's first control; a saved loan repayment or card payment states its kind here and has no
 * selector (LED-112). The target account's type decides, as it does inside the form.
 */
export function TransactionEditHeader({ type, toAccountId }: { type: TransactionType; toAccountId: string | null }) {
  const { accounts } = useAccounts()
  const target = resolveEditTarget(type === 'expense' ? toAccountId : null, accounts)
  const kind: TransactionKind | null =
    target === 'loan' ? 'loan-repayment' : target === 'card' ? 'card-payment' : null
  if (!kind) {
    return (
      <DialogHeader>
        <DialogTitle>Edit transaction</DialogTitle>
      </DialogHeader>
    )
  }
  const { icon: Icon, tile, color } = KIND_VISUALS[kind]
  return (
    <DialogHeader className="flex-row items-center gap-3 pr-8">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tile}`} aria-hidden>
        <Icon className={color} />
      </span>
      <div className="min-w-0 space-y-1">
        <DialogTitle>{`Edit ${TRANSACTION_KIND_LABELS[kind].toLowerCase()}`}</DialogTitle>
        <p className="text-sm text-muted-foreground">{kindDialogSubtitle(kind, [])}</p>
      </div>
    </DialogHeader>
  )
}
