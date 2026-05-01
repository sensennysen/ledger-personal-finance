import { useState } from 'react'
import { Pencil, Trash2, RepeatIcon, ImageIcon, CloudUpload, Scissors, Bookmark, MoreHorizontal } from 'lucide-react'
import { TRANSACTION_TYPE_ICON, TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import { formatCurrency } from '@/lib/utils'
import { PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'

/** Reject non-https receipt URLs to block javascript:, data:, etc. */
function isValidReceiptUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:'
  } catch {
    return false
  }
}
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Transaction } from '@/types'

interface TransactionRowProps {
  tx: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<void>
  /** Called when the scissors button is clicked. Only shown when provided and tx.type !== 'transfer'. */
  onSplit?: (tx: Transaction) => void
  /** Called when the user wants to save this transaction as a template. */
  onSaveTemplate?: (tx: Transaction) => void
  /** When true, a checkbox is shown for bulk selection. */
  selectable?: boolean
  /** Controlled checked state of the checkbox. */
  selected?: boolean
  /** Called when the checkbox changes. */
  onSelect?: (id: string) => void
  /**
   * When provided, amount display and transfer direction labels are shown
   * relative to this account (used in AccountTransactionsPage).
   */
  contextAccountId?: string
}

export function TransactionRow({
  tx,
  onEdit,
  onDelete,
  onSplit,
  onSaveTemplate,
  selectable,
  selected,
  onSelect,
  contextAccountId,
}: TransactionRowProps) {
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
      {/* Checkbox (bulk select) */}
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onSelect?.(tx.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded shrink-0 accent-primary cursor-pointer"
          aria-label="Select transaction"
        />
      )}
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
            {tx.subcategory && (
              <Badge variant="outline" className="text-xs py-0 px-1.5">{tx.subcategory.name}</Badge>
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
              ) : isValidReceiptUrl(tx.receipt_url) ? (
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ImageIcon className="w-3 h-3" />Receipt
                </button>
              ) : null
            )}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">{tx.currency}</p>
        </div>
      </div>

      {/* Action buttons — inline on sm+, dropdown on mobile */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {/* Edit */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(tx)}
        >
          <Pencil className="w-3 h-3" />
        </Button>

        {/* Split — always reserves space when onSplit is provided */}
        {onSplit && (
          tx.type !== 'transfer' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Split transaction"
              onClick={() => onSplit(tx)}
            >
              <Scissors className="w-3 h-3" />
            </Button>
          ) : (
            <div className="h-7 w-7 shrink-0" aria-hidden />
          )
        )}
        {/* Save as template */}
        {onSaveTemplate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Save as template"
            onClick={() => onSaveTemplate(tx)}
          >
            <Bookmark className="w-3 h-3" />
          </Button>
        )}
        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={async () => { await onDelete(tx.id) }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Mobile: collapsed actions dropdown */}
      <div className="sm:hidden shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(tx)}>
              <Pencil className="w-4 h-4" />
              Edit
            </DropdownMenuItem>
            {onSplit && tx.type !== 'transfer' && (
              <DropdownMenuItem onClick={() => onSplit(tx)}>
                <Scissors className="w-4 h-4" />
                Split
              </DropdownMenuItem>
            )}
            {onSaveTemplate && (
              <DropdownMenuItem onClick={() => onSaveTemplate(tx)}>
                <Bookmark className="w-4 h-4" />
                Save as template
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={async () => { await onDelete(tx.id) }}>
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Receipt viewer */}
      {tx.receipt_url && !tx.receipt_url.startsWith(PENDING_RECEIPT_PREFIX) && isValidReceiptUrl(tx.receipt_url) && (
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
