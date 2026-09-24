import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, ChevronRight, Search, Plus, Upload, CreditCard, Wallet, Pencil } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/contexts/AuthContext'
import { useCycle } from '@/contexts/cycleState'
import { ACCOUNT_TYPE_LABELS } from '@/types'
import { formatCurrency, formatDate, formatDateShort, getCurrentCycleMonthKey, getCustomMonthRange, getLocalDateString } from '@/lib/utils'
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
import { searchMatcher } from '@/lib/globalSearch'
import { UndoToast } from '@/components/ui/undo-toast'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { defaultCardPaymentDescription } from '@/lib/cardPayment'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import { TRANSACTION_KIND_DIALOG_TITLES, type TransactionKind } from '@/components/transactions/transactionKinds'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { TransactionDayList, WindowFooter } from '@/components/transactions/TransactionDayList'
import { ResultBar, ResultBarLayout } from '@/components/transactions/ResultBar'
import { MonthJumpBar, MonthRail } from '@/components/transactions/MonthJump'
import { usePreferences } from '@/hooks/usePreferences'
import { useRenderWindow } from '@/hooks/useRenderWindow'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { dateSpan, groupByDay, sliceGroups, sumByCurrency, WINDOW_STEP, type TxSort } from '@/lib/transactionWindow'
import { buildMonthNets, monthJumpTarget } from '@/lib/monthJump'
import { cardAmountDue, loanProgress } from '@/lib/accountsOverview'
import { buildCategoryBreakdown } from '@/lib/categoryBreakdown'
import { LoanPurchaseTracker } from '@/components/accounts/LoanPurchaseTracker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import { AccountForm, type AccountFormValues } from '@/components/accounts/AccountForm'
import type { CreditCardPayment, Transaction } from '@/types'

