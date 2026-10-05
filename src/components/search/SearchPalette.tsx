import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
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
import { useSavedFilters } from '@/hooks/useSavedFilters'
import { KIND_SHORTCUTS } from '@/lib/kindMenu'
import {
  DESTINATIONS,
  budgetEditPath,
  categoryActions,
  chipShows,
  groupChips,
  highlightParts,
  resolveChip,
  type SearchAction,
  type SearchChip,
  type SearchScope,
} from '@/lib/globalSearch'
import { activityFilterPath, describeFilter, matchSavedFilters, type SavedFilter } from '@/lib/savedFilters'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import type { Transaction } from '@/types'

const ACTIONS: (SearchAction & { kind: TransactionKind; icon: typeof ArrowUpRight })[] = [
  { id: 'expense', kind: 'expense', label: 'New expense', keywords: ['add', 'spend', 'record'], key: KIND_SHORTCUTS.expense, icon: ArrowUpRight },
  { id: 'income', kind: 'income', label: 'New income', keywords: ['add', 'earn', 'record'], key: KIND_SHORTCUTS.income, icon: ArrowDownLeft },
  { id: 'transfer', kind: 'transfer', label: 'New transfer', keywords: ['add', 'move', 'record'], key: KIND_SHORTCUTS.transfer, icon: ArrowLeftRight },
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
  onAddTransaction: (kind: TransactionKind, options?: { categoryId?: string }) => void
  mobile?: boolean
  /** The account page the palette opened over, if any; ⌘F scopes to it. */
  currentAccount?: { id: string; name: string } | null
}

/** "1 more transaction", "3 more amounts": the palette's hand-off row, read aloud as its name (LED-179). */
function moreLabel(count: number, noun: string): string {
  return `${count} more ${noun}${count === 1 ? '' : 's'}`
}

