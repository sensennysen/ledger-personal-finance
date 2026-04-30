import { useState } from 'react'
import { Pencil, Trash2, RepeatIcon, ImageIcon, CloudUpload } from 'lucide-react'
import { TRANSACTION_TYPE_ICON, TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import { formatCurrency } from '@/lib/utils'
import { PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Transaction } from '@/types'

interface TransactionRowProps {
  tx: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<void>
  /**
   * When provided, amount display and transfer direction labels are shown
   * relative to this account (used in AccountTransactionsPage).
   */
  contextAccountId?: string
}

export function TransactionRow({ tx, onEdit, onDelete, contextAccountId }: TransactionRowProps) {
  const [receiptOpen, setReceiptOpen] = useState(false)
  const Icon = TRANSACTION_TYPE_ICON[tx.type]
  const isIncoming = tx.type === 'transfer' && tx.to_account_id === contextAccountId

  const amountColorClass = contextAccountId
    ? tx.type === 'income' || isIncoming
      ? TRANSACTION_TYPE_COLOR.income
      : tx.type === 'expense'
        ? TRANSACTION_TYPE_COLOR.expense
        : TRANSACTION_TYPE_COLOR.transfer
    : TRANSACTION_TYPE_COLOR[tx.type]

  const amountPrefix =
    tx.type === 'income' || (contextAccountId !== undefined && isIncoming)
      ? '+'
      : tx.type === 'expense'
        ? '-'
        : ''

  const displayAmount =
    contextAccountId !== undefined && isIncoming
      ? tx.amount * (tx.exchange_rate ?? 1)
      : tx.amount

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:bg-accent/50 transition-colors group">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
        style={tx.category ? { backgroundColor: tx.category.color + '20' } : { backgroundColor: '#f1f5f9' }}
      >
        {tx.category ? tx.category.icon : <Icon className={`w-4 h-4 ${TRANSACTION_TYPE_COLOR[tx.type]}`} />}
      </div>

      {/* Two-row text block */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: description | amount */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          <p className={`text-sm font-semibold shrink-0 ${amountColorClass}`}>
            {amountPrefix}{formatCurrency(displayAmount, tx.currency)}
          </p>
        </div>
        {/* Row 2: labels | currency */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {contextAccountId !== undefined ? (
              tx.type === 'transfer' && (
                <span className="text-xs text-muted-foreground">
                  {isIncoming
                    ? `← from ${tx.account?.name ?? ''}`
                    : `→ to ${tx.to_account?.name ?? ''}`}
                </span>
              )
            ) : (
              <>
                {tx.account && (
                  <span className="text-xs text-muted-foreground">{tx.account.name}</span>
                )}
                {tx.type === 'transfer' && tx.to_account && (
                  <span className="text-xs text-muted-foreground">→ {tx.to_account.name}</span>
                )}
              </>
            )}
            {tx.category && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">{tx.category.name}</Badge>
            )}
            {tx.is_recurring && (
              <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1">
                <RepeatIcon className="w-2.5 h-2.5" />{tx.recurrence_interval}
              </Badge>
            )}
            {tx.type === 'transfer' && tx.transfer_fee != null && tx.transfer_fee > 0 && (
              <span className="text-xs text-muted-foreground">
                Fee: {formatCurrency(tx.transfer_fee, tx.currency)}
              </span>
            )}
            {tx.receipt_url && (
              tx.receipt_url.startsWith(PENDING_RECEIPT_PREFIX) ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CloudUpload className="w-3 h-3" />Receipt (syncing…)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ImageIcon className="w-3 h-3" />Receipt
                </button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">{tx.currency}</p>
        </div>
      </div>

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => onEdit(tx)}
      >
        <Pencil className="w-3 h-3" />
      </Button>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            />
          }
        >
          <Trash2 className="w-3 h-3" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{tx.description}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await onDelete(tx.id) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt viewer */}
      {tx.receipt_url && !tx.receipt_url.startsWith(PENDING_RECEIPT_PREFIX) && (
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Receipt — {tx.description}</DialogTitle>
            </DialogHeader>
            <img
              src={tx.receipt_url}
              alt={`Receipt for ${tx.description}`}
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
