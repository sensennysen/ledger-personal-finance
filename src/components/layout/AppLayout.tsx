import { useEffect, useRef, useState } from 'react'
import { isNearScrollEnd } from '@/lib/scrollEnd'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import {
  Tag,
  FileBarChart2,
  Settings,
  Plus,
  LogOut,
  CalendarDays,
} from 'lucide-react'
import { TopBar } from './TopBar'
import { PageHeader } from './PageHeader'
import BottomNav from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { QueueReviewSheet } from './QueueReviewSheet'
import { PWAInstallBanner } from './PWAInstallBanner'
import { resolveHeaderMeta } from '@/lib/pageChrome'
import { CycleProvider } from '@/contexts/CycleContext'
import { EntryContext, type EntryActions } from '@/contexts/EntryContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { InlineLoadError } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { authErrorActionLabel } from '@/lib/authErrors'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useFirstRunChecklist } from '@/hooks/useFirstRunChecklist'
import { isSetupComplete } from '@/lib/firstRunChecklist'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  TransactionForm,
  type TransactionFormValues,
} from '@/components/transactions/TransactionForm'
import { QuickEntry } from '@/components/transactions/QuickEntry'
import {
  TRANSACTION_KIND_DIALOG_TITLES,
  type TransactionKind,
} from '@/components/transactions/transactionKinds'
import { SearchPalette } from '@/components/search/SearchPalette'
import { EntryDetail } from '@/components/transactions/EntryDetail'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreditCardNotifications } from '@/hooks/useCreditCardNotifications'
import type { Transaction } from '@/types'

