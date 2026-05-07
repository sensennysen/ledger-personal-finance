import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Search, Plus, Wallet, Pencil, MoreHorizontal } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { ACCOUNT_COLORS, ACCOUNT_TYPE_LABELS, CURRENCIES } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getCreditCardSpending, getCreditUtilizationPct, daysUntilDayOfMonth, normalizeCreditCardBalanceForStorage } from '@/lib/creditCards'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { UndoToast } from '@/components/ui/undo-toast'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { ColorPicker } from '@/components/ui/color-picker'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import { DEFAULT_CURRENCY } from '@/constants/accounts'
import type { Account, AccountType, CreditCardPayment, Transaction } from '@/types'

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['cash', 'digital_wallet', 'credit_card', 'savings', 'checking', 'investment', 'loan', 'other']),
  currency: z.string().min(1),
  balance: z.coerce.number(),
  color: z.string(),
  credit_limit: z.coerce.number().nullable(),
  statement_day: z.coerce.number().int().min(1).max(31).nullable(),
  due_day: z.coerce.number().int().min(1).max(31).nullable(),
  utilization_target_pct: z.coerce.number().min(1).max(100).nullable(),
  payment_reminder_days: z.coerce.number().int().min(0).max(30).nullable(),
  notes: z.string().nullable(),
})

type AccountFormValues = z.infer<typeof accountSchema>

