import { useEntryDetail } from '@/contexts/EntryContext'
import { memo, useEffect, useState } from 'react'
import { Pencil, Trash2, RepeatIcon, ImageIcon, CloudUpload, Scissors, Bookmark, MoreHorizontal, Clock, Repeat, CalendarClock, Paperclip } from 'lucide-react'
import { TRANSACTION_TYPE_ICON, TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import { formatCurrency, formatDateShort, getLocalDateString } from '@/lib/utils'
import { countsYet } from '@/lib/countsYet'
import { isPendingReceiptReference, resolveReceiptUrl } from '@/lib/receiptUrls'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Badge } from '@/components/ui/badge'
import { InteractiveRow } from '@/components/ui/interactive-row'
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
import { amountDisplay } from '@/lib/transactionWindow'
import { inferTransactionKind } from '@/components/transactions/transactionKinds'
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
  /** Compact density from the result bar (LED-61): tighter padding and a smaller icon tile. */
  dense?: boolean
  /** Shows the date on the row, for a flat list sorted by amount (LED-241). */
  showDate?: boolean
  /** 'list' (phones, M-06): a flat one-line row inside a day card; the whole row opens the entry sheet. */
  variant?: 'card' | 'list'
  /** The profile's currency; the list variant names a row's currency only when it differs. */
  baseCurrency?: string
}

