import { useState, useMemo } from 'react'
import { Plus, Search, Trash2, Pencil, ArrowLeftRight, RepeatIcon } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TRANSACTION_TYPE_ICON, TRANSACTION_TYPE_COLOR } from '@/constants/accounts'
import type { Transaction } from '@/types'

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

  const filtered = useMemo(() => {
    let result = transactions
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
  }, [transactions, filterType, search])

  const handleCreate = async (values: TransactionFormValues) => {
    await createTransaction(values as Parameters<typeof createTransaction>[0])
    setCreateOpen(false)
  }

  const handleEdit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    await updateTransaction(editingTx.id, values as Parameters<typeof updateTransaction>[1])
    setEditingTx(null)
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />Add
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
            <TransactionForm onSubmit={handleCreate} onClose={() => setCreateOpen(false)} />
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
                {txs.map((tx) => {
                  const Icon = TRANSACTION_TYPE_ICON[tx.type]
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:bg-accent/50 transition-colors group"
                    >
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
                          <p className={`text-sm font-semibold shrink-0 ${TRANSACTION_TYPE_COLOR[tx.type]}`}>
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                            {formatCurrency(tx.amount, tx.currency)}
                          </p>
                        </div>
                        {/* Row 2: labels | currency */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tx.account && (
                              <span className="text-xs text-muted-foreground">{tx.account.name}</span>
                            )}
                            {tx.type === 'transfer' && tx.to_account && (
                              <span className="text-xs text-muted-foreground">→ {tx.to_account.name}</span>
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
                              <span className="text-xs text-muted-foreground">Fee: {formatCurrency(tx.transfer_fee, tx.currency)}</span>
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
                        onClick={() => setEditingTx(tx)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>

                      {/* Delete */}
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" />}>
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
                            <AlertDialogAction onClick={() => deleteTransaction(tx.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) setEditingTx(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
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