function bandCell(label: string, value: string, sub?: string) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="money mt-1 truncate text-lg font-semibold">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function formatDueIn(days: number | null) {
  if (days === null) return ''
  if (days === 0) return 'today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

/** "Sep 16" for a day-of-month countdown. */
function dayInDaysLabel(days: number | null) {
  if (days === null) return 'Not set'
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AccountTransactionsPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { accounts, error: accountsError, refetch: refetchAccounts, updateAccount, updateAccountWithAdjustment } = useAccounts()
  const { categories } = useCategories()
  const { transactions, loading, error: txError, refetch: refetchTransactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions()

  const loadState = resolveLoadState({ loading, error: txError, hasData: transactions.length > 0 })
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  // Search handoff (LED-64): "See all" from the palette arrives as ?q=. Take it
  // while rendering, clear filters that would hide matches, then drop the param.
  const handoffQuery = searchParams.get('q')
  const [takenQuery, setTakenQuery] = useState<string | null>(null)
  if (handoffQuery !== takenQuery) {
    setTakenQuery(handoffQuery)
    if (handoffQuery !== null) {
      setSearch(handoffQuery)
      setFilterType('all')
    }
  }
  useEffect(() => {
    if (handoffQuery === null) return
    setSearchParams((params) => {
      params.delete('q')
      return params
    }, { replace: true })
  }, [handoffQuery, setSearchParams])
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

  const loanRepayment = loanProgress(loanData.purchases, loanData.allocations)
  const nextLoanDeadline = loanData.deadlines[0] ?? null

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
    // Same rule as the search palette, so its "See all" count matches (LED-64).
    if (search) result = result.filter(searchMatcher(search))
    return result
  }, [accountTransactions, filterType, search])

  const clearAccountFilters = useCallback(() => {
    setFilterType('all')
    setSearch('')
  }, [])

  const { prefs, set: setPref } = usePreferences()
  const [sort, setSort] = useState<TxSort>('newest')
  const grouped = useMemo(() => groupByDay(filtered, accountId, sort), [filtered, accountId, sort])

  // Window the list (LED-60); nets in the day headers are relative to this account.
  const compactList = useMediaQuery('(max-width: 767px)')
  const windowKey = (type: string, query: string) => JSON.stringify([accountId, type, query, sort])
  const { rendered, sentinelRef, ensure } = useRenderWindow(filtered.length, {
    step: compactList ? WINDOW_STEP.mobile : WINDOW_STEP.desktop,
    resetKey: windowKey(filterType, search),
  })

  // Month jump (LED-62). The account has no cycle, so a jump scrolls to the
  // month's first day group, growing the window until that group is rendered.
  const { startDay, selectedMonth } = useCycle()
  const months = useMemo(
    () => buildMonthNets(accountTransactions, { startDay, currentKey: getCurrentCycleMonthKey(startDay), contextAccountId: accountId }),
    [accountTransactions, startDay, accountId]
  )
  const scrollTargetRef = useRef<string | null>(null)
  const [jumpCount, setJumpCount] = useState(0)
  const jumpToMonth = (key: string) => {
    const range = getCustomMonthRange(key, startDay)
    let target = monthJumpTarget(grouped, range)
    let nextWindowKey: string | undefined
    if (!target && (filterType !== 'all' || search !== '')) {
      // The rail counts the whole history; if filters hide the month, clear them.
      target = monthJumpTarget(groupByDay(accountTransactions, accountId, sort), range)
      if (target) {
        clearAccountFilters()
        nextWindowKey = windowKey('all', '')
      }
    }
    if (!target) return
    ensure(target.rowsThrough, nextWindowKey)
    scrollTargetRef.current = target.date
    setJumpCount((n) => n + 1)
  }
  // Scrolls once the target day is rendered; the window may need a render to grow first.
  useEffect(() => {
    const day = scrollTargetRef.current
    if (!day) return
    const node = document.querySelector(`[data-day="${day}"]`)
    if (!node) return
    scrollTargetRef.current = null
    node.scrollIntoView({ block: 'start' })
  }, [jumpCount, rendered, grouped])

  // Result bar (LED-61): the sum is relative to this account, the range spans its history.
  const matchSum = useMemo(() => sumByCurrency(filtered, accountId), [filtered, accountId])
  const historyRange = useMemo(() => {
    const span = dateSpan(accountTransactions)
    if (!span) return null
    const month = (value: string) =>
      new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    const start = month(span.start)
    const end = month(span.end)
    return start === end ? start : `${start} – ${end}`
  }, [accountTransactions])

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
  // "Where it went" (LED-98): this cycle's spending from this account, by category.
  const cycleRange = getCustomMonthRange(selectedMonth, startDay)
  const cycleLabel = `${formatDateShort(cycleRange.start)} – ${formatDateShort(cycleRange.end)}`
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const cycleBreakdown = buildCategoryBreakdown(
    accountTransactions.filter((t) => t.type === 'expense' && t.account_id === accountId && t.date >= cycleRange.start && t.date <= cycleRange.end),
    categoryById,
  )
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

  const showMonthJump =
    (account?.type !== 'loan' || loanSection === 'activity') &&
    (loadState === 'ready' || loadState === 'stale-error') &&
    months.length > 0

  return (
    <div className="flex justify-center gap-6 lg:pr-6">
      <div className="p-4 md:p-6 space-y-4 max-w-3xl lg:max-w-6xl mx-auto min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/accounts" className="rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring">Accounts</Link>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          <span aria-current="page" className="truncate text-foreground">{account?.name ?? 'Account'}</span>
        </nav>
        {/* Header */}
        <div className="flex items-center gap-3">
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
            <h1 className="text-xl font-bold flex-1">Account Transactions</h1>
          )}
          {account && (
            <Button variant="outline" className="hidden gap-2 shrink-0 sm:inline-flex" onClick={() => setEditAccountOpen(true)}>
              <Pencil className="w-4 h-4" />Edit account
            </Button>
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

        {/* Key figures (LED-98): one ruled band instead of stacked cards */}
        {account && (account.type !== 'loan' || loanSection === 'summary') && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-2 lg:grid-cols-4 [&>div]:border-border/60 [&>div]:p-4 [&>div:nth-child(odd)]:border-r [&>div:nth-child(-n+2)]:border-b lg:[&>div]:border-b-0 lg:[&>div:not(:last-child)]:border-r">
              {account.type === 'credit_card' ? (
                <>
                  {bandCell('Current balance', formatCurrency(getCreditCardSpending(account), currency), account.balance < 0 ? 'owed' : 'nothing owed')}
                  {bandCell(
                    'Credit limit',
                    account.credit_limit != null ? formatCurrency(account.credit_limit, currency) : 'Not set',
                    account.credit_limit ? `${getCreditUtilizationPct(account).toFixed(0)}% used` : 'Add one to track utilisation',
                  )}
                  {bandCell('Statement closes', account.statement_day ? dayInDaysLabel(statementDays) : 'Not set', account.statement_day ? formatDueIn(statementDays) : 'No countdown')}
                  {bandCell('Payment due', account.due_day ? dayInDaysLabel(dueDays) : 'Not set', account.due_day ? formatDueIn(dueDays) : 'No countdown')}
                </>
              ) : account.type === 'loan' ? (
                <>
                  {bandCell('Outstanding', formatCurrency(getLoanAmountOwed(account), currency), 'owed')}
                  {bandCell(
                    'Repaid',
                    formatCurrency(loanRepayment?.totalPaid ?? 0, currency),
                    loanRepayment ? `${loanRepayment.paidInstallments} of ${loanRepayment.totalInstallments} installments` : 'No financed purchases',
                  )}
                  {bandCell(
                    'Next payment',
                    nextLoanDeadline ? formatCurrency(nextLoanDeadline.total, currency) : 'None due',
                    nextLoanDeadline ? formatDate(nextLoanDeadline.dueDate) : undefined,
                  )}
                  {bandCell('Schedule', formatLoanSchedule(account) ?? 'Per purchase', 'Subtracted from net worth')}
                </>
              ) : (
                <>
                  {bandCell('Current balance', formatCurrency(account.balance, currency))}
                  {bandCell('Income', `+${formatCurrency(stats.income, currency)}`)}
                  {bandCell('Expenses', `−${formatCurrency(stats.expenses, currency)}`)}
                  {bandCell('Transfers', `−${formatCurrency(stats.transfersSent, currency)}`, `+${formatCurrency(stats.transfersReceived, currency)} received`)}
                </>
              )}
            </div>
            {account.type === 'credit_card' && account.credit_limit ? (
              <div className="space-y-1.5 border-t border-border/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilisation</span>
                  <span className="money">
                    {formatCurrency(getCreditCardSpending(account), currency)} of {formatCurrency(account.credit_limit, currency)} · target {account.utilization_target_pct ?? 30}%
                  </span>
                </div>
                <Progress
                  value={Math.min(getCreditUtilizationPct(account), 100)}
                  aria-label="Credit utilisation"
                  className={getCreditUtilizationPct(account) >= (account.utilization_target_pct ?? 30) ? '[&_[data-slot=progress-indicator]]:bg-expense' : '[&_[data-slot=progress-indicator]]:bg-income'}
                />
              </div>
            ) : account.type === 'loan' && loanRepayment ? (
              <div className="space-y-1.5 border-t border-border/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Repayment progress</span>
                  <span className="font-semibold">{loanRepayment.pct.toFixed(0)}%</span>
                </div>
                <Progress value={loanRepayment.pct} aria-label="Repayment progress" />
              </div>
            ) : null}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {account && (
          <aside className="space-y-4 lg:col-start-2 lg:row-start-1" aria-label="Account summary">
            {account.type === 'credit_card' && (
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Pay this card</h2>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Amount to pay</span>
                  <span className="money text-lg font-bold">{formatCurrency(cardAmountDue(account), currency)}</span>
                </div>
                {account.statement_balance != null && (
                  <p className="text-xs text-muted-foreground">
                    Statement {formatCurrency(account.statement_balance, currency)}, paid {formatCurrency(account.statement_paid_amount ?? 0, currency)}
                  </p>
                )}
                <div className="grid gap-2">
                  <Select
                    value={effectivePaymentFromAccountId ?? ''}
                    onValueChange={(value) => setPaymentFromAccountId(value)}
                  >
                    <SelectTrigger aria-label="Pay from account">
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
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      aria-label="Payment amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                    <Input
                      type="date"
                      aria-label="Payment date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleLogPayment}
                    disabled={!effectivePaymentFromAccountId}
                  >
                    Record payment
                  </Button>
                </div>
                {paymentSourceAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add a cash, bank, or wallet account to record credit card payments correctly.
                  </p>
                )}
                {account.last_payment_date && account.last_payment_amount != null && (
                  <p className="text-xs text-muted-foreground">
                    Last payment: {formatCurrency(account.last_payment_amount, currency)} on {account.last_payment_date}
                  </p>
                )}
                <div className="border-t border-border/60 pt-2">
                  <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground mb-1.5">Payment history</p>
                  {paymentsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading payment history...</p>
                  ) : paymentHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No logged payments yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {paymentHistory.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{p.payment_date}</span>
                          <span className="money font-semibold">{formatCurrency(p.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
            {account.type === 'loan' && (
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Next payment</h2>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">{nextLoanDeadline ? formatDate(nextLoanDeadline.dueDate) : 'Nothing scheduled'}</span>
                  <span className="money text-lg font-bold">{formatCurrency(nextLoanDeadline?.total ?? 0, currency)}</span>
                </div>
                <Button className="w-full" onClick={() => { setTransactionKind('loan-repayment'); setCreateOpen(true) }}>
                  Make payment
                </Button>
              </section>
            )}
            {account.type !== 'loan' && (
              <section className="space-y-2 rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Where it went</h2>
                <p className="text-xs text-muted-foreground">Spending from this account in {cycleLabel}</p>
                {cycleBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No spending this cycle.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cycleBreakdown.slice(0, 4).map((slice) => (
                      <li key={slice.key} className="flex items-center gap-2 text-sm">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                        <span className="money shrink-0 font-medium">{formatCurrency(slice.amount, currency)}</span>
                      </li>
                    ))}
                    {cycleBreakdown.length > 4 && (
                      <li className="text-xs text-muted-foreground">+{cycleBreakdown.length - 4} more categories</li>
                    )}
                  </ul>
                )}
              </section>
            )}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">Account</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Type</dt><dd className="text-right">{ACCOUNT_TYPE_LABELS[account.type]}</dd>
                {account.type === 'credit_card' && (
                  <>
                    <dt className="text-muted-foreground">Statement day</dt><dd className="text-right">{account.statement_day ?? 'Not set'}</dd>
                    <dt className="text-muted-foreground">Due day</dt><dd className="text-right">{account.due_day ?? 'Not set'}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Currency</dt><dd className="text-right">{account.currency}</dd>
              </dl>
              <Button variant="ghost" size="sm" className="mt-2 w-full gap-2 sm:hidden" onClick={() => setEditAccountOpen(true)}>
                <Pencil className="w-3.5 h-3.5" />Edit account
              </Button>
            </section>
          </aside>
        )}
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
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
        ) : loadState === 'loading' ? (
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
          <ResultBarLayout
            bar={
              <ResultBar
                matchCount={filtered.length}
                total={accountTransactions.length}
                totalLabel="on this account"
                rangeLabel={historyRange}
                sum={matchSum}
                sort={sort}
                onSortChange={setSort}
                density={prefs.txDensity}
                onDensityChange={(density) => setPref('txDensity', density)}
                compact={compactList}
              />
            }
          >
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
                  dense={prefs.txDensity === 'compact'}
                />
              )}
            />
            <WindowFooter rendered={rendered} total={filtered.length} compact={compactList} sentinelRef={sentinelRef} />
          </ResultBarLayout>
        ))}
        </div>
        </div>

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

        {showMonthJump && <MonthJumpBar months={months} activeKey={null} onPick={jumpToMonth} />}
      </div>
      {showMonthJump && <MonthRail months={months} activeKey={null} onPick={jumpToMonth} />}
    </div>
  )
}