// Memoised (LED-164): a load step in the windowed list only mounts new rows,
// so an already-rendered row must not re-render when the props callers pass
// it are unchanged (tx, and stable callbacks — see the callers' useCallback wraps).
function TransactionRowImpl({
  tx,
  onEdit,
  onDelete,
  onSplit,
  onSaveTemplate,
  selectable,
  selected,
  onSelect,
  contextAccountId,
  dense,
  showDate,
  variant = 'card',
  baseCurrency,
}: TransactionRowProps) {
  const openDetail = useEntryDetail()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const Icon = TRANSACTION_TYPE_ICON[tx.type]
  const isIncoming = (tx.type === 'transfer' || tx.type === 'expense') && tx.to_account_id === contextAccountId
  // An expense with a target is a payment against a liability; the target's account type says which,
  // the same rule the form uses (inferTransactionKind).
  const paymentKind = inferTransactionKind(tx.type, tx.to_account_id, tx.to_account?.type)
  const isLoanRepayment = paymentKind === 'loan-repayment' || paymentKind === 'card-payment'
  const hasReceipt = !!tx.receipt_url && !isPendingReceiptReference(tx.receipt_url)
  const displayedReceiptUrl = receiptOpen ? resolvedReceiptUrl : null

  useEffect(() => {
    if (!receiptOpen || !tx.receipt_url || isPendingReceiptReference(tx.receipt_url)) return

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

  const { sign: amountPrefix, value: displayAmount, currency: displayCurrency } = amountDisplay(tx, contextAccountId)

  // Split only where the inline button offers it: never on transfers or repayments (M-07).
  const canSplit = !!onSplit && tx.type !== 'transfer' && !isLoanRepayment
  const open = () =>
    openDetail
      ? openDetail(tx, {
          onEdit: () => onEdit(tx),
          onDelete: () => void onDelete(tx.id),
          onSplit: canSplit ? () => onSplit(tx) : undefined,
          onSaveTemplate: onSaveTemplate ? () => onSaveTemplate(tx) : undefined,
        })
      : onEdit(tx)

  if (variant === 'list') {
    const today = getLocalDateString()
    const scheduled = !countsYet(tx.date, today)
    const isPayment = tx.type === 'transfer' || isLoanRepayment
    const meta = [
      showDate ? formatDateShort(tx.date) : '',
      contextAccountId !== undefined
        ? isPayment
          ? isIncoming
            ? `← from ${tx.account?.name ?? ''}`
            : `→ to ${tx.to_account?.name ?? ''}`
          : (tx.category?.name ?? '')
        : isPayment
          ? `${tx.account?.name ?? ''} → ${tx.to_account?.name ?? ''}`
          : [tx.account?.name ?? '', tx.category?.name ?? 'Uncategorized'].filter(Boolean).join(' · '),
      tx.tags && tx.tags.length > 0
        ? `#${tx.tags[0]}${tx.tags.length > 1 ? ` +${tx.tags.length - 1}` : ''}`
        : '',
      tx.type === 'transfer' && tx.transfer_fee != null && tx.transfer_fee > 0
        ? `Fee ${formatCurrency(tx.transfer_fee, tx.currency)}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const flag = 'size-[13px] shrink-0 text-muted-foreground'
    return (
      <InteractiveRow
        as="div"
        onActivate={open}
        className="group/row flex items-stretch pl-4 press-scale hover:bg-surface-hover focus-visible:ring-inset cursor-pointer"
      >
        {selectable && (
          // Its own target: a tap here selects, it does not open the row.
          <label
            className="-ml-2 flex w-11 shrink-0 items-center justify-center cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onSelect?.(tx.id)}
              className="size-5 accent-primary cursor-pointer"
              aria-label={`Select ${tx.description}`}
            />
          </label>
        )}
        <div className="flex items-center pr-3">
          <div
            className="size-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `var(--${tx.type}-container)` }}
          >
            {tx.category ? tx.category.icon : <Icon className={`w-4 h-4 ${TRANSACTION_TYPE_COLOR[tx.type]}`} />}
          </div>
        </div>
        <div className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 border-t border-border pr-4 group-first/row:border-t-0">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{tx.description}</span>
              {tx.is_recurring && (
                <Repeat role="img" aria-label={`Repeats ${tx.recurrence_interval ?? ''}`.trim()} className={flag} />
              )}
              {scheduled && <CalendarClock role="img" aria-label="Scheduled" className={flag} />}
              {tx.receipt_url && <Paperclip role="img" aria-label="Has receipt" className={flag} />}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tx.queued ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Clock className="size-3" />Not synced yet
                </span>
              ) : (
                meta
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`money text-sm font-medium ${amountColorClass}`}>
              {amountPrefix}{formatCurrency(displayAmount, displayCurrency)}
            </p>
            {baseCurrency && displayCurrency !== baseCurrency && (
              <p className="text-[0.6875rem] text-muted-foreground">{displayCurrency}</p>
            )}
          </div>
        </div>
      </InteractiveRow>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${dense ? 'px-3 py-2' : 'p-3'} rounded-lg bg-card border hover:bg-surface-hover transition-colors group`}>
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
        className={`${dense ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0 text-base`}
        style={{ backgroundColor: 'var(--'+tx.type+'-container)' }}
      >
        {tx.category ? tx.category.icon : <Icon className={`w-4 h-4 ${TRANSACTION_TYPE_COLOR[tx.type]}`} />}
      </div>

      {/* Two-row text block */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: description | amount */}
        <div className="flex items-baseline justify-between gap-2">
          <button type="button" className="text-sm font-medium truncate text-left py-1" onClick={open}>{tx.description}</button>
          <p className={`money text-sm font-semibold shrink-0 ${amountColorClass}`}>
            {amountPrefix}{formatCurrency(displayAmount, displayCurrency)}
          </p>
        </div>
        {/* Row 2: labels | currency */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showDate && (
              <time dateTime={tx.date} className="text-xs text-muted-foreground">{formatDateShort(tx.date)}</time>
            )}
            {tx.queued && (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <Clock className="w-3 h-3" />Not synced yet
              </span>
            )}
            {contextAccountId !== undefined ? (
              (tx.type === 'transfer' || isLoanRepayment) && (
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
                {(tx.type === 'transfer' || isLoanRepayment) && tx.to_account && (
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
            {tx.tags && tx.tags.length > 0 && tx.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[0.625rem] py-0 px-1.5 h-4 text-muted-foreground gap-0.5">
                # {tag}
              </Badge>
            ))}
            {!countsYet(tx.date, getLocalDateString()) && (
              // Dated later: listed now, counted in totals from its date (LED-238).
              <Badge variant="outline" className="text-xs py-0 px-1.5">Scheduled</Badge>
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
              isPendingReceiptReference(tx.receipt_url) ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CloudUpload className="w-3 h-3" />Receipt (syncing…)
                </span>
              ) : hasReceipt ? (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptLoading(true)
                    setReceiptOpen(true)
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ImageIcon className="w-3 h-3" />Receipt
                </button>
              ) : null
            )}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">{displayCurrency}</p>
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
          tx.type !== 'transfer' && !isLoanRepayment ? (
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
          <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-7 w-7 text-muted-foreground hover:text-foreground' })}>
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(tx)}>
              <Pencil className="w-4 h-4" />
              Edit
            </DropdownMenuItem>
            {onSplit && tx.type !== 'transfer' && !isLoanRepayment && (
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
                className="w-full rounded-lg object-contain max-h-[70vh]"
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

export const TransactionRow = memo(TransactionRowImpl)
