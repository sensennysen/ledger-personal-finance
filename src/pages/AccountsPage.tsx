import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Wallet, MoreHorizontal, GripVertical, ArrowUp, ArrowDown, Check, LayoutList, AlignJustify } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences } from '@/hooks/usePreferences'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { supabase } from '@/lib/supabase'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, InlineLoadError } from '@/components/ui/error-state'
import { resolveLoadState } from '@/lib/loadState'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import type { Account } from '@/types'
import { AccountForm, type AccountFormValues } from '@/components/accounts/AccountForm'
import { daysUntilDayOfMonth, getBalanceSummary, getCreditCardSpending, normalizeCreditCardBalanceForStorage } from '@/lib/creditCards'
import { formatLoanSchedule, getLoanAmountOwed } from '@/lib/loans'

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

  const balanceSummary = getBalanceSummary(accounts)
  const defaultCurrency = profile?.default_currency ?? 'USD'
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

  const moveAccount = (id: string, direction: -1 | 1) => {
    const index = accounts.findIndex((account) => account.id === id)
    const next = accounts.map((account) => account.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    updateAccountOrder(next)
  }

  const moveGroup = (type: AccountType, direction: -1 | 1) => {
    const index = groupedAccounts.findIndex(([groupType]) => groupType === type)
    const target = groupedAccounts[index + direction]?.[0]
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

  const renderAccountCard = (account: Account, idx: number, options?: { flatRearrange?: boolean }) => {
    const flatRearrange = options?.flatRearrange ?? false
    const Icon = ACCOUNT_ICONS[account.type]
    const statementDays = account.type === 'credit_card' ? daysUntilDayOfMonth(account.statement_day) : null
    const dueDays = account.type === 'credit_card' ? daysUntilDayOfMonth(account.due_day) : null
    const dueReminderDays = account.payment_reminder_days ?? 3
    const showStatementReminder = statementDays !== null && statementDays <= 2
    const showDueReminder = dueDays !== null && dueDays <= dueReminderDays
    const reminderLabel = showDueReminder
      ? `Due: ${dueDays === 0 ? 'today' : `${dueDays} ${dueDays === 1 ? 'day' : 'days'}`}`
      : showStatementReminder
        ? `Statement: ${statementDays === 0 ? 'today' : `${statementDays} ${statementDays === 1 ? 'day' : 'days'}`}`
        : null

    return (
      <Card
        key={account.id}
        role={flatRearrange ? undefined : 'link'}
        tabIndex={flatRearrange ? undefined : 0}
        aria-label={flatRearrange ? undefined : `Open ${account.name}`}
        draggable={isDesktopDrag && flatRearrange}
        onDragStart={() => {
          if (flatRearrange) {
            setDraggedAccountId(account.id)
            setDropTargetAccountId(null)
          }
        }}
        onDragEnter={() => {
          if (flatRearrange && draggedAccountId && draggedAccountId !== account.id) setDropTargetAccountId(account.id)
        }}
        onDragOver={(event) => {
          if (flatRearrange) {
            event.preventDefault()
            if (draggedAccountId && draggedAccountId !== account.id) setDropTargetAccountId(account.id)
          }
        }}
        onDrop={(event) => {
          if (!flatRearrange) return
          event.preventDefault()
          if (draggedAccountId) reorderAccount(draggedAccountId, account.id)
          setDraggedAccountId(null)
          setDropTargetAccountId(null)
        }}
        onDragEnd={() => {
          if (flatRearrange) setDraggedAccountId(null)
          setDropTargetAccountId(null)
        }}
        ref={flatRearrange ? setAccountCardRef(account.id) : undefined}
        className={cn(
          'reorder-motion relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow animate-fade-up hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          flatRearrange && 'cursor-grab',
          draggedAccountId === account.id && 'is-dragging',
          dropTargetAccountId === account.id && 'is-drop-target'
        )}
        style={{ '--anim-delay': `${Math.min(idx * 60, 480)}ms` } as React.CSSProperties}
        onClick={() => {
          if (!flatRearrange) navigate(`/accounts/${account.id}`)
        }}
        onKeyDown={(event) => {
          if (!flatRearrange && event.target === event.currentTarget && event.key === 'Enter') {
            navigate(`/accounts/${account.id}`)
          }
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
          style={{ backgroundColor: account.color }}
        />
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-stretch gap-2 min-w-0">
              <button
                type="button"
                className={`reorder-handle hidden mt-1 text-muted-foreground cursor-grab rounded-md p-1 hover:bg-muted ${flatRearrange ? 'md:block' : ''}`}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Drag to rearrange ${account.name}`}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <div
                className="rounded-lg shrink-0 px-3 flex items-center justify-center"
                style={{ backgroundColor: account.color + '20', color: account.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">{account.name}</CardTitle>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs w-fit">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </Badge>
                  {account.type === 'credit_card' && reminderLabel && (
                    <Badge
                      variant="outline"
                      className="text-[0.65rem] px-1.5 py-0.5 h-auto"
                    >
                      {reminderLabel}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-xs"
                className={flatRearrange ? 'md:hidden' : 'hidden'}
                onClick={(e) => { e.stopPropagation(); moveAccount(account.id, -1) }}
                disabled={idx === 0}
              >
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className={flatRearrange ? 'md:hidden' : 'hidden'}
                onClick={(e) => { e.stopPropagation(); moveAccount(account.id, 1) }}
                disabled={idx === accounts.length - 1}
              >
                <ArrowDown className="w-3 h-3" />
              </Button>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="money text-[1.375rem] font-bold" style={{ color: account.balance < 0 ? 'var(--destructive)' : 'var(--foreground)' }}>
            {formatCurrency(
              account.type === 'credit_card'
                ? getCreditCardSpending(account)
                : account.type === 'loan'
                  ? getLoanAmountOwed(account)
                  : account.balance,
              account.currency
            )}
          </p>
          {account.type === 'credit_card' && (
            <div className="space-y-1.5 mt-1">
              <p className="text-xs text-muted-foreground">
                {account.balance < 0 ? 'Owed. Subtracted from net worth.' : 'Credit balance. Added to net worth.'}
              </p>
              {account.credit_limit != null && (
                <p className="text-xs text-muted-foreground">
                  Limit: {formatCurrency(account.credit_limit, account.currency)}
                </p>
              )}
            </div>
          )}
          {account.type === 'loan' && (
            <div className="space-y-1.5 mt-1">
              <p className="text-xs text-muted-foreground">Outstanding. Subtracted from net worth.</p>
              {formatLoanSchedule(account) && (
                <p className="text-xs text-muted-foreground">{formatLoanSchedule(account)}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold md:hidden">Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Total net worth: <span className="font-semibold text-foreground">{formatCurrency(balanceSummary.netWorth, defaultCurrency)}</span>
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" size="sm" />}>
            <Plus className="w-4 h-4" />Add Account
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto sm:max-h-[90vh]">
            <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
            {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
            <AccountForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} defaultValues={{ currency: defaultCurrency }} />
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{prefs.accView === 'grouped' ? 'Grouped by account type' : 'Flat account view'}</p>
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
        </div>
      )}

      {loadState === 'stale-error' && (
        <InlineLoadError message="Couldn't refresh your accounts. Showing what was last loaded." onRetry={() => void refetch()} />
      )}
      {loadState === 'error' ? (
        <ErrorState title="Couldn't load your accounts" detail={error} onRetry={() => void refetch()} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to get started"
        />
      ) : prefs.accView === 'flat' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, idx) => renderAccountCard(account, idx, { flatRearrange: rearrangeMode }))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedAccounts.map(([type, groupAccounts], groupIndex) => (
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
                    onClick={() => moveGroup(type, -1)}
                    disabled={groupIndex === 0}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={rearrangeMode ? 'md:hidden' : 'hidden'}
                    onClick={() => moveGroup(type, 1)}
                    disabled={groupIndex === groupedAccounts.length - 1}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {groupAccounts.length} account{groupAccounts.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupAccounts.map((account, idx) => renderAccountCard(account, idx))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editAccount} onOpenChange={(o) => { if (!o) { setEditAccount(null); setFormError(null) } }}>
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
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
