import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Search, Plus, Upload, CreditCard, Wallet, Pencil, MoreHorizontal } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { useAuth } from '@/contexts/AuthContext'
import { ACCOUNT_TYPE_LABELS } from '@/types'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils'
import { getCreditCardSpending, getCreditUtilizationPct, daysUntilDayOfMonth, normalizeCreditCardBalanceForStorage } from '@/lib/creditCards'
import { formatLoanSchedule, getLoanAmountOwed } from '@/lib/loans'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import { resolveLoadState } from '@/lib/loadState'
import { UndoToast } from '@/components/ui/undo-toast'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { defaultCardPaymentDescription } from '@/lib/cardPayment'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import { TRANSACTION_KIND_DIALOG_TITLES, type TransactionKind } from '@/components/transactions/transactionKinds'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { TransactionDayList, WindowFooter } from '@/components/transactions/TransactionDayList'
import { useRenderWindow } from '@/hooks/useRenderWindow'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { groupByDay, sliceGroups, WINDOW_STEP } from '@/lib/transactionWindow'
import { LoanPurchaseTracker } from '@/components/accounts/LoanPurchaseTracker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import { AccountForm, type AccountFormValues } from '@/components/accounts/AccountForm'
import type { CreditCardPayment, Transaction } from '@/types'

