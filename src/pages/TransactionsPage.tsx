import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RepeatIcon } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { CURRENCIES } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import type { Transaction } from '@/types'

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
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).nullable(),
  recurrence_end_date: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

function TransactionForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
}) {
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: 'expense',
      account_id: accounts[0]?.id ?? '',
      to_account_id: null,
      category_id: null,
      amount: 0,
      currency: accounts[0]?.currency ?? 'USD',
      exchange_rate: 1,
      description: '',
      notes: null,
      date: today,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      ...defaultValues,
    },
  })

  const type = form.watch('type')
  const isRecurring = form.watch('is_recurring')
  const selectedAccount = form.watch('account_id')

  // Auto-set currency from account
  const onAccountChange = (id: string | null) => {
    if (!id) return
    const acc = accounts.find((a) => a.id === id)
    if (acc) form.setValue('currency', acc.currency)
    form.setValue('account_id', id)
  }

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  )

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
            render={({ field }) => (
              <FormItem>
                <FormLabel>{type === 'transfer' ? 'From Account' : 'Account'}</FormLabel>
                <Select onValueChange={onAccountChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {type === 'transfer' ? (
            <FormField
              control={form.control}
              name="to_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
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
              )}
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
  income: 'text-green-600',
  expense: 'text-red-500',
  transfer: 'text-blue-500',
}

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { transactions, loading, createTransaction, deleteTransaction } = useTransactions()

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

  const handleCreate = async (values: FormValues) => {
    await createTransaction(values as Parameters<typeof createTransaction>[0])
    setCreateOpen(false)
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
        <Card className="text-center py-16">
          <CardContent>
            <ArrowLeftRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try a different search' : 'Add your first transaction'}
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
                  const Icon = TYPE_ICON[tx.type]
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:bg-accent/50 transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                        style={tx.category ? { backgroundColor: tx.category.color + '20' } : { backgroundColor: '#f1f5f9' }}
                      >
                        {tx.category ? tx.category.icon : <Icon className={`w-4 h-4 ${TYPE_COLOR[tx.type]}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
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
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${TYPE_COLOR[tx.type]}`}>
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">{tx.currency}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0" />}>
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
    </div>
  )
}
