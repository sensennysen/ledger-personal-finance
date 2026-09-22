import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Landmark,
  PiggyBank,
  Receipt,
  Settings,
  Upload,
  Tag,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { InlineLoadError } from '@/components/ui/error-state'
import { useEntryDetail } from '@/contexts/EntryContext'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'
import { DESTINATIONS, type SearchAction, type SearchScope } from '@/lib/globalSearch'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import type { Transaction } from '@/types'

const ACTIONS: (SearchAction & { kind: TransactionKind; icon: typeof ArrowUpRight })[] = [
  { id: 'expense', kind: 'expense', label: 'New expense', keywords: ['add', 'spend', 'record'], key: 'E', icon: ArrowUpRight },
  { id: 'income', kind: 'income', label: 'New income', keywords: ['add', 'earn', 'record'], key: 'I', icon: ArrowDownLeft },
  { id: 'transfer', kind: 'transfer', label: 'New transfer', keywords: ['add', 'move', 'record'], key: 'T', icon: ArrowLeftRight },
]

const DESTINATION_ICONS: Record<string, LucideIcon> = {
  accounts: Wallet,
  activity: Activity,
  budgets: PiggyBank,
  categories: Tag,
  reports: BarChart3,
  settings: Settings,
  'import-csv': Upload,
}

interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTransaction: (kind: TransactionKind) => void
  mobile?: boolean
}

// The body mounts only while the palette is open, so its data hooks do not
// run (or refetch) until someone searches.
export function SearchPalette({ open, onOpenChange, onAddTransaction, mobile = false }: SearchPaletteProps) {
  useBackClosesSearch(open && mobile, () => onOpenChange(false))
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search transactions, accounts, categories and actions"
      className={cn(
        mobile
          ? 'inset-0 h-dvh max-h-none w-screen max-w-none translate-x-0 rounded-none! pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ring-0 sm:w-screen sm:max-w-none'
          : 'sm:max-w-xl',
      )}
    >
      {open && (
        <SearchBody
          mobile={mobile}
          close={() => onOpenChange(false)}
          onAddTransaction={onAddTransaction}
        />
      )}
    </CommandDialog>
  )
}

// The full-screen view is "pushed": it takes a history entry so the phone's
// back gesture closes it instead of leaving the page.
function useBackClosesSearch(active: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!active) return
    let popped = false
    window.history.pushState({ ledgerSearch: true }, '')
    const onPop = () => {
      popped = true
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!popped && window.history.state?.ledgerSearch) window.history.back()
    }
  }, [active])
}