export default function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { accounts, error: accountsError, refetch: refetchAccounts, updateAccount, updateAccountWithAdjustment } = useAccounts()
  const { transactions, loading, error: txError, refetch: refetchTransactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

  const loadState = resolveLoadState({ loading, error: txError, hasData: transactions.length > 0 })
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [transactionKind, setTransactionKind] = useState<TransactionKind>('expense')
  const [editAccountOpen, setEditAccountOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(getLocalDateString)
  const [paymentFromAccountId, setPaymentFromAccountId] = useState<string | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<CreditCardPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [loanSection, setLoanSection] = useState<'summary' | 'purchases' | 'activity'>('summary')

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
  const loanData = useLoanPurchases(account?.type === 'loan' ? accountId : undefined, account?.type === 'loan')
  const paymentSourceAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card' && a.type !== 'loan' && a.id !== accountId),
    [accounts, accountId]
  )

  const loanPaymentSource = useMemo(
    () => paymentSourceAccounts.find((source) => source.currency === account?.currency) ?? null,
    [account?.currency, paymentSourceAccounts]
  )

  const loanSummary = useMemo(() => {
    const totalPayable = loanData.purchases.reduce((sum, purchase) => sum + purchase.total_payable, 0)
    const totalPaid = loanData.purchases.reduce((sum, purchase) => sum + (purchase.paid_amount ?? 0), 0)
    return {
      totalPayable,
      totalPaid,
      progress: totalPayable > 0 ? Math.min(100, (totalPaid / totalPayable) * 100) : 0,
      nextDeadline: loanData.deadlines[0] ?? null,
    }
  }, [loanData.deadlines, loanData.purchases])

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

  const clearAccountFilters = useCallback(() => {
    setFilterType('all')
    setSearch('')
  }, [])

  const grouped = useMemo(() => groupByDay(filtered, accountId), [filtered, accountId])

  // Window the list (LED-60); nets in the day headers are relative to this account.
  const compactList = useMediaQuery('(max-width: 767px)')
  const { rendered, sentinelRef } = useRenderWindow(filtered.length, {
    step: compactList ? WINDOW_STEP.mobile : WINDOW_STEP.desktop,
    resetKey: JSON.stringify([accountId, filterType, search]),
  })

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
        <Button variant="ghost" size="icon" aria-label="Back to accounts" onClick={() => navigate('/accounts')} className="shrink-0">
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
        {account?.type === 'loan' ? (
          <Button
            className="gap-2 shrink-0"
            onClick={() => {
              setTransactionKind('loan-repayment')
              setCreateOpen(true)
            }}
          >
            <Plus className="w-4 h-4" />Make payment
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
          {account?.type === 'credit_card' && (
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => {
                setFormError(null)
                setTransactionKind('card-payment')
                setCreateOpen(true)
              }}
            >
              <CreditCard className="w-4 h-4" />Pay card
            </Button>
          )}
          <TransactionKindMenu
            showCardPayment={account?.type !== 'credit_card'}
            showLoanRepayment={Boolean(
              account &&
              account.type !== 'credit_card' &&
              accounts.some((candidate) => candidate.type === 'loan' && candidate.currency === account.currency)
            )}
            onSelect={(kind) => {
              setFormError(null)
              setTransactionKind(kind)
              setCreateOpen(true)
            }}
            trigger={
              <Button className="gap-2 shrink-0">
                <Plus className="w-4 h-4" />Add
              </Button>
            }
          />
          </div>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
            <DialogHeader>
              <DialogTitle>
                {account?.type === 'loan' ? `Pay ${account.name}` : TRANSACTION_KIND_DIALOG_TITLES[transactionKind]}
              </DialogTitle>
            </DialogHeader>
            {formError && <FormError>{formError}</FormError>}
            <TransactionForm
              entryKind={account?.type === 'loan' ? 'loan-repayment' : transactionKind}
              onSubmit={handleCreate}
              onClose={() => { setCreateOpen(false); setFormError(null) }}
              lockedAccountId={account?.type === 'loan' || transactionKind === 'card-payment' ? undefined : accountId}
              lockedCardAccountId={
                account?.type === 'credit_card' && transactionKind === 'card-payment' ? account.id : undefined
              }
              lockedLoanAccountId={account?.type === 'loan' ? account.id : undefined}
              submitLabel={account?.type === 'loan' ? 'Record Payment' : 'Save Transaction'}
              defaultValues={account?.type === 'loan'
                ? {
                    type: 'expense',
                    account_id: loanPaymentSource?.id ?? '',
                    to_account_id: account.id,
                    category_id: null,
                    currency: account.currency,
                    description: `Loan payment - ${account.name}`,
                  }
                : account?.type === 'credit_card' && transactionKind === 'card-payment'
                  ? {
                      type: 'expense',
                      account_id: '',
                      to_account_id: account.id,
                      currency: account.currency,
                      description: defaultCardPaymentDescription(account.name),
                    }
                  : transactionKind === 'card-payment'
                    ? { account_id: accountId, type: 'expense' }
                    : { account_id: accountId }}
            />
            {account?.type === 'loan' && !loanPaymentSource && (
              <p className="text-xs text-muted-foreground">Add a cash, wallet, checking, or savings account in {account.currency} to record this payment.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {account?.type === 'loan' && (
        <Tabs value={loanSection} onValueChange={(value) => setLoanSection(value as typeof loanSection)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {accountsError && !account && (
        <InlineLoadError message="Couldn't load this account's details." onRetry={() => void refetchAccounts()} />
      )}

      {/* Account balance card */}
      {account && (account.type !== 'loan' || loanSection === 'summary') && (
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${account.color}dd, ${account.color}99)` }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium opacity-80">{account.type === 'loan' ? 'Outstanding Loan' : account.type === 'credit_card' ? 'Current Debt' : 'Current Balance'}</p>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account actions" className="h-8 w-8 rounded-full text-white hover:bg-black/15 hover:text-white" />}>
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
            {formatCurrency(account.type === 'credit_card' ? getCreditCardSpending(account) : account.type === 'loan' ? getLoanAmountOwed(account) : account.balance, account.currency)}
          </p>
          {account.type === 'loan' ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs opacity-70">Next payment</p>
                  <p className="font-semibold">
                    {loanSummary.nextDeadline
                      ? formatCurrency(loanSummary.nextDeadline.total, currency)
                      : 'No payment due'}
                  </p>
                  {loanSummary.nextDeadline && <p className="text-[0.6875rem] opacity-70">{formatDate(loanSummary.nextDeadline.dueDate)}</p>}
                </div>
                <div>
                  <p className="text-xs opacity-70">Repaid</p>
                  <p className="font-semibold">{formatCurrency(loanSummary.totalPaid, currency)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Financed purchases</p>
                  <p className="font-semibold">{loanData.purchases.length}</p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="opacity-70">Repayment progress</span>
                  <span className="font-semibold">{loanSummary.progress.toFixed(0)}%</span>
                </div>
                <Progress value={loanSummary.progress} className="bg-white/20 [&>div]:bg-white" />
              </div>
            </div>
          ) : account.type !== 'credit_card' ? (
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
          ) : null}
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
                  className={getCreditUtilizationPct(account) >= (account.utilization_target_pct ?? 30) ? '[&>div]:bg-expense' : '[&>div]:bg-income'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2">
                <Select
                  value={effectivePaymentFromAccountId ?? ''}
                  onValueChange={(value) => setPaymentFromAccountId(value)}
                >
                  <SelectTrigger className="bg-white/95 text-black">
                    <SelectValue>
                      {(value) => {
                        const account = paymentSourceAccounts.find(a => a.id === value);
                        return account ? (account.name && account.name !== account.id ? account.name : 'Unnamed Account') : 'Pay from account';
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {paymentSourceAccounts.map((source) => (
                      <SelectItem key={source.id} value={source.id}>{source.name && source.name !== source.id ? source.name : 'Unnamed Account'}</SelectItem>
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
          {account.type === 'loan' && formatLoanSchedule(account) && (
            <div className="mt-4 rounded-lg bg-black/15 border border-white/20 p-3">
              <p className="text-xs opacity-70">Repayment schedule</p>
              <p className="text-sm font-semibold mt-0.5">{formatLoanSchedule(account)}</p>
              <p className="text-xs opacity-70 mt-1">Loan debt is subtracted from net worth.</p>
            </div>
          )}
        </div>
      )}

      {account?.type === 'loan' && loanSection === 'purchases' && (
        <LoanPurchaseTracker account={account} onAccountChanged={refetchAccounts} loanData={loanData} />
      )}

      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {formError && <FormError>{formError}</FormError>}
          {account && (
            <AccountForm
              account={account}
              onSubmit={handleAccountEdit}
              onClose={() => { setEditAccountOpen(false); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      {(account?.type !== 'loan' || loanSection === 'activity') && <div className="flex flex-col sm:flex-row gap-2">
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
      </div>}

      {/* Transaction list */}
      {(account?.type !== 'loan' || loanSection === 'activity') && loadState === 'stale-error' && (
        <InlineLoadError message="Couldn't refresh your transactions. Showing what was last loaded." onRetry={() => void refetchTransactions()} />
      )}
      {(account?.type !== 'loan' || loanSection === 'activity') && (loadState === 'error' ? (
        <ErrorState title="Couldn't load your transactions" detail={txError} onRetry={() => void refetchTransactions()} />
      ) : loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : accountTransactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nothing recorded yet"
          description="Add your first transaction for this account"
          action={
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/transactions?import=1')}>
                <Upload className="w-3.5 h-3.5" />Import CSV
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => { setFormError(null); setTransactionKind('expense'); setCreateOpen(true) }}
              >
                <Plus className="w-3.5 h-3.5" />Add transaction
              </Button>
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={`No ${filterType === 'all' ? 'transactions' : filterType} matching your filters`}
          description={`${accountTransactions.length} transaction${accountTransactions.length === 1 ? '' : 's'} on this account`}
          action={
            <Button variant="outline" size="sm" onClick={clearAccountFilters}>
              Show all {accountTransactions.length}
            </Button>
          }
        />
      ) : (
        <div>
          <TransactionDayList
            groups={sliceGroups(grouped, rendered)}
            compact={compactList}
            renderRow={(tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onEdit={setEditingTx}
                onDelete={handleDelete}
                contextAccountId={accountId}
              />
            )}
          />
          <WindowFooter rendered={rendered} total={filtered.length} compact={compactList} sentinelRef={sentinelRef} />
        </div>
      ))}

      {/* Edit dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) { setEditingTx(null); setFormError(null) } }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          {formError && <FormError>{formError}</FormError>}
          {editingTx && (
            <TransactionForm
              isEditing
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
