import { useEntryDetail } from '@/contexts/EntryContext'
import { useEffect, useState } from 'react'
import {
  Pencil,
  Trash2,
  RepeatIcon,
  ImageIcon,
  CloudUpload,
  Scissors,
  Bookmark,
  MoreVertical,
} from 'lucide-react'
import { TRANSACTION_TYPE_ICON, TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import { formatCurrency, cn } from '@/lib/utils'
import { isPendingReceiptReference, resolveReceiptUrl } from '@/lib/receiptUrls'
import { buttonVariants } from '@/components/ui/button-variants'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Transaction } from '@/types'

interface TransactionRowProps {
  tx: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<void>
  onSplit?: (tx: Transaction) => void
  onSaveTemplate?: (tx: Transaction) => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
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
  const openDetail = useEntryDetail()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const Icon = TRANSACTION_TYPE_ICON[tx.type]
  const isIncoming =
    (tx.type === 'transfer' || tx.type === 'expense') &&
    tx.to_account_id === contextAccountId
  const isLoanRepayment = tx.type === 'expense' && Boolean(tx.to_account_id)
  const hasReceipt =
    !!tx.receipt_url && !isPendingReceiptReference(tx.receipt_url)
  const displayedReceiptUrl = receiptOpen ? resolvedReceiptUrl : null
  const canSplit = Boolean(onSplit) && tx.type !== 'transfer' && !isLoanRepayment

  useEffect(() => {
    if (
      !receiptOpen ||
      !tx.receipt_url ||
      isPendingReceiptReference(tx.receipt_url)
    )
      return
    let cancelled = false
    resolveReceiptUrl(tx.receipt_url)
      .then((url) => {
        if (!cancelled) setResolvedReceiptUrl(url)
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [receiptOpen, tx.receipt_url])

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
        ? '−'
        : ''

  const displayAmount =
    contextAccountId !== undefined && isIncoming
      ? tx.amount * (tx.exchange_rate ?? 1)
      : tx.amount

  const metaBits: string[] = []
  if (contextAccountId === undefined && tx.account) metaBits.push(tx.account.name)
  else if (contextAccountId !== undefined && (tx.type === 'transfer' || isLoanRepayment))
    metaBits.push(
      isIncoming
        ? `← ${tx.account?.name ?? ''}`
        : `→ ${tx.to_account?.name ?? ''}`,
    )

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3.5 sm:px-[18px]">
      {selectable ? (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onSelect?.(tx.id)}
          className="size-4 shrink-0 cursor-pointer rounded accent-primary"
          aria-label="Select transaction"
        />
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `var(--${tx.type}-container)` }}
        >
          {tx.category ? (
            tx.category.icon
          ) : (
            <Icon className={cn('size-[17px]', TRANSACTION_TYPE_COLOR[tx.type])} />
          )}
        </div>
      )}

      <button
        type="button"
        className="min-w-0 text-left"
        onClick={() =>
          openDetail ? openDetail(tx, () => onEdit(tx)) : onEdit(tx)
        }
      >
        <span className="block truncate text-[14px] font-semibold text-foreground">
          {tx.description}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {tx.category && (
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {tx.category.name}
            </span>
          )}
          {metaBits.map((bit) => (
            <span key={bit} className="text-[11px] text-muted-foreground">
              {bit}
            </span>
          ))}
          {tx.is_recurring && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <RepeatIcon className="size-2.5" />
              {tx.recurrence_interval}
            </span>
          )}
          {tx.receipt_url &&
            (isPendingReceiptReference(tx.receipt_url) ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <CloudUpload className="size-2.5" />
                syncing…
              </span>
            ) : hasReceipt ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  setReceiptLoading(true)
                  setReceiptOpen(true)
                }}
                className="inline-flex items-center gap-0.5 text-[11px] text-primary"
              >
                <ImageIcon className="size-2.5" />
                Receipt
              </span>
            ) : null)}
        </span>
      </button>

      <p
        className={cn(
          'money shrink-0 whitespace-nowrap text-[14px] font-bold',
          amountColorClass,
        )}
      >
        {amountPrefix}
        {formatCurrency(displayAmount, tx.currency)}
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({
            variant: 'ghost',
            size: 'icon-sm',
            className: 'size-8 rounded-full text-muted-foreground',
          })}
          aria-label="Transaction actions"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(tx)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          {canSplit && (
            <DropdownMenuItem onClick={() => onSplit?.(tx)}>
              <Scissors className="size-4" />
              Split
            </DropdownMenuItem>
          )}
          {onSaveTemplate && (
            <DropdownMenuItem onClick={() => onSaveTemplate(tx)}>
              <Bookmark className="size-4" />
              Save as template
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await onDelete(tx.id)
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasReceipt && (
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Receipt — {tx.description}</DialogTitle>
            </DialogHeader>
            {displayedReceiptUrl ? (
              <img
                src={displayedReceiptUrl}
                alt={`Receipt for ${tx.description}`}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {receiptLoading ? 'Loading receipt…' : 'Receipt unavailable.'}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
