import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Trash2, Wallet, MoreHorizontal, GripVertical, ArrowUp, ArrowDown, Check, LayoutList, AlignJustify, CreditCard, Banknote } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { usePreferences } from '@/hooks/usePreferences'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { supabase } from '@/lib/supabase'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import { resolveLoadState } from '@/lib/loadState'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import type { Account } from '@/types'
import { AccountForm, type AccountFormValues } from '@/components/accounts/AccountForm'
import { normalizeCreditCardBalanceForStorage } from '@/lib/creditCards'
import { formatLoanSchedule } from '@/lib/loans'
import { buildAccountsOverview, formatShare, isLiability, type AssetRow, type LiabilityRow } from '@/lib/accountsOverview'
import type { AppLayoutContext } from '@/components/layout/AppLayout'
import { TONED_PROGRESS_CLASS, utilizationToneStyle } from '@/lib/utilizationTone'

function formatDueIn(days: number) {
  if (days < 0) return `${-days}d overdue`
  if (days === 0) return 'today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

export default function AccountsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { accounts, loading, error, refetch, createAccount, updateAccountWithAdjustment, deleteAccount, updateAccountOrder } = useAccounts()
  const loadState = resolveLoadState({ loading, error, hasData: accounts.length > 0 })
  const { prefs, set: setPref } = usePreferences()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null)
  const [dropTargetAccountId, setDropTargetAccountId] = useState<string | null>(null)
  const [draggedGroupType, setDraggedGroupType] = useState<AccountType | null>(null)
  const [dropTargetGroupType, setDropTargetGroupType] = useState<AccountType | null>(null)
  const [groupOrderOverride, setGroupOrderOverride] = useState<AccountType[] | null>(null)
  const [rearrangeMode, setRearrangeMode] = useState(false)
  const [isDesktopDrag, setIsDesktopDrag] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  )

  const { openAddTransactionModal } = useOutletContext<AppLayoutContext>()
  const { purchases: loanPurchases, allocations: loanAllocations, error: loansError, refetch: refetchLoans } = useLoanPurchases()
  const defaultCurrency = profile?.default_currency ?? 'USD'
  const overview = buildAccountsOverview(accounts, defaultCurrency, { purchases: loanPurchases, allocations: loanAllocations })
  const defaultGroupOrder = useMemo(() => Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[], [])
  const accountGroupOrder = useMemo(() => {
    const valid = new Set(defaultGroupOrder)
    const source = groupOrderOverride ?? profile?.account_group_order ?? prefs.accGroupOrder
    const parsed = Array.isArray(source)
      ? source.filter((type): type is AccountType => valid.has(type as AccountType))
      : []
    return [...parsed, ...defaultGroupOrder.filter((type) => !parsed.includes(type))]
  }, [defaultGroupOrder, groupOrderOverride, prefs.accGroupOrder, profile?.account_group_order])
  const groupedAccounts = useMemo(() => {
    const groups = new Map<AccountType, Account[]>()
    for (const account of accounts) {
      const group = groups.get(account.type) ?? []
      group.push(account)
      groups.set(account.type, group)
    }
    const orderedTypes = [
      ...accountGroupOrder.filter((type) => groups.has(type)),
      ...defaultGroupOrder.filter((type) => groups.has(type) && !accountGroupOrder.includes(type)),
    ]
    return orderedTypes.map((type) => [type, groups.get(type)!] as const)
  }, [accountGroupOrder, accounts, defaultGroupOrder])
  const flatAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts])
  const visibleGroupTypes = useMemo(() => groupedAccounts.map(([type]) => type), [groupedAccounts])
  const setAccountCardRef = useFlipReorder(flatAccountIds, prefs.accView === 'flat')
  const setGroupRef = useFlipReorder(visibleGroupTypes, prefs.accView === 'grouped')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = () => {
      setIsDesktopDrag(mediaQuery.matches)
      if (!mediaQuery.matches) {
        setDraggedAccountId(null)
        setDropTargetAccountId(null)
        setDraggedGroupType(null)
        setDropTargetGroupType(null)
      }
    }
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const reorderGroup = (fromType: AccountType, toType: AccountType) => {
    const base = groupedAccounts.map(([type]) => type)
    const from = base.indexOf(fromType)
    const to = base.indexOf(toType)
    if (from < 0 || to < 0 || from === to) return
    const next = [...base]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const order = [
      ...next,
      ...defaultGroupOrder.filter((type) => !next.includes(type)),
    ]
    setPref('accGroupOrder', order)
    setGroupOrderOverride(order)
    if (!user || !navigator.onLine) return
    supabase
      .from('profiles')
      .update({ account_group_order: order })
      .eq('id', user.id)
      .then(async ({ error }) => {
        if (!error) {
          await refreshProfile()
          setGroupOrderOverride(null)
        }
      })
  }

  const reorderAccount = (fromId: string, toId: string) => {
    const base = accounts.map((account) => account.id)
    const from = base.indexOf(fromId)
    const to = base.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...base]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateAccountOrder(next)
  }

  // Arrows swap with the neighbour in the same column, not in the whole list.
  const moveAccount = (id: string, direction: -1 | 1, columnIds: string[]) => {
    const neighbour = columnIds[columnIds.indexOf(id) + direction]
    if (!neighbour) return
    const next = accounts.map((account) => account.id)
    const from = next.indexOf(id)
    const to = next.indexOf(neighbour)
    next[from] = neighbour
    next[to] = id
    updateAccountOrder(next)
  }

  const moveGroup = (type: AccountType, direction: -1 | 1, columnTypes: AccountType[]) => {
    const target = columnTypes[columnTypes.indexOf(type) + direction]
    if (target) reorderGroup(type, target)
  }

  const handleCreate = async (values: AccountFormValues) => {
    const { error } = await createAccount({ ...normalizeCreditCardBalanceForStorage(values), is_active: true, icon: null })
    if (error) { setFormError(error); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: AccountFormValues) => {
    if (!editAccount) return
    const { error } = await updateAccountWithAdjustment(editAccount.id, normalizeCreditCardBalanceForStorage(values), editAccount.balance)
    if (error) { setFormError(error); return }
    setFormError(null)
    setEditAccount(null)
  }

  const dragProps = (account: Account, flatRearrange: boolean) => ({
    draggable: isDesktopDrag && flatRearrange,
    onDragStart: () => {
      if (flatRearrange) {
        setDraggedAccountId(account.id)
        setDropTargetAccountId(null)
      }
    },
    onDragEnter: () => {
      if (flatRearrange && draggedAccountId && draggedAccountId !== account.id) setDropTargetAccountId(account.id)
    },
    onDragOver: (event: React.DragEvent) => {
      if (flatRearrange) {
        event.preventDefault()
        if (draggedAccountId && draggedAccountId !== account.id) setDropTargetAccountId(account.id)
      }
    },
    onDrop: (event: React.DragEvent) => {
      if (!flatRearrange) return
      event.preventDefault()
      if (draggedAccountId) reorderAccount(draggedAccountId, account.id)
      setDraggedAccountId(null)
      setDropTargetAccountId(null)
    },
    onDragEnd: () => {
      if (flatRearrange) setDraggedAccountId(null)
      setDropTargetAccountId(null)
    },
    ref: flatRearrange ? setAccountCardRef(account.id) : undefined,
  })

  const openProps = (account: Account, flatRearrange: boolean) => flatRearrange ? {} : {
    role: 'link',
    tabIndex: 0,
    'aria-label': `Open ${account.name}`,
    onClick: () => navigate(`/accounts/${account.id}`),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.target === event.currentTarget && event.key === 'Enter') navigate(`/accounts/${account.id}`)
    },
  }

  const rearrangeControls = (account: Account, flatRearrange: boolean, columnIds: string[]) => {
    const idx = columnIds.indexOf(account.id)
    return (
      <>
        <button
          type="button"
          className={`reorder-handle hidden text-muted-foreground cursor-grab rounded-md p-1 hover:bg-muted ${flatRearrange ? 'md:block' : ''}`}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Drag to rearrange ${account.name}`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          className={flatRearrange ? 'md:hidden' : 'hidden'}
          aria-label={`Move ${account.name} up`}
          onClick={(e) => { e.stopPropagation(); moveAccount(account.id, -1, columnIds) }}
          disabled={idx === 0}
        >
          <ArrowUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className={flatRearrange ? 'md:hidden' : 'hidden'}
          aria-label={`Move ${account.name} down`}
          onClick={(e) => { e.stopPropagation(); moveAccount(account.id, 1, columnIds) }}
          disabled={idx === columnIds.length - 1}
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
      </>
    )
  }

  const accountMenu = (account: Account) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${account.name}`} onClick={(e) => e.stopPropagation()} />}>
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditAccount(account) }}>
          <Pencil className="w-4 h-4 mr-2" />Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            setDeleteTarget(account)
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const accountIcon = (account: Account) => {
    const Icon = ACCOUNT_ICONS[account.type]
    return (
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: account.color + '20', color: account.color }}
      >
        <Icon className="w-4 h-4" />
      </span>
    )
  }

  const renderAssetRow = (row: AssetRow, idx: number, columnIds: string[], flatRearrange: boolean) => {
    const { account } = row
    return (
      <div
        key={account.id}
        {...dragProps(account, flatRearrange)}
        {...openProps(account, flatRearrange)}
        className={cn(
          'reorder-motion grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5 animate-fade-up md:grid-cols-[minmax(0,1.5fr)_3.5rem_minmax(0,1.2fr)_7.5rem_1.75rem] 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3.5rem_minmax(0,1.2fr)_7.5rem_1.75rem]',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
          flatRearrange ? 'cursor-grab' : 'cursor-pointer hover:bg-muted/50',
          draggedAccountId === account.id && 'is-dragging',
          dropTargetAccountId === account.id && 'is-drop-target'
        )}
        style={{ '--anim-delay': `${Math.min(idx * 40, 240)}ms` } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {rearrangeControls(account, flatRearrange, columnIds)}
          {accountIcon(account)}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{account.name}</p>
            <p className="truncate text-xs text-muted-foreground md:hidden">
              {ACCOUNT_TYPE_LABELS[account.type]}
              {row.excluded ? ' · Not in totals' : row.sharePct !== null ? ` · ${formatShare(row.sharePct)}` : ''}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground md:block 2xl:hidden">{ACCOUNT_TYPE_LABELS[account.type]}</p>
          </div>
        </div>
        <span className="hidden truncate text-xs text-muted-foreground 2xl:block">{ACCOUNT_TYPE_LABELS[account.type]}</span>
        <span className="hidden text-xs text-muted-foreground md:block">{account.currency}</span>
        <div className="hidden items-center gap-2 md:flex">
          {row.excluded ? (
            <span className="text-xs text-muted-foreground">No {account.currency} rate — not in totals</span>
          ) : (
            <>
              <Progress value={row.sharePct ?? 0} className="flex-1" aria-label={`${account.name} share of assets`} />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatShare(row.sharePct ?? 0)}</span>
            </>
          )}
        </div>
        <p className="money text-right text-sm font-semibold" style={{ color: account.balance < 0 ? 'var(--destructive)' : undefined }}>
          {formatCurrency(row.balance, account.currency)}
        </p>
        {accountMenu(account)}
      </div>
    )
  }

  const renderLiabilityCard = (row: LiabilityRow, idx: number, columnIds: string[], flatRearrange: boolean) => {
    const { account } = row
    const isCard = account.type === 'credit_card'
    const schedule = formatLoanSchedule(account)
    const target = account.utilization_target_pct ?? 30
    return (
      <div
        key={account.id}
        {...dragProps(account, flatRearrange)}
        className={cn(
          'reorder-motion relative overflow-hidden rounded-xl border border-border bg-card p-4 animate-fade-up',
          flatRearrange && 'cursor-grab',
          draggedAccountId === account.id && 'is-dragging',
          dropTargetAccountId === account.id && 'is-drop-target'
        )}
        style={{ '--anim-delay': `${Math.min(idx * 60, 240)}ms` } as React.CSSProperties}
      >
        <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: account.color }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {rearrangeControls(account, flatRearrange, columnIds)}
            {accountIcon(account)}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{account.name}</p>
              <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <p className="money text-base font-bold">{row.owed > 0 ? '−' : ''}{formatCurrency(row.owed, account.currency)}</p>
            {accountMenu(account)}
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {isCard ? (
            row.utilizationPct !== null ? (
              <>
                <Progress
                  value={Math.min(row.utilizationPct, 100)}
                  className={TONED_PROGRESS_CLASS}
                  style={utilizationToneStyle(row.utilizationPct, target) as React.CSSProperties}
                  aria-label={`${account.name} utilisation`}
                />
                <p className="text-xs text-muted-foreground">
                  Limit {formatCurrency(account.credit_limit ?? 0, account.currency)} · {row.utilizationPct.toFixed(1)}% used
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No credit limit set, so utilisation isn't tracked.</p>
            )
          ) : row.loanProgress ? (
            <>
              <Progress value={row.loanProgress.pct} aria-label={`${account.name} repayment progress`} />
              <p className="text-xs text-muted-foreground">
                {schedule ? `${schedule} · ` : ''}{row.loanProgress.paidInstallments} of {row.loanProgress.totalInstallments} paid
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{schedule ?? 'No financed purchases yet.'}</p>
          )}
          {row.excluded && (
            <p className="text-xs text-muted-foreground">No {account.currency} rate — not in totals</p>
          )}
        </div>
        {!flatRearrange && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => openAddTransactionModal(isCard ? 'card-payment' : 'loan-repayment', { targetAccountId: account.id })}
            >
              {isCard ? <CreditCard className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
              {isCard ? 'Pay card' : 'Repay loan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/accounts/${account.id}`)}>View</Button>
          </div>
        )}
      </div>
    )
  }

  const assetRows = new Map(overview.assets.map((row) => [row.account.id, row]))
  const liabilityRows = new Map(overview.liabilities.map((row) => [row.account.id, row]))

  const renderColumn = (column: 'assets' | 'liabilities') => {
    const inColumn = (type: AccountType) => isLiability({ type }) === (column === 'liabilities')
    const renderItem = (account: Account, idx: number, columnIds: string[], flatRearrange: boolean) =>
      column === 'assets'
        ? renderAssetRow(assetRows.get(account.id)!, idx, columnIds, flatRearrange)
        : renderLiabilityCard(liabilityRows.get(account.id)!, idx, columnIds, flatRearrange)
    const wrap = (children: React.ReactNode) =>
      column === 'assets'
        ? <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">{children}</div>
        : <div className="grid gap-3 2xl:grid-cols-2">{children}</div>

    if (prefs.accView === 'flat') {
      const columnAccounts = accounts.filter((account) => inColumn(account.type))
      if (columnAccounts.length === 0) return null
      const ids = columnAccounts.map((account) => account.id)
      return wrap(columnAccounts.map((account, idx) => renderItem(account, idx, ids, rearrangeMode)))
    }

    const groups = groupedAccounts.filter(([type]) => inColumn(type))
    const groupTypes = groups.map(([type]) => type)
    return (
      <div className="space-y-4">
        {groups.map(([type, groupAccounts], groupIndex) => (
          <div
            key={type}
            ref={setGroupRef(type)}
            draggable={isDesktopDrag && rearrangeMode}
            onDragStart={() => {
              setDraggedGroupType(type)
              setDropTargetGroupType(null)
            }}
            onDragEnter={() => {
              if (draggedGroupType && draggedGroupType !== type) setDropTargetGroupType(type)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (draggedGroupType && draggedGroupType !== type) setDropTargetGroupType(type)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedGroupType) reorderGroup(draggedGroupType, type)
              setDraggedGroupType(null)
              setDropTargetGroupType(null)
            }}
            onDragEnd={() => {
              setDraggedGroupType(null)
              setDropTargetGroupType(null)
            }}
            className={cn(
              rearrangeMode && 'reorder-motion rounded-xl border border-dashed border-border/80 p-3 hover:border-primary/50 cursor-grab',
              draggedGroupType === type && 'is-dragging',
              dropTargetGroupType === type && 'is-drop-target'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className={`reorder-handle hidden text-muted-foreground cursor-grab rounded-md p-1 hover:bg-muted ${rearrangeMode ? 'md:block' : ''}`}
                  aria-label={`Drag to rearrange ${ACCOUNT_TYPE_LABELS[type]} group`}
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {ACCOUNT_TYPE_LABELS[type]}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={rearrangeMode ? 'md:hidden' : 'hidden'}
                  onClick={() => moveGroup(type, -1, groupTypes)}
                  disabled={groupIndex === 0}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={rearrangeMode ? 'md:hidden' : 'hidden'}
                  onClick={() => moveGroup(type, 1, groupTypes)}
                  disabled={groupIndex === groups.length - 1}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {groupAccounts.length} account{groupAccounts.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {wrap(groupAccounts.map((account, idx) => renderItem(account, idx, [], false)))}
          </div>
        ))}
      </div>
    )
  }

  const cardCount = accounts.filter((account) => account.type === 'credit_card').length
  const loanCount = accounts.filter((account) => account.type === 'loan').length
  const liabilityMix = [
    cardCount > 0 && `${cardCount} card${cardCount > 1 ? 's' : ''}`,
    loanCount > 0 && `${loanCount} loan${loanCount > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ') || 'None'
  const currencyCount = new Set(accounts.map((account) => account.currency)).size
  const assetCount = overview.assets.length

  return (
    <div className="p-4 md:p-6 lg:px-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold md:hidden">Accounts</h1>
          {accounts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {accounts.length} account{accounts.length > 1 ? 's' : ''} · {currencyCount} currenc{currencyCount > 1 ? 'ies' : 'y'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant={rearrangeMode ? 'secondary' : 'outline'} size="sm" className="gap-1.5" />}>
                {rearrangeMode ? <Check className="w-3.5 h-3.5" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
                {rearrangeMode ? 'Done arranging' : 'View options'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setPref('accView', prefs.accView === 'grouped' ? 'flat' : 'grouped')
                  setRearrangeMode(false)
                  setDraggedAccountId(null)
                  setDropTargetAccountId(null)
                  setDraggedGroupType(null)
                  setDropTargetGroupType(null)
                }}>
                  {prefs.accView === 'grouped' ? <AlignJustify className="mr-2 h-4 w-4" /> : <LayoutList className="mr-2 h-4 w-4" />}
                  Switch to {prefs.accView === 'grouped' ? 'flat' : 'grouped'} view
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setRearrangeMode((value) => !value)
                  setDraggedAccountId(null)
                  setDropTargetAccountId(null)
                  setDraggedGroupType(null)
                  setDropTargetGroupType(null)
                }}>
                  <GripVertical className="mr-2 h-4 w-4" />
                  {rearrangeMode ? 'Finish arranging' : 'Rearrange accounts'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="gap-2" size="sm" />}>
              <Plus className="w-4 h-4" />Add Account
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto sm:max-h-[90vh]">
              <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
              {formError && <FormError>{formError}</FormError>}
              <AccountForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} defaultValues={{ currency: defaultCurrency }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadState === 'stale-error' && (
        <InlineLoadError message="Couldn't refresh your accounts. Showing what was last loaded." onRetry={() => void refetch()} />
      )}
      {loadState === 'error' ? (
        <ErrorState title="Couldn't load your accounts" detail={error} onRetry={() => void refetch()} />
      ) : loading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to get started"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
            <div className="border-b border-r border-border/60 p-4 lg:border-b-0">
              <p className="text-xs text-muted-foreground">Assets</p>
              <p className="money mt-1 text-lg font-semibold">{formatCurrency(overview.totals.assets, defaultCurrency)}</p>
              <p className="text-xs text-muted-foreground">{assetCount} account{assetCount === 1 ? '' : 's'}</p>
            </div>
            <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
              <p className="text-xs text-muted-foreground">Liabilities</p>
              <p className="money mt-1 text-lg font-semibold">{formatCurrency(overview.totals.liabilities, defaultCurrency)}</p>
              <p className="text-xs text-muted-foreground">{liabilityMix}</p>
            </div>
            <div className="col-span-2 border-b border-border/60 p-4 lg:col-span-1 lg:border-b-0 lg:border-r">
              <p className="text-xs text-muted-foreground">Net Worth</p>
              <p className="money mt-1 text-lg font-bold">{formatCurrency(overview.totals.netWorth, defaultCurrency)}</p>
              {overview.excludedCurrencies.length > 0 && (
                <p className="text-xs text-muted-foreground">{defaultCurrency} accounts only</p>
              )}
            </div>
            <div className="col-span-2 p-4 lg:col-span-1">
              <p className="text-xs text-muted-foreground">Coming up</p>
              {loansError ? (
                <p className="mt-1 text-xs text-muted-foreground">Loan dates didn't load.</p>
              ) : overview.comingUp.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nothing due</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {overview.comingUp.slice(0, 3).map((item) => (
                    <li key={item.account.id} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        <span className="money font-medium text-foreground">{formatCurrency(item.amount, item.account.currency)}</span>
                        {' '}{formatDueIn(item.days)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {overview.assets.length > 0 && (
              <section className="min-w-0 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">Assets</h2>
                  <p className="money text-sm font-semibold">{formatCurrency(overview.totals.assets, defaultCurrency)}</p>
                </div>
                {prefs.accView === 'flat' && (
                  <div className="hidden grid-cols-[minmax(0,1.5fr)_3.5rem_minmax(0,1.2fr)_7.5rem_1.75rem] gap-x-3 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3.5rem_minmax(0,1.2fr)_7.5rem_1.75rem] px-4 text-[0.6875rem] uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Account</span><span className="hidden 2xl:block">Type</span><span>Currency</span><span>Share</span><span className="text-right">Balance</span><span />
                  </div>
                )}
                {renderColumn('assets')}
                {overview.excludedCurrencies.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Totals are in {defaultCurrency} and leave out {overview.excludedCurrencies.join(', ')} accounts — Ledger has no exchange rate for them.
                  </p>
                )}
              </section>
            )}
            {overview.liabilities.length > 0 && (
              <section className="min-w-0 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">Liabilities</h2>
                  <p className="money text-sm font-semibold">
                    {overview.totals.liabilities > 0 ? '−' : ''}{formatCurrency(overview.totals.liabilities, defaultCurrency)}
                  </p>
                </div>
                {loansError && (
                  <InlineLoadError message="Couldn't load loan progress and due dates." onRetry={() => void refetchLoans()} />
                )}
                {renderColumn('liabilities')}
              </section>
            )}
          </div>
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editAccount} onOpenChange={(o) => { if (!o) { setEditAccount(null); setFormError(null) } }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {formError && <FormError>{formError}</FormError>}
          {editAccount && (
            <AccountForm
              account={editAccount}
              onSubmit={handleEdit}
              onClose={() => setEditAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog (kept outside dropdown so it doesn't unmount) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive "{deleteTarget?.name ?? ''}". Transactions will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return
              const { error } = await deleteAccount(deleteTarget.id)
              if (error) console.error('Failed to delete account:', error)
              setDeleteTarget(null)
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
