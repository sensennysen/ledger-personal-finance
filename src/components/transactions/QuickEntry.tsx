import { editEntryAmount } from '@/lib/entryAmount'
import { useState } from 'react'
import { Delete, ChevronDown } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TransactionForm, type TransactionFormValues } from './TransactionForm'
import { transactionSchema } from './transactionFormSchema'
import { getCurrencySymbol, getLocalDateString, cn } from '@/lib/utils'
import type { TransactionKind } from './transactionKinds'

export function QuickEntry({
  initialKind,
  onSubmit,
  onClose,
}: {
  initialKind: TransactionKind
  onSubmit: (values: TransactionFormValues) => Promise<void>
  onClose: () => void
}) {
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { transactions } = useTransactions()
  const { user } = useAuth()
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    initialKind === 'loan-repayment' || initialKind === 'card-payment' ? 'expense' : initialKind,
  )
  const [amount, setAmount] = useState('0')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState(() => {
    try {
      return localStorage.getItem(`ledger-last-account:${user?.id}`) ?? ''
    } catch {
      return ''
    }
  })
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(getLocalDateString)
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [fullForm, setFullForm] = useState(initialKind === 'loan-repayment' || initialKind === 'card-payment')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const account =
    accounts.find((a) => a.id === accountId) ??
    accounts.find((a) => a.type !== 'loan')
  const category = categories.find((c) => c.id === categoryId)
  const frequent = categories
    .filter((c) => c.type === type || c.type === 'both')
    .sort(
      (a, b) =>
        transactions.filter((t) => t.category_id === b.id).length -
        transactions.filter((t) => t.category_id === a.id).length,
    )
    .slice(0, 5)
  const values = {
    type,
    amount: Number(amount),
    account_id: account?.id ?? '',
    to_account_id: type === 'transfer' ? destination || null : null,
    category_id: type === 'transfer' ? null : categoryId,
    subcategory_id: null,
    currency: account?.currency ?? 'USD',
    exchange_rate: 1,
    // The card-payment form prefills "Card payment - {card}" only when this is empty.
    description:
      note ||
      category?.name ||
      (initialKind === 'card-payment'
        ? ''
        : type === 'transfer'
        ? 'Transfer'
        : type === 'income'
          ? 'Income'
          : 'Expense'),
    notes: note || null,
    date,
    transfer_fee: null,
    is_recurring: false,
    recurrence_interval: null,
    recurrence_end_date: null,
    receipt_url: null,
    tags: [],
    goal_id: null,
  }
  if (fullForm)
    return (
      <TransactionForm
        entryKind={initialKind === 'loan-repayment' || initialKind === 'card-payment' ? initialKind : type}
        defaultValues={values}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    )
  const key = (digit: string) =>
    setAmount((previous) => editEntryAmount(previous, digit))
  const save = async () => {
    const parsed = transactionSchema.safeParse(values)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    if (type === 'transfer' && destination === account?.id) {
      setError('Choose a different destination account')
      return
    }
    if (
      type === 'transfer' &&
      accounts.find((a) => a.id === destination)?.currency !== account?.currency
    ) {
      setFullForm(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(parsed.data)
      try {
        localStorage.setItem(
          `ledger-last-account:${user?.id}`,
          account?.id ?? '',
        )
      } catch {
        /* optional preference */
      }
    } catch {
      setError('Unable to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-4">
      <div
        className="flex rounded-full border border-input overflow-hidden"
        aria-label="Transaction type"
      >
        {(['expense', 'income', 'transfer'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={type === kind}
            onClick={() => {
              setType(kind)
              setCategoryId(null)
            }}
            className={cn(
              'h-11 flex-1 text-sm capitalize',
              type === kind
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground',
            )}
          >
            {kind}
          </button>
        ))}
      </div>
      <div
        className="text-center py-2 overflow-x-auto"
        style={{ color: `var(--${type})` }}
      >
        <span className="text-lg mr-2">
          {getCurrencySymbol(values.currency)}
        </span>
        <output
          aria-label="Amount"
          className="money text-[52px] leading-[58px]"
        >
          {amount}
        </output>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'].map(
          (digit) => (
            <button
              type="button"
              key={digit}
              aria-label={digit === 'delete' ? 'Delete digit' : digit}
              disabled={saving}
              onClick={() => key(digit)}
              className="h-12 rounded-full text-2xl hover:bg-accent active:bg-accent transition-colors flex items-center justify-center"
            >
              {digit === 'delete' ? <Delete className="size-5" /> : digit}
            </button>
          ),
        )}
      </div>
      {type !== 'transfer' && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Frequent categories"
        >
          {frequent.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'shrink-0 rounded-lg px-3 h-10 text-xs border',
                categoryId === c.id
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'border-input',
              )}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      )}
      {type === 'transfer' && (
        <label className="block text-xs space-y-1">
          To account
          <select
            aria-label="Destination account"
            className="w-full h-12 rounded-xl border border-input bg-card px-3"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Choose destination</option>
            {accounts
              .filter((a) => a.id !== account?.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
          </select>
        </label>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full h-11 text-sm text-muted-foreground"
      >
        <span>More details · {account?.name ?? 'Choose account'}</span>
        <ChevronDown className="size-4" />
      </button>
      {expanded && (
        <div className="space-y-3">
          <label className="block text-xs">
            Account
            <select
              aria-label="Account"
              className="w-full h-12 rounded-xl border border-input bg-card px-3 mt-1"
              value={account?.id ?? ''}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Date
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            Note
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was it for?"
            />
          </label>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setFullForm(true)}
          >
            All fields, receipts & recurring
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      )}
      {!account && (
        <p className="text-sm text-muted-foreground">
          Create an account before adding an entry.
        </p>
      )}
      <Button
        className="w-full h-12"
        disabled={saving || !account || Number(amount) <= 0}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : 'Save ' + type}
      </Button>
    </div>
  )
}
