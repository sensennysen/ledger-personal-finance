import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Search, Plus, Wallet } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { ACCOUNT_TYPE_LABELS } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { UndoToast } from '@/components/ui/undo-toast'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import type { Transaction } from '@/types'

export default function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { accounts, refetch: refetchAccounts } = useAccounts()
  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Undo delete
  type UndoState = { snapshots: Transaction[]; message: string }
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    refetchAccounts()
  }, [undoState, createTransaction, refetchAccounts])

  const account = accounts.find((a) => a.id === accountId)
  const Icon = account ? ACCOUNT_ICONS[account.type] : Wallet

  // Filter to only transactions involving this account (source or destination)
  const accountTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.account_id === accountId || t.to_account_id === accountId
    )
  }, [transactions, accountId])

  const filtered = useMemo(() => {
    let result = accountTransactions
    if (filterType !== 'all') result = result.filter((t) => t.type === filterType)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category?.name.toLowerCase().includes(q)
      )
    }
    return result
  }, [accountTransactions, filterType, search])

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const tx of filtered) {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  // Summary stats for this account's transactions
  const stats = useMemo(() => {
    const income = accountTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = accountTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    // Outgoing transfers debit amount + fee; incoming transfers credit amount * exchange_rate
    const transfersSent = accountTransactions
      .filter((t) => t.type === 'transfer' && t.account_id === accountId)
      .reduce((s, t) => s + t.amount + (t.transfer_fee ?? 0), 0)
    const transfersReceived = accountTransactions
      .filter((t) => t.type === 'transfer' && t.to_account_id === accountId)
      .reduce((s, t) => s + t.amount * (t.exchange_rate ?? 1), 0)
    return { income, expenses, transfersSent, transfersReceived }
  }, [accountTransactions, accountId])

  const currency = account?.currency ?? profile?.default_currency ?? 'USD'

  const handleCreate = async (values: TransactionFormValues) => {
    const { error } = await createTransaction(values as Parameters<typeof createTransaction>[0])
    if (error) { setFormError(error); return }
    setFormError(null)
    refetchAccounts()
    setCreateOpen(false)
  }

  const handleEdit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    const { error } = await updateTransaction(editingTx.id, values as Parameters<typeof updateTransaction>[1])
    if (error) { setFormError(error); return }
    setFormError(null)
    refetchAccounts()
    setEditingTx(null)
  }

  const handleDelete = async (id: string) => {
    const snapshot = transactions.find((t) => t.id === id)
    const { error } = await deleteTransaction(id)
    if (error) { console.error('Failed to delete transaction:', error); return }
    refetchAccounts()
    if (snapshot) showUndo([snapshot], `"${snapshot.description}" deleted`)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        {account ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ backgroundColor: account.color + '20', color: account.color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{account.name}</h1>
              <p className="text-sm text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
            </div>
          </div>
        ) : (
          <h1 className="text-xl font-bold">Account Transactions</h1>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2 shrink-0" />}>
            <Plus className="w-4 h-4" />Add
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
            {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
            <TransactionForm
              onSubmit={handleCreate}
              onClose={() => { setCreateOpen(false); setFormError(null) }}
              lockedAccountId={accountId}
              defaultValues={{ account_id: accountId }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Account balance card */}
      {account && (
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${account.color}dd, ${account.color}99)` }}
        >
          <p className="text-sm font-medium opacity-80">Current Balance</p>
          <p className="money text-3xl font-bold mt-1">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <div className="flex gap-4 mt-3 text-sm opacity-90">
            <div>
              <p className="text-xs opacity-70">Income</p>
              <p className="font-semibold">+{formatCurrency(stats.income, currency)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Expenses</p>
              <p className="font-semibold">-{formatCurrency(stats.expenses, currency)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Sent</p>
              <p className="font-semibold">-{formatCurrency(stats.transfersSent, currency)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Received</p>
              <p className="font-semibold">+{formatCurrency(stats.transfersReceived, currency)}</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description={search || filterType !== 'all' ? 'Try adjusting your filters' : 'Add your first transaction for this account'}
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
                    contextAccountId={accountId}
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