// The body mounts only while the palette is open, so its data hooks do not
// run (or refetch) until someone searches.
export function SearchPalette({
  open,
  onOpenChange,
  onAddTransaction,
  mobile = false,
  currentAccount = null,
}: SearchPaletteProps) {
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
          currentAccount={currentAccount}
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
  currentAccount,
}: {
  close: () => void
  onAddTransaction: (kind: TransactionKind, options?: { categoryId?: string }) => void
  mobile: boolean
  currentAccount: { id: string; name: string } | null
}) {
  const navigate = useNavigate()
  const openEntry = useEntryDetail()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('cycle')
  const [activeChip, setActiveChip] = useState<SearchChip>('all')
  const [accountScoped, setAccountScoped] = useState(false)
  const scopedAccount = accountScoped ? currentAccount : null
  const [highlighted, setHighlighted] = useState('')
  // E / I / T only fire after the user arrows onto an action, so typing a
  // search that starts with one of those letters is never hijacked.
  const [navigated, setNavigated] = useState(false)

  const { results, range, isAmountQuery, loadState, error, refetch, dueSoon, loanSummary, budgetByCategory } = useGlobalSearch(
    query,
    scope,
    ACTIONS,
    scopedAccount,
  )
  const actions = results.actions as typeof ACTIONS
  // Saved filters (29a): matched by name or description; all of them before anything is typed.
  const savedFilters = useSavedFilters()
  const savedMatches = matchSavedFilters(savedFilters.filters, query)
  const trimmed = query.trim()
  const isEmptyQuery = trimmed === ''

  // Per-category actions (16a): drawn for the category rows on screen, listed with the other actions.
  const categoryActionRows = results.categories.items.flatMap((category) =>
    categoryActions(category, budgetByCategory.get(category.id) ?? null).map((action) => ({
      ...action,
      value: `category-action:${category.id}:${action.id}`,
      categoryId: category.id,
    })),
  )
  const actionTotal = actions.length + categoryActionRows.length

  const go = (path: string) => {
    close()
    // On mobile the palette itself is a pushed history entry (see
    // useBackClosesSearch); replace it with the destination instead of
    // pushing on top of it, or back from the destination would land on a
    // phantom search entry before reaching the real previous page.
    navigate(path, { replace: mobile })
  }
  const runAction = (kind: TransactionKind, categoryId?: string) => {
    close()
    onAddTransaction(kind, categoryId ? { categoryId } : undefined)
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

  const transactionTotal = results.transactionTotal
  const overallTotal = transactionTotal + results.accounts.total + results.categories.total + savedMatches.length
  const anyResult = overallTotal + actionTotal > 0
  const chips = groupChips({
    transactions: transactionTotal,
    accounts: results.accounts.total,
    categories: results.categories.total,
    saved: savedMatches.length,
    actions: actionTotal,
  })
  const chip = resolveChip(activeChip, chips)
  const showResults = loadState !== 'loading' && !(loadState === 'error')
  const { handoff } = results
  // An all-time search can match nothing in the cycle Activity shows; then there
  // is nowhere honest to send "See all".
  const canHandOff = showResults && trimmed !== '' && handoff.count > 0
  const firstTransactionGroup = transactionGroups.find(({ group }) => group.total > 0)?.id

  return (
    <Command
      className={cn(mobile && 'rounded-none! p-0')}
      shouldFilter={false}
      value={highlighted}
      onValueChange={setHighlighted}
      onKeyDown={(event) => {
        const mod = (event.metaKey || event.ctrlKey) && !event.altKey
        if (mod && event.key === 'Enter' && canHandOff) {
          event.preventDefault()
          go(handoff.path)
          return
        }
        // Only claimed on an account page; elsewhere the browser's find still works.
        if (mod && event.key.toLowerCase() === 'f' && currentAccount) {
          event.preventDefault()
          setAccountScoped((current) => !current)
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          setNavigated(true)
          return
        }
        if (event.metaKey || event.ctrlKey || event.altKey || !navigated) return
        const pressed = event.key.toLowerCase()
        const action = actions.find(
          (candidate) => `action:${candidate.id}` === highlighted && candidate.key?.toLowerCase() === pressed,
        )
        const categoryNew = categoryActionRows.find(
          (row) => row.id === 'new' && row.value === highlighted && KIND_SHORTCUTS[row.kind].toLowerCase() === pressed,
        )
        if (!action && !categoryNew) return
        event.preventDefault()
        if (action) runAction(action.kind)
        else if (categoryNew?.id === 'new') runAction(categoryNew.kind, categoryNew.categoryId)
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
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setNavigated(false)
            }}
            placeholder="Search…"
            aria-label="Search"
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
          value={query}
          onValueChange={(value) => {
            setQuery(value)
            setNavigated(false)
          }}
          placeholder="Search transactions, accounts, categories — or type a command"
          aria-label="Search"
        />
      )}
      {!isEmptyQuery && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {showResults && (
              <span className="font-medium text-foreground tabular-nums">
                {overallTotal} {overallTotal === 1 ? 'match' : 'matches'}
              </span>
            )}
            <span>
              {scope === 'cycle'
                ? `This cycle · ${formatDateShort(range.start)} – ${formatDateShort(range.end)}`
                : 'Searching all time'}
            </span>
            {currentAccount && (
              <button
                type="button"
                aria-pressed={accountScoped}
                aria-label={accountScoped ? `Stop filtering to ${currentAccount.name}` : `Only search ${currentAccount.name}`}
                onClick={() => setAccountScoped((current) => !current)}
                className={cn(
                  'inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium hover:bg-muted',
                  accountScoped ? 'bg-muted text-foreground' : 'border border-border text-foreground',
                )}
              >
                {accountScoped ? (
                  <>
                    {currentAccount.name} only
                    <X className="size-3" />
                  </>
                ) : (
                  <>Only in {currentAccount.name}</>
                )}
              </button>
            )}
          </span>
        </div>
      )}
      {!isEmptyQuery && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Filter results">
            {chips.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={chip === option.id}
                onClick={() => setActiveChip(option.id)}
                className={cn(
                  'inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
                  chip === option.id
                    ? 'border-transparent bg-foreground text-background'
                    : 'border-border text-foreground hover:bg-muted',
                )}
              >
                {option.label}
                <span className="tabular-nums">{option.count}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={scope === 'all'}
            onClick={() => setScope((current) => (current === 'cycle' ? 'all' : 'cycle'))}
            className="ml-auto min-h-8 shrink-0 rounded-md px-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            {scope === 'cycle' ? 'Search all time' : 'Limit to this cycle'}
          </button>
        </div>
      )}
      {error && loadState !== 'loading' && (
        <div className="px-1 pb-1">
          <InlineLoadError message={`Search data failed to load. ${error}`} onRetry={refetch} />
        </div>
      )}
      {savedFilters.error && !savedFilters.loading && (
        <div className="px-1 pb-1">
          <InlineLoadError
            message={`Saved filters failed to load. ${savedFilters.error}`}
            onRetry={() => void savedFilters.refetch()}
          />
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
            {savedMatches.length > 0 && (
              <CommandGroup heading={`Saved filters · ${savedMatches.length}`}>
                {savedMatches.map((saved) => (
                  <SavedFilterItem key={saved.id} saved={saved} query="" onSelect={() => go(activityFilterPath(saved.filter))} />
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
            No results for “{trimmed}”{scopedAccount ? ` in ${scopedAccount.name}` : ''}
            {scope === 'cycle' ? ' in this cycle' : ''}.
          </p>
        )}
        {showResults &&
          chipShows(chip, 'transactions') &&
          transactionGroups.map(({ id, heading, group }) =>
            group.total === 0 ? null : (
              <CommandGroup
                key={id}
                heading={
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      {heading} · {group.total}
                    </span>
                    {id === firstTransactionGroup && canHandOff && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => go(handoff.path)}
                        className="font-medium text-foreground hover:underline"
                      >
                        {handoff.label} →
                      </button>
                    )}
                  </span>
                }
              >
                {group.items.map((transaction) => (
                  <CommandItem
                    key={transaction.id}
                    value={`tx:${transaction.id}`}
                    onSelect={() => openTransaction(transaction as Transaction)}
                  >
                    <TransactionRow transaction={transaction as Transaction} query={trimmed} />
                  </CommandItem>
                ))}
                {group.total > group.items.length &&
                  (canHandOff ? (
                    <CommandItem value={`more:${id}`} onSelect={() => go(handoff.path)}>
                      <span className="text-muted-foreground">
                        {handoff.complete
                          ? moreLabel(group.total - group.items.length, id === 'text' ? 'transaction' : 'amount')
                          : handoff.label}
                      </span>
                      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
                    </CommandItem>
                  ) : (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      {group.total - group.items.length} more, all outside this cycle
                    </p>
                  ))}
              </CommandGroup>
            ),
          )}
        {showResults && chipShows(chip, 'accounts') && results.accounts.total > 0 && (
          <CommandGroup heading={`Accounts · ${results.accounts.total}`}>
            {results.accounts.items.map((account) => (
              <CommandItem
                key={account.id}
                value={`account:${account.id}`}
                onSelect={() => go(`/accounts/${account.id}`)}
              >
                <Tile>
                  <Wallet className="size-4 text-muted-foreground" />
                </Tile>
                <span className="truncate">
                  <Highlight text={account.name} query={trimmed} />
                </span>
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
        {showResults && chipShows(chip, 'categories') && results.categories.total > 0 && (
          <CommandGroup heading={`Categories · ${results.categories.total}`}>
            {results.categories.items.map((category) => (
              <CommandItem
                key={category.id}
                value={`category:${category.id}`}
                onSelect={() => go('/categories')}
              >
                <Tile>{category.icon || <Tag className="size-4 text-muted-foreground" />}</Tile>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <Highlight text={category.name} query={trimmed} />
                  </p>
                  {category.matchCount > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      contains {category.matchCount} “{trimmed}”{' '}
                      {category.matchCount === 1 ? 'match' : 'matches'}
                    </p>
                  )}
                </div>
                {category.matchCount > 0 && (
                  <span className="shrink-0 tabular-nums">
                    {Object.entries(category.matchSum)
                      .map(([currency, sum]) => formatCurrency(sum, currency))
                      .join(' · ')}
                  </span>
                )}
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
        {showResults && !isEmptyQuery && chipShows(chip, 'saved') && savedMatches.length > 0 && (
          <CommandGroup heading={`Saved filters · ${savedMatches.length}`}>
            {savedMatches.map((saved) => (
              <SavedFilterItem key={saved.id} saved={saved} query={trimmed} onSelect={() => go(activityFilterPath(saved.filter))} />
            ))}
          </CommandGroup>
        )}
        {!isEmptyQuery && chipShows(chip, 'actions') && actionTotal > 0 && (
          <CommandGroup heading={`Actions · ${actionTotal}`}>
            {categoryActionRows.map((row) => (
              <CommandItem
                key={row.value}
                value={row.value}
                onSelect={() => (row.id === 'new' ? runAction(row.kind, row.categoryId) : go(budgetEditPath(row.budgetId)))}
              >
                {row.id === 'new' ? (
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                ) : (
                  <PiggyBank className="size-4 text-muted-foreground" />
                )}
                <span className="truncate">{row.label}</span>
                {row.id === 'new' && !mobile && <CommandShortcut>{KIND_SHORTCUTS[row.kind]}</CommandShortcut>}
              </CommandItem>
            ))}
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
            <span>↑↓ move</span>
            <span>↵ open</span>
            {canHandOff && <span>⌘↵ open in {scopedAccount ? scopedAccount.name : 'Activity'}</span>}
            {currentAccount && (
              <span>⌘F {accountScoped ? 'search everything' : 'filter this account only'}</span>
            )}
            <span>esc close</span>
          </>
        )}
        {isAmountQuery && <span className="basis-full sm:basis-auto">Numbers match amounts within ±5%.</span>}
      </div>
    </Command>
  )
}

function SavedFilterItem({ saved, query, onSelect }: { saved: SavedFilter; query: string; onSelect: () => void }) {
  return (
    <CommandItem value={`saved-filter:${saved.id}`} onSelect={onSelect}>
      <Tile>
        <Bookmark className="size-4 text-muted-foreground" />
      </Tile>
      <span className="min-w-0 flex-1 truncate">
        <Highlight text={saved.name} query={query} />
      </span>
      <span className="max-w-[50%] shrink-0 truncate text-xs text-muted-foreground">{describeFilter(saved.filter)}</span>
    </CommandItem>
  )
}

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-base leading-none"
    >
      {children}
    </span>
  )
}

// Matched text in the warning ink on its tint: a pair themeContrast holds to 4.5:1 in both themes.
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-warning-container font-medium text-warning">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}

function TransactionRow({ transaction, query }: { transaction: Transaction; query: string }) {
  const signed = transaction.type === 'expense' ? -transaction.amount : transaction.amount
  const meta = [formatDateShort(transaction.date), transaction.category?.name, transaction.account?.name]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <Tile>{transaction.category?.icon || <Receipt className="size-4 text-muted-foreground" />}</Tile>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <Highlight text={transaction.description || 'Untitled'} query={query} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <Highlight text={meta} query={query} />
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