function EditAccountForm({
  account,
  onSubmit,
  onClose,
}: {
  account: Account
  onSubmit: (values: AccountFormValues) => Promise<void>
  onClose: () => void
}) {
  // This form is used as a "template" with fairly loose typing from react-hook-form/zodResolver,
  // and Cursor's current TS/ESLint config tends to over-warn on the explicit generic types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<AccountFormValues, any, AccountFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as any,
    defaultValues: {
      ...account,
      balance: account.type === 'credit_card' ? getCreditCardSpending(account) : account.balance,
      currency: account.currency || DEFAULT_CURRENCY,
      utilization_target_pct: account.utilization_target_pct ?? 30,
      payment_reminder_days: account.payment_reminder_days ?? 3,
    },
  })

  const type = form.watch('type')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl><Input placeholder="e.g. My Savings" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ? ACCOUNT_TYPE_LABELS[v as AccountType] : 'Select type'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ?? 'Select currency'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{type === 'credit_card' ? 'Current Debt' : 'Current Balance'}</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
              <FormMessage />
              {type === 'credit_card' && (
                <p className="text-xs text-muted-foreground">
                  Enter the amount owed. It will reduce net worth instead of increasing total assets.
                </p>
              )}
            </FormItem>
          )}
        />
        {type === 'credit_card' && (
          <div className="space-y-4 rounded-lg border border-border/60 p-3">
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="statement_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statement Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="utilization_target_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Utilization Target %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_reminder_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remind Days Before Due</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  palette={ACCOUNT_COLORS}
                />
              </FormControl>
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
                  placeholder="Any notes about this account..."
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Account'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { accounts, refetch: refetchAccounts, updateAccount, updateAccountWithAdjustment } = useAccounts()
  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccountOpen, setEditAccountOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentFromAccountId, setPaymentFromAccountId] = useState<string | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<CreditCardPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

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
  const paymentSourceAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card' && a.id !== accountId),
    [accounts, accountId]
  )

  const effectivePaymentFromAccountId = useMemo(() => {
    if (!paymentSourceAccounts.length) return null
    if (paymentFromAccountId && paymentSourceAccounts.some((a) => a.id === paymentFromAccountId)) {
      return paymentFromAccountId
    }
    return paymentSourceAccounts[0].id
  }, [paymentSourceAccounts, paymentFromAccountId])

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
  const statementDays = account?.type === 'credit_card' ? daysUntilDayOfMonth(account.statement_day) : null
  const dueDays = account?.type === 'credit_card' ? daysUntilDayOfMonth(account.due_day) : null

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

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!user || !accountId || account?.type !== 'credit_card') {
        setPaymentHistory([])
        return
      }

      setPaymentsLoading(true)
      const { data, error } = await supabase
        .from('credit_card_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        setFormError(error.message)
      } else {
        setPaymentHistory((data as CreditCardPayment[]) ?? [])
      }
      setPaymentsLoading(false)
    }

    fetchPaymentHistory()
  }, [user, accountId, account?.type])

  const handleLogPayment = async () => {
    if (!account || account.type !== 'credit_card' || !user) return
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0 || !effectivePaymentFromAccountId) return

    const { error: transferError } = await createTransaction({
      type: 'transfer',
      account_id: effectivePaymentFromAccountId,
      to_account_id: account.id,
      category_id: null,
      subcategory_id: null,
      amount,
      currency: account.currency,
      exchange_rate: 1,
      description: `Credit card payment - ${account.name}`,
      notes: null,
      date: paymentDate,
      transfer_fee: null,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      receipt_url: null,
      tags: [],
      goal_id: null,
    })
    if (transferError) {
      setFormError(transferError)
      return
    }

    const amountToPay = account.statement_balance ?? 0
    const currentPaid = account.statement_paid_amount ?? 0
    const nextPaid = Math.min(currentPaid + amount, amountToPay)

    const { data: insertedPayment, error: insertError } = await supabase
      .from('credit_card_payments')
      .insert({
        user_id: user.id,
        account_id: account.id,
        amount,
        payment_date: paymentDate,
      })
      .select('*')
      .single()
    if (insertError) {
      setFormError(insertError.message)
      return
    }

    const { error } = await updateAccount(account.id, {
      statement_paid_amount: nextPaid,
      last_payment_amount: amount,
      last_payment_date: paymentDate,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setPaymentAmount('')
    setPaymentHistory((prev) => [insertedPayment as CreditCardPayment, ...prev])
    refetchAccounts()
  }

  const handleAccountEdit = async (values: AccountFormValues) => {
    if (!account) return
    const { error } = await updateAccountWithAdjustment(account.id, normalizeCreditCardBalanceForStorage(values), account.balance)
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setEditAccountOpen(false)
    refetchAccounts()
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
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium opacity-80">{account.type === 'credit_card' ? 'Current Debt' : 'Current Balance'}</p>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-black/15 hover:text-white" />}>
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditAccountOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="money text-3xl font-bold mt-1">
            {formatCurrency(account.type === 'credit_card' ? getCreditCardSpending(account) : account.balance, account.currency)}
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
          {account.type === 'credit_card' && (
            <div className="mt-4 rounded-lg bg-black/15 border border-white/20 p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="opacity-70">Credit Limit</p>
                  <p className="font-semibold">{formatCurrency(account.credit_limit ?? 0, currency)}</p>
                </div>
                <div>
                  <p className="opacity-70">Current Spending</p>
                  <p className="font-semibold">{formatCurrency(getCreditCardSpending(account), currency)}</p>
                </div>
                <div>
                  <p className="opacity-70">Statement Balance</p>
                  <p className="font-semibold">{formatCurrency(account.statement_balance ?? 0, currency)}</p>
                </div>
                <div>
                  <p className="opacity-70">Remaining to Pay</p>
                  <p className="font-semibold">
                    {formatCurrency(Math.max((account.statement_balance ?? 0) - (account.statement_paid_amount ?? 0), 0), currency)}
                  </p>
                </div>
                <div>
                  <p className="opacity-70">Statement Date</p>
                  <p className="font-semibold">
                    {account.statement_day
                      ? `Day ${account.statement_day}${statementDays !== null ? ` (${statementDays === 0 ? 'today' : `in ${statementDays} ${statementDays === 1 ? 'day' : 'days'}`})` : ''}`
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="opacity-70">Due Date</p>
                  <p className="font-semibold">
                    {account.due_day
                      ? `Day ${account.due_day}${dueDays !== null ? ` (${dueDays === 0 ? 'today' : `in ${dueDays} ${dueDays === 1 ? 'day' : 'days'}`})` : ''}`
                      : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <p className="opacity-70">Utilization</p>
                  <p className="font-semibold">
                    {getCreditUtilizationPct(account).toFixed(1)}% / target {(account.utilization_target_pct ?? 30)}%
                  </p>
                </div>
                <Progress
                  value={Math.min(getCreditUtilizationPct(account), 100)}
                  className={getCreditUtilizationPct(account) >= (account.utilization_target_pct ?? 30) ? '[&>div]:bg-[oklch(0.620_0.160_18)]' : '[&>div]:bg-[oklch(0.660_0.150_155)]'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2">
                <Select
                  value={effectivePaymentFromAccountId ?? ''}
                  onValueChange={(value) => setPaymentFromAccountId(value)}
                >
                  <SelectTrigger className="bg-white/95 text-black">
                    <SelectValue placeholder="Pay from account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentSourceAccounts.map((source) => (
                      <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Payment amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-white/95 text-black"
                />
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-white/95 text-black"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLogPayment}
                  disabled={!effectivePaymentFromAccountId}
                >
                  Log Payment
                </Button>
              </div>
              {paymentSourceAccounts.length === 0 && (
                <p className="text-[0.6875rem] opacity-80">
                  Add a cash, bank, or wallet account to record credit card payments correctly.
                </p>
              )}
              {account.last_payment_date && account.last_payment_amount != null && (
                <p className="text-[0.6875rem] opacity-80">
                  Last payment: {formatCurrency(account.last_payment_amount, currency)} on {account.last_payment_date}
                </p>
              )}
              <div className="pt-1 border-t border-white/20">
                <p className="text-[0.6875rem] uppercase tracking-wide opacity-70 mb-1.5">Payment History</p>
                {paymentsLoading ? (
                  <p className="text-[0.6875rem] opacity-70">Loading payment history...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-[0.6875rem] opacity-70">No logged payments yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[0.75rem]">
                        <span className="opacity-80">{p.payment_date}</span>
                        <span className="font-semibold">{formatCurrency(p.amount, currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          {account && (
            <EditAccountForm
              account={account}
              onSubmit={handleAccountEdit}
              onClose={() => { setEditAccountOpen(false); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

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