function SearchBody({
  close,
  onAddTransaction,
  mobile,
}: {
  close: () => void
  onAddTransaction: (kind: TransactionKind) => void
  mobile: boolean
}) {
  const navigate = useNavigate()
  const openEntry = useEntryDetail()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('cycle')
  const [highlighted, setHighlighted] = useState('')
  // E / I / T only fire after the user arrows onto an action, so typing a
  // search that starts with one of those letters is never hijacked.
  const [navigated, setNavigated] = useState(false)

  const { results, range, isAmountQuery, loadState, error, refetch, dueSoon, loanSummary } = useGlobalSearch(
    query,
    scope,
    ACTIONS,
  )
  const actions = results.actions as typeof ACTIONS
  const trimmed = query.trim()
  const isEmptyQuery = trimmed === ''

  const go = (path: string) => {
    close()
    // On mobile the palette itself is a pushed history entry (see
    // useBackClosesSearch); replace it with the destination instead of
    // pushing on top of it, or back from the destination would land on a
    // phantom search entry before reaching the real previous page.
    navigate(path, { replace: mobile })
  }
  const runAction = (kind: TransactionKind) => {
    close()
    onAddTransaction(kind)
  }
  const openTransaction = (transaction: Transaction) => {
    close()
    openEntry?.(transaction)
  }

  const transactionGroups: { id: string; heading: string; group: typeof results.text }[] = isAmountQuery
    ? [
        { id: 'exact', heading: 'Exact amount', group: results.exact },
        { id: 'nearby', heading: 'Nearby amounts (±5%)', group: results.nearby },
        { id: 'text', heading: 'Transactions', group: results.text },
      ]
    : [{ id: 'text', heading: 'Transactions', group: results.text }]

  const transactionTotal = results.exact.total + results.nearby.total + results.text.total
  const anyResult =
    transactionTotal + results.accounts.total + results.categories.total + actions.length > 0
  const showResults = loadState !== 'loading' && !(loadState === 'error')

  return (
    <Command
      className={cn(mobile && 'rounded-none! p-0')}
      shouldFilter={false}
      value={highlighted}
      onValueChange={setHighlighted}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          setNavigated(true)
          return
        }
        if (event.metaKey || event.ctrlKey || event.altKey || !navigated) return
        const action = actions.find(
          (candidate) =>
            `action:${candidate.id}` === highlighted &&
            candidate.key?.toLowerCase() === event.key.toLowerCase(),
        )
        if (!action) return
        event.preventDefault()
        runAction(action.kind)
      }}
    >
      {mobile ? (
        <div className="flex h-16 shrink-0 items-center gap-2 border-b px-2">
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <CommandInput
            bare
            autoFocus
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setNavigated(false)
            }}
            placeholder="Search…"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery('')}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-[18px]" />
            </button>
          )}
        </div>
      ) : (
        <CommandInput
          autoFocus
          value={query}
          onValueChange={(value) => {
            setQuery(value)
            setNavigated(false)
          }}
          placeholder="Search transactions, accounts, categories — or type a command"
        />
      )}
      {!isEmptyQuery && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <span>
            {scope === 'cycle'
              ? `This cycle · ${formatDateShort(range.start)} – ${formatDateShort(range.end)}`
              : 'Searching all time'}
          </span>
          <button
            type="button"
            aria-pressed={scope === 'all'}
            onClick={() => setScope((current) => (current === 'cycle' ? 'all' : 'cycle'))}
            className="rounded-md px-2 py-1 font-medium text-foreground hover:bg-muted"
          >
            {scope === 'cycle' ? 'Search all time' : 'Limit to this cycle'}
          </button>
        </div>
      )}
      {error && loadState !== 'loading' && (
        <div className="px-1 pb-1">
          <InlineLoadError message={`Search data failed to load: ${error}`} onRetry={refetch} />
        </div>
      )}
      <CommandList className={mobile ? 'max-h-none min-h-0 flex-1' : 'max-h-96'}>
        {loadState === 'loading' && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {showResults && isEmptyQuery && (
          <>
            <CommandGroup heading="Record">
              {ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <CommandItem
                    key={action.id}
                    value={`action:${action.id}`}
                    onSelect={() => runAction(action.kind)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{action.label}</span>
                    {action.key && !mobile && <CommandShortcut>{action.key}</CommandShortcut>}
                  </CommandItem>
                )
              })}
              <CommandItem value="action:loan-repayment" onSelect={() => runAction('loan-repayment')}>
                <Landmark className="size-4 text-muted-foreground" />
                <span>Loan repayment</span>
                {loanSummary.count > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {loanSummary.count} {loanSummary.count === 1 ? 'loan' : 'loans'},{' '}
                    {formatCurrency(loanSummary.owed)} owed
                  </span>
                )}
              </CommandItem>
            </CommandGroup>
            {dueSoon.length > 0 && (
              <CommandGroup heading="Due soon">
                {dueSoon.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`due:${row.id}`}
                    onSelect={() => go(row.accountId ? `/accounts/${row.accountId}` : '/accounts')}
                  >
                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{row.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateShort(row.dueDate)} ·{' '}
                        {row.daysAway === 0
                          ? 'today'
                          : `in ${row.daysAway} ${row.daysAway === 1 ? 'day' : 'days'}`}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">{formatCurrency(row.amount)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Jump to">
              {DESTINATIONS.map((destination) => {
                const Icon = DESTINATION_ICONS[destination.id] ?? ArrowRight
                return (
                  <CommandItem
                    key={destination.id}
                    value={`jump:${destination.id}`}
                    onSelect={() => go(destination.path)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{destination.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
        {showResults && trimmed && !anyResult && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results for “{trimmed}”{scope === 'cycle' ? ' in this cycle' : ''}.
          </p>
        )}
        {showResults &&
          transactionGroups.map(({ id, heading, group }) =>
            group.total === 0 ? null : (
              <CommandGroup key={id} heading={`${heading} · ${group.total}`}>
                {group.items.map((transaction) => (
                  <CommandItem
                    key={transaction.id}
                    value={`tx:${transaction.id}`}
                    onSelect={() => openTransaction(transaction as Transaction)}
                  >
                    <TransactionRow transaction={transaction as Transaction} />
                  </CommandItem>
                ))}
                {group.total > group.items.length && (
                  <CommandItem value={`more:${id}`} onSelect={() => go('/transactions')}>
                    <span className="text-muted-foreground">
                      Show all {group.total} in Activity
                    </span>
                    <ArrowRight className="ml-auto size-4 text-muted-foreground" />
                  </CommandItem>
                )}
              </CommandGroup>
            ),
          )}
        {showResults && results.accounts.total > 0 && (
          <CommandGroup heading={`Accounts · ${results.accounts.total}`}>
            {results.accounts.items.map((account) => (
              <CommandItem
                key={account.id}
                value={`account:${account.id}`}
                onSelect={() => go(`/accounts/${account.id}`)}
              >
                <Wallet className="size-4 text-muted-foreground" />
                <span className="truncate">{account.name}</span>
              </CommandItem>
            ))}
            {results.accounts.total > results.accounts.items.length && (
              <CommandItem value="more:accounts" onSelect={() => go('/accounts')}>
                <span className="text-muted-foreground">
                  Show all {results.accounts.total} in Accounts
                </span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </CommandItem>
            )}
          </CommandGroup>
        )}
        {showResults && results.categories.total > 0 && (
          <CommandGroup heading={`Categories · ${results.categories.total}`}>
            {results.categories.items.map((category) => (
              <CommandItem
                key={category.id}
                value={`category:${category.id}`}
                onSelect={() => go('/categories')}
              >
                <Tag className="size-4 text-muted-foreground" />
                <span className="truncate">{category.name}</span>
              </CommandItem>
            ))}
            {results.categories.total > results.categories.items.length && (
              <CommandItem value="more:categories" onSelect={() => go('/categories')}>
                <span className="text-muted-foreground">
                  Show all {results.categories.total} in Categories
                </span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </CommandItem>
            )}
          </CommandGroup>
        )}
        {!isEmptyQuery && actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <CommandItem
                  key={action.id}
                  value={`action:${action.id}`}
                  onSelect={() => runAction(action.kind)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{action.label}</span>
                  {action.key && !mobile && <CommandShortcut>{action.key}</CommandShortcut>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 border-t px-3 py-2 text-xs text-muted-foreground',
          mobile && !isAmountQuery && 'hidden',
        )}
      >
        {!mobile && (
          <>
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </>
        )}
        {isAmountQuery && <span className="basis-full sm:basis-auto">Numbers match amounts within ±5%.</span>}
      </div>
    </Command>
  )
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const signed = transaction.type === 'expense' ? -transaction.amount : transaction.amount
  return (
    <>
      <Receipt className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate">{transaction.description || 'Untitled'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[formatDateShort(transaction.date), transaction.category?.name, transaction.account?.name]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          transaction.type === 'expense' && 'text-expense',
          transaction.type === 'income' && 'text-income',
        )}
      >
        {formatCurrency(signed, transaction.currency)}
      </span>
    </>
  )
}
