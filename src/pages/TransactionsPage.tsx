import { useState, useMemo } from 'react'
import { Plus, Search, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { formatDate, getCustomMonthRange, getCurrentCycleMonthKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TransactionRow } from '@/components/transactions/TransactionRow'
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

  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

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
    return result
  }, [transactions, filterType, search, selectedMonth])

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
    const { error } = await deleteTransaction(id)
    if (error) console.error('Failed to delete transaction:', error)
  }

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const tx of filtered) {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />Add
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
            {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
            <TransactionForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
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
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description={search ? 'Try a different search' : 'Add your first transaction'}
        />
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
              onClose={() => setEditingTx(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
