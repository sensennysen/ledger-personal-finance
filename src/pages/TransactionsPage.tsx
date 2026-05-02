import { useState, useMemo, useRef, useCallback } from 'react'
import { Plus, Search, ArrowLeftRight, ChevronLeft, ChevronRight, Upload, CheckSquare, Square, Tag, Trash2, Bookmark, X, Keyboard, LayoutList, AlignJustify } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { useCategories } from '@/hooks/useCategories'
import { useTransactionTemplates } from '@/hooks/useTransactionTemplates'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { usePreferences } from '@/hooks/usePreferences'
import { formatDate, formatCurrency, getCustomMonthRange, getCurrentCycleMonthKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { UndoToast } from '@/components/ui/undo-toast'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { SplitTransactionDialog, type SplitInput } from '@/components/transactions/SplitTransactionDialog'
import { ImportCSVDialog, type ImportTx } from '@/components/transactions/ImportCSVDialog'
import { UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import type { Transaction } from '@/types'

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function addMonths(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return getMonthKey(d)
}

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { startDay } = useMonthCycle()
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentCycleMonthKey(startDay))
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { prefs, set: setPref } = usePreferences()
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  // ── Bulk select ────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [recategorizeOpen, setRecategorizeOpen] = useState(false)
  const [recategorizeCategoryId, setRecategorizeCategoryId] = useState<string>(UNCATEGORIZED_VALUE)

  // ── Split ──────────────────────────────────────────────────
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null)

  // ── Import CSV ────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false)

  // ── Templates ─────────────────────────────────────────────
  const { templates, addTemplate, removeTemplate } = useTransactionTemplates()
  // tx pending "save as template" name input
  const [templateSourceTx, setTemplateSourceTx] = useState<Transaction | null>(null)
  const [templateName, setTemplateName] = useState('')
  // pre-filled values when opening "Add" dialog from a template
  const [templateDefaults, setTemplateDefaults] = useState<Partial<TransactionFormValues> | undefined>(undefined)

  // ── Undo delete ───────────────────────────────────────────
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
    bulkUpdateCategory,
    bulkCreateTransactions,
  } = useTransactions()

  const { categories } = useCategories()

  // ── Helpers ────────────────────────────────────────────────

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

  // ── Keyboard shortcuts ─────────────────────────────────────
  useKeyboardShortcut('n', useCallback(() => {
    setTemplateDefaults(undefined)
    setCreateOpen(true)
  }, []))

  // ── Template handlers ──────────────────────────────────────

  const handleUseTemplate = (id: string) => {
    const t = templates.find((tmpl) => tmpl.id === id)
    if (!t) return
    setTemplateDefaults({
      ...t.values,
      date: new Date().toISOString().split('T')[0],
    })
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

  // ── Filtered / grouped ─────────────────────────────────────

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
          t.account?.name.toLowerCase().includes(q)
      )
    }
    if (activeTagFilter) {
      result = result.filter((t) => t.tags?.includes(activeTagFilter))
    }
    return result
  }, [transactions, filterType, search, selectedMonth, startDay, activeTagFilter])

  const allTags = useMemo(
    () => [...new Set(transactions.flatMap((t) => t.tags ?? []))],
    [transactions]
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const tx of filtered) {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  // ── Handlers ───────────────────────────────────────────────

  const handleCreate = async (values: TransactionFormValues) => {
    const { error } = await createTransaction(values as Parameters<typeof createTransaction>[0])
    if (error) { setFormError(error); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    const { error } = await updateTransaction(editingTx.id, values as Parameters<typeof updateTransaction>[1])
    if (error) { setFormError(error); return }
    setFormError(null)
    setEditingTx(null)
  }

  const handleDelete = async (id: string) => {
    const snapshot = transactions.find((t) => t.id === id)
    const { error } = await deleteTransaction(id)
    if (error) { console.error('Failed to delete transaction:', error); return }
    if (snapshot) {
      showUndo([snapshot], `"${snapshot.description}" deleted`)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    const snapshots = transactions.filter((t) => ids.includes(t.id))
    setSelectedIds(new Set())
    setSelectMode(false)
    const { error } = await bulkDeleteTransactions(ids)
    if (error) { console.error('Bulk delete failed:', error); return }
    showUndo(snapshots, `${ids.length} transaction${ids.length !== 1 ? 's' : ''} deleted`)
  }

  const handleBulkRecategorize = async () => {
    const ids = Array.from(selectedIds)
    const catId = recategorizeCategoryId === UNCATEGORIZED_VALUE ? null : recategorizeCategoryId
    await bulkUpdateCategory(ids, catId)
    setSelectedIds(new Set())
    setSelectMode(false)
    setRecategorizeOpen(false)
    setRecategorizeCategoryId(UNCATEGORIZED_VALUE)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filtered.map((t) => t.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  // ── Split handler ──────────────────────────────────────────

  const handleSplitConfirm = async (splits: SplitInput[]) => {
    if (!splittingTx) return
    for (const s of splits) {
      await createTransaction({
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
      })
    }
    await deleteTransaction(splittingTx.id)
    setSplittingTx(null)
  }

  // ── Import handler ─────────────────────────────────────────

  const handleImport = async (txs: ImportTx[]): Promise<{ imported: number; error: string | null }> => {
    const rows = txs.map((t) => ({
      type: t.type,
      account_id: t.account_id,
      to_account_id: null as string | null,
      category_id: null as string | null,
      subcategory_id: null as string | null,
      amount: t.amount,
      currency: t.currency,
      exchange_rate: 1,
      description: t.description,
      notes: null as string | null,
      date: t.date,
      transfer_fee: null as number | null,
      is_recurring: false,
      recurrence_interval: null as null,
      recurrence_end_date: null as string | null,
      receipt_url: null as string | null,
    }))
    const result = await bulkCreateTransactions(rows)
    return { imported: result.imported ?? 0, error: result.error ?? null }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground border border-border rounded px-1.5 py-0.5 select-none"
            title="Keyboard shortcuts: N = new transaction"
          >
            <Keyboard className="w-2.5 h-2.5" />N
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </Button>
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setTemplateDefaults(undefined); setFormError(null) } }}>
            <DialogTrigger render={<Button className="gap-2" size="sm" />}>
              <Plus className="w-4 h-4" />Add
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
              {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
              <TransactionForm
                defaultValues={templateDefaults}
                onSubmit={handleCreate}
                onClose={() => { setCreateOpen(false); setTemplateDefaults(undefined); setFormError(null) }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk action bar / Filter row */}
      {selectMode && selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium flex-1 min-w-0">
            {selectedIds.size} selected
          </span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAll}>
            Select all ({filtered.length})
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={deselectAll}>
            Deselect
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setRecategorizeOpen(true)}
          >
            <Tag className="w-3.5 h-3.5" />
            Re-categorize
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleBulkDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete ({selectedIds.size})
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filterType} onValueChange={setFilterType} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">All</TabsTrigger>
              <TabsTrigger value="income" className="flex-1 sm:flex-none">Income</TabsTrigger>
              <TabsTrigger value="expense" className="flex-1 sm:flex-none">Expense</TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1 sm:flex-none">Transfer</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-xl px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold flex-1 text-center">{formatMonthLabel(selectedMonth)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
          disabled={selectedMonth >= getCurrentCycleMonthKey(startDay)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Templates strip */}
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Bookmark className="w-3 h-3" />Templates
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative flex-none flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 cursor-pointer hover:border-primary/40 hover:bg-accent/60 transition-colors select-none"
                onClick={() => handleUseTemplate(tmpl.id)}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate max-w-30">{tmpl.name}</span>
                  <span className={`text-[0.6875rem] ${TRANSACTION_TYPE_COLOR[tmpl.values.type]}`}>
                    {tmpl.values.type === 'income' ? '+' : tmpl.values.type === 'expense' ? '-' : ''}
                    {formatCurrency(tmpl.values.amount, tmpl.values.currency)}
                  </span>
                </div>
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-muted border border-border text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeTemplate(tmpl.id) }}
                  aria-label={`Remove ${tmpl.name} template`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View controls row */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setPref('txView', prefs.txView === 'grouped' ? 'flat' : 'grouped')}
          title={prefs.txView === 'grouped' ? 'Switch to flat view' : 'Switch to grouped view'}
        >
          {prefs.txView === 'grouped' ? <LayoutList className="w-3.5 h-3.5" /> : <AlignJustify className="w-3.5 h-3.5" />}
          <span>{prefs.txView === 'grouped' ? 'Grouped' : 'Flat'}</span>
        </Button>
        <Button
          variant={selectMode ? 'secondary' : 'ghost'}
          size="sm"
          className="gap-1.5 text-xs"
          onClick={toggleSelectMode}
        >
          {selectMode ? (
            <CheckSquare className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          <span>Select</span>
        </Button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${
                activeTagFilter === tag
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <Tag className="w-2.5 h-2.5" />{tag}
            </button>
          ))}
          {activeTagFilter && (
            <button
              type="button"
              onClick={() => setActiveTagFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />Clear
            </button>
          )}
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description={search ? 'Try a different search' : 'Add your first transaction'}
        />
      ) : prefs.txView === 'flat' ? (
        <div className="space-y-1">
          {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onEdit={setEditingTx}
              onDelete={handleDelete}
              onSplit={setSplittingTx}
              onSaveTemplate={(t) => { setTemplateSourceTx(t); setTemplateName(t.description) }}
              selectable={selectMode}
              selected={selectedIds.has(tx.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {formatDate(date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {txs.length} transaction{txs.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-1">
                {txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onEdit={setEditingTx}
                    onDelete={handleDelete}
                    onSplit={setSplittingTx}
                    onSaveTemplate={(t) => { setTemplateSourceTx(t); setTemplateName(t.description) }}
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
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) { setEditingTx(null); setFormError(null) } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
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
              onClose={() => { setEditingTx(null); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk re-categorize dialog */}
      <Dialog open={recategorizeOpen} onOpenChange={setRecategorizeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Re-categorize {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>New category</Label>
              <Select value={recategorizeCategoryId} onValueChange={(v) => setRecategorizeCategoryId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category">
                    {recategorizeCategoryId === UNCATEGORIZED_VALUE
                      ? 'Uncategorized'
                      : (() => {
                          const cat = categories.find((c) => c.id === recategorizeCategoryId)
                          return cat ? `${cat.icon} ${cat.name}` : 'Select category'
                        })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRecategorizeOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkRecategorize}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog open={!!templateSourceTx} onOpenChange={(open) => { if (!open) { setTemplateSourceTx(null); setTemplateName('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />Save as Template
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplateConfirm() }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTemplateSourceTx(null); setTemplateName('') }}>Cancel</Button>
              <Button onClick={handleSaveTemplateConfirm} disabled={!templateName.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split transaction dialog */}
      {splittingTx && (
        <SplitTransactionDialog
          tx={splittingTx}
          open={!!splittingTx}
          onOpenChange={(open) => { if (!open) setSplittingTx(null) }}
          onConfirm={handleSplitConfirm}
        />
      )}

      {/* Import CSV dialog */}
      <ImportCSVDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

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
