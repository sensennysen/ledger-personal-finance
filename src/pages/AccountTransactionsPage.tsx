import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RepeatIcon, Search, Pencil, Trash2, Plus, CreditCard, Wallet, PiggyBank, Banknote, TrendingUp, Landmark, CircleDollarSign } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Transaction } from '@/types'

// Reuse form from TransactionsPage via dynamic import pattern — inline the form here
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCategories } from '@/hooks/useCategories'
import { CURRENCIES } from '@/types'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  digital_wallet: Wallet,
  credit_card: CreditCard,
  savings: PiggyBank,
  checking: Landmark,
  investment: TrendingUp,
  loan: CircleDollarSign,
  other: Wallet,
}

const schema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  to_account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  exchange_rate: z.coerce.number().default(1),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().nullable(),
  date: z.string().min(1),
  transfer_fee: z.coerce.number().min(0).nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).nullable(),
  recurrence_end_date: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

function TransactionForm({
  defaultValues,
  onSubmit,
  onClose,
  lockedAccountId,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
  lockedAccountId?: string
}) {
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: 'expense',
      account_id: lockedAccountId ?? accounts[0]?.id ?? '',
      to_account_id: null,
      category_id: null,
      amount: 0,
      currency: accounts.find((a) => a.id === lockedAccountId)?.currency ?? accounts[0]?.currency ?? 'USD',
      exchange_rate: 1,
      description: '',
      notes: null,
      date: today,
      transfer_fee: null,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      ...defaultValues,
    },
  })

  const type = form.watch('type')
  const isRecurring = form.watch('is_recurring')
  const selectedAccount = form.watch('account_id')

  const onAccountChange = (id: string | null) => {
    if (!id) return
    const acc = accounts.find((a) => a.id === id)
    if (acc) form.setValue('currency', acc.currency)
    form.setValue('account_id', id)
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Tabs
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  if (v !== 'transfer') form.setValue('to_account_id', null)
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="expense" className="flex-1">Expense</TabsTrigger>
                  <TabsTrigger value="income" className="flex-1">Income</TabsTrigger>
                  <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
                </TabsList>
              </Tabs>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => {
              const selectedAcc = accounts.find((a) => a.id === field.value)
              return (
                <FormItem>
                  <FormLabel>{type === 'transfer' ? 'From Account' : 'Account'}</FormLabel>
                  <Select
                    onValueChange={onAccountChange}
                    value={field.value}
                    disabled={!!lockedAccountId && type !== 'transfer'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account">
                          {selectedAcc ? selectedAcc.name : 'Select account'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          {type === 'transfer' ? (
            <FormField
              control={form.control}
              name="to_account_id"
              render={({ field }) => {
                const selectedToAcc = accounts.find((a) => a.id === field.value)
                return (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account">
                            {selectedToAcc ? selectedToAcc.name : 'Select account'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts
                          .filter((a) => a.id !== selectedAccount)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ) : (
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => {
                const selectedCat = categories.find((c) => c.id === field.value)
                return (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none' ? null : v)}
                      value={field.value ?? '__none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category">
                            {selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : 'Uncategorized'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">Uncategorized</SelectItem>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {type === 'transfer' && (
          <FormField
            control={form.control}
            name="transfer_fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer Fee (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Input placeholder="e.g. Grocery run" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_recurring"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel className="text-sm font-medium">Recurring transaction</FormLabel>
                <p className="text-xs text-muted-foreground">Repeat this transaction automatically</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {isRecurring && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="recurrence_interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interval</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none' ? null : v)}
                    value={field.value ?? '__none'}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recurrence_end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Transaction'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

const TYPE_ICON = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
}

const TYPE_COLOR = {
  income: 'text-[oklch(0.660_0.150_155)]',
  expense: 'text-[oklch(0.620_0.160_18)]',
  transfer: 'text-[oklch(0.700_0.115_72)]',
}

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

  const handleCreate = async (values: FormValues) => {
    await createTransaction(values as Parameters<typeof createTransaction>[0])
    refetchAccounts()
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editingTx) return
    await updateTransaction(editingTx.id, values as Parameters<typeof updateTransaction>[1])
    refetchAccounts()
    setEditingTx(null)
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
            <TransactionForm
              onSubmit={handleCreate}
              onClose={() => setCreateOpen(false)}
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
        <Card className="text-center py-16">
          <CardContent>
            <ArrowLeftRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm text-muted-foreground">
              {search || filterType !== 'all' ? 'Try adjusting your filters' : 'Add your first transaction for this account'}
            </p>
          </CardContent>
        </Card>
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
                  const TxIcon = TYPE_ICON[tx.type]
                  // For transfers, show direction relative to this account
                  const isIncoming = tx.type === 'transfer' && tx.to_account_id === accountId
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:bg-accent/50 transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                        style={tx.category ? { backgroundColor: tx.category.color + '20' } : { backgroundColor: '#f1f5f9' }}
                      >
                        {tx.category ? tx.category.icon : <TxIcon className={`w-4 h-4 ${TYPE_COLOR[tx.type]}`} />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className={`text-sm font-semibold shrink-0 ${
                            tx.type === 'income' || isIncoming
                              ? TYPE_COLOR.income
                              : tx.type === 'expense'
                              ? TYPE_COLOR.expense
                              : TYPE_COLOR.transfer
                          }`}>
                            {tx.type === 'income' || isIncoming ? '+' : tx.type === 'expense' ? '-' : ''}
                            {formatCurrency(
                              isIncoming ? tx.amount * (tx.exchange_rate ?? 1) : tx.amount,
                              tx.currency
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tx.type === 'transfer' && (
                              <span className="text-xs text-muted-foreground">
                                {isIncoming
                                  ? `← from ${tx.account?.name ?? ''}`
                                  : `→ to ${tx.to_account?.name ?? ''}`}
                              </span>
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
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0">{tx.currency}</p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingTx(tx)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>

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
                            <AlertDialogAction onClick={async () => { await deleteTransaction(tx.id); refetchAccounts() }}>Delete</AlertDialogAction>
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