export type AppLayoutContext = {
  /** `targetAccountId` locks the card or loan for card-payment and loan-repayment. */
  openAddTransactionModal: (kind: TransactionKind, options?: { targetAccountId?: string }) => void
}
export default function AppLayout() {
  return (
    <CycleProvider>
      <NotificationProvider>
        <LayoutShell />
      </NotificationProvider>
    </CycleProvider>
  )
}
function LayoutShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile, authError } = useAuth()
  const mobile = useMediaQuery('(max-width: 767px)')
  // At 1920 the capped page leaves room for a docked detail column; below it
  // the column would squeeze the list, so detail overlays instead (LED-99).
  const wide = useMediaQuery('(min-width: 1920px)')
  const networkStatus = useNetworkStatus()
  const { isOnline, pendingCount } = networkStatus
  const { transactions, loading: transactionsLoading, generateDueRecurring, createTransaction } = useTransactions()
  const { accounts, loading: accountsLoading } = useAccounts()
  // ⌘F in search scopes to the account page it opened over.
  const accountRouteId = useMatch('/accounts/:accountId')?.params.accountId
  const routeAccount = accounts.find((account) => account.id === accountRouteId)
  const currentAccount = routeAccount ? { id: routeAccount.id, name: routeAccount.name } : null
  const { cycleConfirmed } = useFirstRunChecklist()
  const setupComplete = isSetupComplete(
    {
      hasAccount: accounts.length > 0,
      hasTransaction: transactions.length > 0,
      cycleConfirmed,
    },
    { loading: accountsLoading || transactionsLoading },
  )
  const hasGenerated = useRef(false)
  const [sheet, setSheet] = useState<'add' | 'account' | 'detail' | null>(null)
  const [transactionKind, setTransactionKind] =
    useState<TransactionKind>('expense')
  const [targetAccountId, setTargetAccountId] = useState<string | undefined>()
  const [entry, setEntry] = useState<{
    transaction: Transaction
    actions?: EntryActions
  } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [fabHidden, setFabHidden] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  // Where focus returns when the add/account dialog or entry detail closes
  // (LED-91). The FAB unmounts while a sheet is open, so it is remembered by
  // name and found again through its ref.
  const fabRef = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLElement | 'fab' | null>(null)
  const rememberTrigger = () => {
    const active = document.activeElement
    trigger.current =
      active === fabRef.current
        ? 'fab'
        : active instanceof HTMLElement && active !== document.body
          ? active
          : null
  }
  const triggerFocus = () => {
    const target = trigger.current
    if (target === 'fab') return fabRef.current ?? true
    return target?.isConnected ? target : true
  }
  const syncFab = () => {
    if (mainRef.current) setFabHidden(isNearScrollEnd(mainRef.current))
  }
  const [formError, setFormError] = useState<string | null>(null)
  useEffect(() => {
    if (sheet !== 'detail' || !wide) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [sheet, wide])
  // The desktop detail pane is not a dialog, so it moves focus by hand:
  // heading on open, back to the row that opened it on close (LED-91).
  const detailPane = wide && sheet === 'detail' && !!entry
  const detailHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!detailPane) return
    detailHeading.current?.focus()
    return () => {
      const target = triggerFocus()
      if (target !== true) target.focus()
    }
  }, [detailPane])
  // Re-check when the page changes or its content grows (async loads).
  useEffect(() => {
    const main = mainRef.current
    const content = main?.firstElementChild
    if (!main || !content) return
    const sync = () => setFabHidden(isNearScrollEnd(main))
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(content)
    return () => observer.disconnect()
  }, [location.pathname])
  const touchStart = useRef<number | null>(null)
  const openAddTransactionModal = (kind: TransactionKind, options?: { targetAccountId?: string }) => {
    rememberTrigger()
    setFormError(null)
    setTransactionKind(kind)
    setTargetAccountId(options?.targetAccountId)
    setSheet('add')
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useCreditCardNotifications()
  useEffect(() => {
    if (!hasGenerated.current) {
      hasGenerated.current = true
      void generateDueRecurring()
    }
  }, [generateDueRecurring])
  const handleCreate = async (values: TransactionFormValues) => {
    const { error } = await createTransaction(
      values as Parameters<typeof createTransaction>[0],
    )
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setSheet(null)
  }
  const name = profile?.full_name ?? user?.email ?? 'Your account'
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const avatar = (
    <Avatar className="size-10">
      <AvatarImage src={profile?.avatar_url ?? undefined} />
      <AvatarFallback className="bg-accent text-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
  // Every action closes detail first, then hands off to the page that owns it.
  const closeThen = (action?: () => void) =>
    action
      ? () => {
          setSheet(null)
          action()
        }
      : undefined
  const entryDetail = entry && (
    <ErrorBoundary key={entry.transaction.id}>
      <EntryDetail
        transaction={entry.transaction}
        onEdit={closeThen(entry.actions?.onEdit)}
        onDelete={closeThen(entry.actions?.onDelete)}
        onSplit={closeThen(entry.actions?.onSplit)}
      />
    </ErrorBoundary>
  )
  const title =
    sheet === 'account'
      ? 'Your account'
      : TRANSACTION_KIND_DIALOG_TITLES[transactionKind]
  return (
    <EntryContext.Provider
      value={(transaction, actions) => {
        rememberTrigger()
        setEntry({ transaction, actions })
        setSheet('detail')
      }}
    >
      <div className="flex h-dvh w-full max-w-full flex-col bg-background overflow-hidden pt-[env(safe-area-inset-top)] md:pt-0">
        {/* First tab stop: jumps past the bar and row 2 (LED-90). Focus is
            moved by hand so the URL keeps no #main. */}
        <a
          href="#main"
          onClick={(event) => {
            event.preventDefault()
            mainRef.current?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-60 focus:flex focus:h-10 focus:items-center focus:rounded-full focus:bg-popover focus:px-4 focus:text-sm focus:font-medium focus:text-popover-foreground focus:shadow-lg focus-visible:ring-3 focus-visible:ring-ring"
        >
          Skip to content
        </a>
        <TopBar
          avatar={avatar}
          onAvatarClick={() => {
            rememberTrigger()
            setSheet('account')
          }}
          onSearch={() => setSearchOpen(true)}
          setupComplete={setupComplete}
          mobileTitle={
            location.pathname === '/'
              ? 'Good day, ' + (profile?.full_name?.split(' ')[0] ?? 'there')
              : resolveHeaderMeta(location.pathname).title
          }
          mobileStatus={
            !isOnline
              ? 'Working offline'
              : pendingCount
                ? pendingCount + ' changes pending'
                : 'Your money, at a glance'
          }
        />
        <PageHeader />
        <div className="flex flex-1 min-h-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <OfflineBanner status={networkStatus} onReview={() => setReviewOpen(true)} />
          <QueueReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} status={networkStatus} />
          {authError && (
            <div className="shrink-0 px-4 pt-3 md:px-6">
              <InlineLoadError
                message={authError.message}
                actionLabel={authErrorActionLabel(authError.kind)}
                onRetry={() => {
                  if (authError.kind === 'signout') void signOut()
                  else if (authError.kind === 'profile') void refreshProfile()
                  else window.location.reload()
                }}
              />
            </div>
          )}
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            onScroll={syncFab}
            className="outline-none flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0"
          >
            <div
              key={location.pathname}
              className="animate-page-in min-h-full min-w-0 w-full max-w-full"
            >
              <ErrorBoundary>
                <Outlet context={{ openAddTransactionModal }} />
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <div
          id="dashboard-detail-pane"
          className={cn(
            'hidden lg:flex shrink-0 empty:hidden',
            wide && sheet === 'detail' && 'lg:hidden',
          )}
        />
        {wide && sheet === 'detail' && entry && (
          <aside
            aria-label="Entry detail"
            className="relative w-[340px] shrink-0 border-l border-border bg-sidebar p-5 overflow-y-auto animate-page-in"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 ref={detailHeading} tabIndex={-1} className="font-medium outline-none">
                Entry detail
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close entry details"
                onClick={() => setSheet(null)}
              >
                <X />
              </Button>
            </div>
            {entryDetail}
          </aside>
        )}
        </div>
        {/* The FAB comes before the nav in the DOM, so Tab reaches the page's
            primary action before Home (27a). */}
        {mobile && !sheet && location.pathname !== '/settings' && (
          <button
            ref={fabRef}
            aria-label="Add transaction"
            onClick={() => openAddTransactionModal('expense')}
            aria-hidden={fabHidden}
            tabIndex={fabHidden ? -1 : 0}
            className={cn(
              'fixed right-4 bottom-[calc(104px+env(safe-area-inset-bottom))] z-30 size-16 rounded-[20px] bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(0,0,0,.45)] flex items-center justify-center transition-opacity duration-(--dur-base)',
              fabHidden && 'opacity-0 pointer-events-none',
            )}
          >
            <Plus className="size-7" />
          </button>
        )}
        <BottomNav setupComplete={setupComplete} />
        <PWAInstallBanner hidden={sheet !== null} />
        <SearchPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          mobile={mobile}
          onAddTransaction={openAddTransactionModal}
          currentAccount={currentAccount}
        />
        <Sheet
          open={!wide && sheet === 'detail' && !!entry}
          onOpenChange={(open) => {
            if (!open) setSheet(null)
          }}
        >
          {/* Detail is its own surface at every width, never the add/edit
              modal (LED-79): bottom sheet on phones, side sheet above. */}
          <SheetContent
            finalFocus={triggerFocus}
            side={mobile ? 'bottom' : 'right'}
            className={cn(
              'overflow-y-auto',
              mobile
                ? 'max-h-[85dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]'
                : 'w-[380px] sm:max-w-[380px]',
            )}
          >
            <SheetHeader className="pb-0">
              <SheetTitle>Entry detail</SheetTitle>
            </SheetHeader>
            {entry && (
              <div className="px-4 pb-4">
                {entryDetail}
              </div>
            )}
          </SheetContent>
        </Sheet>
        <Dialog
          open={sheet === 'add' || sheet === 'account'}
          onOpenChange={(open) => {
            if (!open) {
              setSheet(null)
              setFormError(null)
            }
          }}
        >
          <DialogContent
            finalFocus={triggerFocus}
            className={cn(
              'max-w-md max-h-[90dvh] overflow-y-auto',
              mobile && 'm3-bottom-sheet',
            )}
          >
            {mobile && (
              <div
                className="flex justify-center h-5 touch-none"
                onTouchStart={(event) => {
                  touchStart.current = event.touches[0].clientY
                }}
                onTouchEnd={(event) => {
                  if (
                    touchStart.current !== null &&
                    event.changedTouches[0].clientY - touchStart.current >
                      event.currentTarget.parentElement!.clientHeight * 0.25
                  )
                    setSheet(null)
                  touchStart.current = null
                }}
              >
                <span className="h-1 w-8 rounded-full bg-muted-foreground/50" />
              </div>
            )}
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {formError && (
              <p role="alert" className="text-sm text-expense">
                {formError}
              </p>
            )}
            {sheet === 'add' &&
              (mobile ? (
                <QuickEntry
                  initialKind={transactionKind}
                  targetAccountId={targetAccountId}
                  onSubmit={handleCreate}
                  onClose={() => setSheet(null)}
                />
              ) : (
                <TransactionForm
                  entryKind={transactionKind}
                  lockedCardAccountId={transactionKind === 'card-payment' ? targetAccountId : undefined}
                  lockedLoanAccountId={transactionKind === 'loan-repayment' ? targetAccountId : undefined}
                  onSubmit={handleCreate}
                  onClose={() => setSheet(null)}
                />
              ))}
            {sheet === 'account' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  {avatar}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isOnline ? pendingCount + ' pending changes' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Reports', to: '/reports', icon: FileBarChart2 },
                    { label: 'Categories', to: '/categories', icon: Tag },
                    {
                      label: '13th Month',
                      to: '/thirteenth-month',
                      icon: CalendarDays,
                    },
                    { label: 'Settings', to: '/settings', icon: Settings },
                  ].map(({ label, to, icon: Icon }) => (
                    <button
                      key={to}
                      onClick={() => {
                        setSheet(null)
                        navigate(to)
                      }}
                      className="bg-card rounded-[18px] py-4 flex flex-col items-center gap-2 text-[11px]"
                    >
                      <Icon className="size-5 text-transfer" />
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => void signOut().then((ok) => { if (!ok) setSheet(null) })}
                  className="w-full text-expense"
                >
                  <LogOut />
                  Sign out
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EntryContext.Provider>
  )
}
