import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  Receipt,
  Tag,
  Wallet,
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
import type { SearchAction, SearchScope } from '@/lib/globalSearch'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import type { Transaction } from '@/types'

const ACTIONS: (SearchAction & { kind: TransactionKind; icon: typeof ArrowUpRight })[] = [
  { id: 'expense', kind: 'expense', label: 'New expense', keywords: ['add', 'spend', 'record'], key: 'E', icon: ArrowUpRight },
  { id: 'income', kind: 'income', label: 'New income', keywords: ['add', 'earn', 'record'], key: 'I', icon: ArrowDownLeft },
  { id: 'transfer', kind: 'transfer', label: 'New transfer', keywords: ['add', 'move', 'record'], key: 'T', icon: ArrowLeftRight },
]

interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTransaction: (kind: TransactionKind) => void
}

// The body mounts only while the palette is open, so its data hooks do not
// run (or refetch) until someone searches.
export function SearchPalette({ open, onOpenChange, onAddTransaction }: SearchPaletteProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search transactions, accounts, categories and actions"
      className="sm:max-w-xl"
    >
      {open && <SearchBody close={() => onOpenChange(false)} onAddTransaction={onAddTransaction} />}
    </CommandDialog>
  )
}

function SearchBody({
  close,
  onAddTransaction,
}: {
  close: () => void
  onAddTransaction: (kind: TransactionKind) => void
}) {
  const navigate = useNavigate()
  const openEntry = useEntryDetail()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('cycle')
  const [highlighted, setHighlighted] = useState('')
  // E / I / T only fire after the user arrows onto an action, so typing a
  // search that starts with one of those letters is never hijacked.
  const [navigated, setNavigated] = useState(false)

  const { results, range, isAmountQuery, loadState, error, refetch } = useGlobalSearch(
    query,
    scope,
    ACTIONS,
  )
  const actions = results.actions as typeof ACTIONS
  const trimmed = query.trim()

  const go = (path: string) => {
    close()
    navigate(path)
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
      <CommandInput
        autoFocus
        value={query}
        onValueChange={(value) => {
          setQuery(value)
          setNavigated(false)
        }}
        placeholder="Search transactions, accounts, categories…"
      />
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
      {error && loadState !== 'loading' && (
        <div className="px-1 pb-1">
          <InlineLoadError message={`Search data failed to load: ${error}`} onRetry={refetch} />
        </div>
      )}
      <CommandList className="max-h-96">
        {loadState === 'loading' && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
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
          </CommandGroup>
        )}
        {actions.length > 0 && (
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
                  {action.key && <CommandShortcut>{action.key}</CommandShortcut>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex flex-wrap items-center gap-x-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
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
