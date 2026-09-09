import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Plus,
  Search,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Trash2,
  Bookmark,
  X,
} from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCycle } from '@/contexts/cycleState'
import {
  formatDate,
  formatCurrency,
  getCustomMonthRange,
  getCurrentCycleMonthKey,
  getLocalDateString,
  cn,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { UndoToast } from '@/components/ui/undo-toast'
import {
  TransactionForm,
  type TransactionFormValues,
} from '@/components/transactions/TransactionForm'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import {
  inferTransactionKind,
  TRANSACTION_KIND_DIALOG_TITLES,
  type TransactionKind,
} from '@/components/transactions/transactionKinds'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import {
  SplitTransactionDialog,
  type SplitInput,
} from '@/components/transactions/SplitTransactionDialog'
import { useTransactionTemplates } from '@/hooks/useTransactionTemplates'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import type { Transaction } from '@/types'

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}
function addMonths(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  return getMonthKey(new Date(year, month - 1 + delta, 1))
}

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { startDay, selectedMonth, setSelectedMonth } = useCycle()
  const [createOpen, setCreateOpen] = useState(false)
  const [transactionKind, setTransactionKind] = useState<TransactionKind>('expense')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null)

  const { templates, addTemplate, removeTemplate } = useTransactionTemplates()
  const [templateSourceTx, setTemplateSourceTx] = useState<Transaction | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDefaults, setTemplateDefaults] = useState<
    Partial<TransactionFormValues> | undefined
  >(undefined)

  type UndoState = { snapshots: Transaction[]; message: string }
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    transactions,
    loading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    bulkDeleteTransactions,
  } = useTransactions()

  const showUndo = useCallback((snapshots: Transaction[], message: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoState({ snapshots, message })
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null)
      undoTimerRef.current = null
    }, 5000)
  }, [])

  const handleUndoDelete = useCallback(async () => {
    if (!undoState) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoState(null)
    for (const tx of undoState.snapshots) {
      await createTransaction({
        type: tx.type,
        account_id: tx.account_id,
        to_account_id: tx.to_account_id,
        category_id: tx.category_id,
        subcategory_id: tx.subcategory_id,
        amount: tx.amount,
        currency: tx.currency,
        exchange_rate: tx.exchange_rate,
        description: tx.description,
        notes: tx.notes,
        date: tx.date,
        transfer_fee: tx.transfer_fee,
        is_recurring: tx.is_recurring,
        recurrence_interval: tx.recurrence_interval,
        recurrence_end_date: tx.recurrence_end_date,
        receipt_url: tx.receipt_url,
      })
    }
  }, [undoState, createTransaction])

  useKeyboardShortcut(
    'n',
    useCallback(() => {
      setTemplateDefaults(undefined)
      setTransactionKind('expense')
      setCreateOpen(true)
    }, []),
  )

  const handleUseTemplate = (id: string) => {
    const t = templates.find((tmpl) => tmpl.id === id)
    if (!t) return
    setTemplateDefaults({ ...t.values, date: getLocalDateString() })
    setTransactionKind(
      inferTransactionKind(t.values.type, t.values.to_account_id),
    )
    setCreateOpen(true)
  }

  const handleSaveTemplateConfirm = () => {
    if (!templateSourceTx || !templateName.trim()) return
    addTemplate(templateName.trim(), {
      type: templateSourceTx.type,
      account_id: templateSourceTx.account_id,
      to_account_id: templateSourceTx.to_account_id,
      category_id: templateSourceTx.category_id,
      subcategory_id: templateSourceTx.subcategory_id,
      amount: templateSourceTx.amount,
      currency: templateSourceTx.currency,
      exchange_rate: templateSourceTx.exchange_rate,
      description: templateSourceTx.description,
      notes: templateSourceTx.notes,
      date: templateSourceTx.date,
      transfer_fee: templateSourceTx.transfer_fee,
      is_recurring: templateSourceTx.is_recurring,
      recurrence_interval: templateSourceTx.recurrence_interval,
      recurrence_end_date: templateSourceTx.recurrence_end_date,
      receipt_url: null,
      tags: templateSourceTx.tags ?? [],
      goal_id: templateSourceTx.goal_id ?? null,
    })
    setTemplateSourceTx(null)
    setTemplateName('')
  }

  const filtered = useMemo(() => {
    const { start, end } = getCustomMonthRange(selectedMonth, startDay)
    let result = transactions.filter((t) => t.date >= start && t.date <= end)
    if (filterType !== 'all') result = result.filter((t) => t.type === filterType)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category?.name.toLowerCase().includes(q) ||
          t.account?.name.toLowerCase().includes(q),
      )
    }
    return result
  }, [transactions, filterType, search, selectedMonth, startDay])

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const tx of filtered) {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const handleCreate = async (values: TransactionFormValues) => {
    const { error } = await createTransaction(
      values as Parameters<typeof createTransaction>[0],
    )
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    const { error } = await updateTransaction(
      editingTx.id,
      values as Parameters<typeof updateTransaction>[1],
    )
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setEditingTx(null)
  }

  const handleDelete = async (id: string) => {
    const snapshot = transactions.find((t) => t.id === id)
    const { error } = await deleteTransaction(id)
    if (error) {
      console.error('Failed to delete transaction:', error)
      return
    }
    if (snapshot) showUndo([snapshot], `"${snapshot.description}" deleted`)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    const snapshots = transactions.filter((t) => ids.includes(t.id))
    setSelectedIds(new Set())
    setSelectMode(false)
    const { error } = await bulkDeleteTransactions(ids)
    if (error) {
      console.error('Bulk delete failed:', error)
      return
    }
    showUndo(
      snapshots,
      `${ids.length} transaction${ids.length !== 1 ? 's' : ''} deleted`,
    )
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  const handleSplitConfirm = async (splits: SplitInput[]) => {
    if (!splittingTx) return
    // Create every split first; only delete the original once they've all
    // landed. If a split fails we abort with the original still intact rather
    // than deleting it and losing money. (Throwing lets the dialog surface the
    // error and stay open.)
    for (const s of splits) {
      const { error } = await createTransaction({
        type: splittingTx.type,
        account_id: splittingTx.account_id,
        to_account_id: null,
        category_id: s.category_id,
        subcategory_id: null,
        amount: s.amount,
        currency: splittingTx.currency,
        exchange_rate: splittingTx.exchange_rate,
        description: s.description,
        notes: splittingTx.notes,
        date: splittingTx.date,
        transfer_fee: null,
        is_recurring: false,
        recurrence_interval: null,
        recurrence_end_date: null,
        receipt_url: null,
        tags: splittingTx.tags ?? [],
        goal_id: splittingTx.goal_id ?? null,
      })
      if (error) {
        throw new Error(
          `Couldn't create split "${s.description}": ${error}. The original transaction was left untouched.`,
        )
      }
    }
    const { error: deleteError } = await deleteTransaction(splittingTx.id)
    if (deleteError) {
      throw new Error(
        `Splits were created, but removing the original failed: ${deleteError}. Please delete "${splittingTx.description}" manually.`,
      )
    }
    setSplittingTx(null)
  }

  const monthLabel = formatMonthLabel(selectedMonth)
  const isCurrentMonth = selectedMonth >= getCurrentCycleMonthKey(startDay)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-foreground">
            Activity
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {filtered.length} transaction{filtered.length === 1 ? '' : 's'} ·{' '}
            {monthLabel}
          </p>
        </div>
        {/* Hidden on mobile — the layout FAB already provides this action */}
        <div className="hidden shrink-0 md:block">
          <TransactionKindMenu
            onSelect={(kind) => {
              setTemplateDefaults(undefined)
              setFormError(null)
              setTransactionKind(kind)
              setCreateOpen(true)
            }}
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Transaction
              </Button>
            }
          />
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              setTemplateDefaults(undefined)
              setFormError(null)
            }
          }}
        >
          <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
            <DialogHeader>
              <DialogTitle>
                {TRANSACTION_KIND_DIALOG_TITLES[transactionKind]}
              </DialogTitle>
            </DialogHeader>
            {formError && (
              <p className="-mt-2 px-1 text-sm text-expense">{formError}</p>
            )}
            <TransactionForm
              entryKind={transactionKind}
              defaultValues={templateDefaults}
              onSubmit={handleCreate}
              onClose={() => {
                setCreateOpen(false)
                setTemplateDefaults(undefined)
                setFormError(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Period + select mode */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full bg-surface-container p-1 pl-1.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[7.5rem] text-center text-[13px] font-semibold text-foreground">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
              disabled={isCurrentMonth}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSelectMode}
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors',
              selectMode
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {selectMode ? (
              <CheckSquare className="size-4" />
            ) : (
              <Square className="size-4" />
            )}
            Select items
          </button>
        </div>

        {/* Search + type filter */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-60 sm:shrink-0">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-full border-transparent bg-surface-container pl-10"
            />
          </div>
          <Tabs
            value={filterType}
            onValueChange={setFilterType}
            className="w-full sm:w-auto"
          >
            <TabsList className="w-full sm:w-auto [&_[data-slot=tabs-trigger]]:px-3.5 sm:[&_[data-slot=tabs-trigger]]:flex-none">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Templates quick-add strip */}
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            aria-expanded={templatesOpen}
            onClick={() => setTemplatesOpen((open) => !open)}
          >
            <span className="flex items-center gap-1.5">
              <Bookmark className="size-3" />
              Quick add
            </span>
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform',
                templatesOpen && 'rotate-90',
              )}
            />
          </button>
          {templatesOpen && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Use ${tmpl.name} template`}
                  className="group relative flex flex-none cursor-pointer items-center gap-2 rounded-full bg-surface-container px-3.5 py-2"
                  onClick={() => handleUseTemplate(tmpl.id)}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault()
                      handleUseTemplate(tmpl.id)
                    }
                  }}
                >
                  <span className="max-w-32 truncate text-xs font-medium">
                    {tmpl.name}
                  </span>
                  <span
                    className={cn(
                      'text-[0.6875rem]',
                      TRANSACTION_TYPE_COLOR[tmpl.values.type],
                    )}
                  >
                    {tmpl.values.type === 'income'
                      ? '+'
                      : tmpl.values.type === 'expense'
                        ? '−'
                        : ''}
                    {formatCurrency(tmpl.values.amount, tmpl.values.currency)}
                  </span>
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full border border-outline-variant bg-card text-muted-foreground hover:text-destructive group-hover:flex"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTemplate(tmpl.id)
                    }}
                    aria-label={`Remove ${tmpl.name} template`}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <span className="min-w-0 flex-1 text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedIds(new Set(filtered.map((t) => t.id)))}
          >
            Select all ({filtered.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Deselect
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleBulkDelete}
          >
            <Trash2 className="size-3.5" />
            Delete ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description={search ? 'Try a different search' : 'Add your first transaction'}
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {formatDate(date)}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {txs.length} transaction{txs.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-hidden rounded-[18px] bg-card [&>*+*]:border-t [&>*+*]:border-outline-variant">
                {txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onEdit={setEditingTx}
                    onDelete={handleDelete}
                    onSplit={setSplittingTx}
                    onSaveTemplate={(t) => {
                      setTemplateSourceTx(t)
                      setTemplateName(t.description)
                    }}
                    selectable={selectMode}
                    selected={selectedIds.has(tx.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editingTx}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTx(null)
            setFormError(null)
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {formError && (
            <p className="-mt-2 px-1 text-sm text-expense">{formError}</p>
          )}
          {editingTx && (
            <TransactionForm
              defaultValues={{
                type: editingTx.type,
                account_id: editingTx.account_id,
                to_account_id: editingTx.to_account_id,
                category_id: editingTx.category_id,
                amount: editingTx.amount,
                currency: editingTx.currency,
                exchange_rate: editingTx.exchange_rate ?? 1,
                description: editingTx.description,
                notes: editingTx.notes,
                date: editingTx.date,
                transfer_fee: editingTx.transfer_fee,
                is_recurring: editingTx.is_recurring,
                recurrence_interval: editingTx.recurrence_interval,
                recurrence_end_date: editingTx.recurrence_end_date,
                receipt_url: editingTx.receipt_url,
              }}
              onSubmit={handleEdit}
              onClose={() => {
                setEditingTx(null)
                setFormError(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog
        open={!!templateSourceTx}
        onOpenChange={(open) => {
          if (!open) {
            setTemplateSourceTx(null)
            setTemplateName('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="size-4" />
              Save as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Daily commute"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTemplateConfirm()
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTemplateSourceTx(null)
                  setTemplateName('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplateConfirm}
                disabled={!templateName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split dialog */}
      {splittingTx && (
        <SplitTransactionDialog
          tx={splittingTx}
          open={!!splittingTx}
          onOpenChange={(open) => {
            if (!open) setSplittingTx(null)
          }}
          onConfirm={handleSplitConfirm}
        />
      )}

      {/* Undo delete toast */}
      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndoDelete}
          onDismiss={() => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
            setUndoState(null)
          }}
        />
      )}
    </div>
  )
}
