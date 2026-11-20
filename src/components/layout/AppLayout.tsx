import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { hiddenByScroll, isNearScrollEnd } from '@/lib/scrollEnd'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import {
  Tag,
  FileBarChart2,
  Settings,
  Plus,
  LogOut,
  CalendarDays,
  ReceiptText,
  Zap,
} from 'lucide-react'
import { TopBar } from './TopBar'
import { PageHeader } from './PageHeader'
import BottomNav from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { QueueReviewSheet } from './QueueReviewSheet'
import { PWAInstallBanner } from './PWAInstallBanner'
import { resolveHeaderMeta } from '@/lib/pageChrome'
import { CycleProvider } from '@/contexts/CycleContext'
import { Skeleton } from '@/components/ui/skeleton'
import { useCycle } from '@/contexts/cycleState'
import { buildMonthNets } from '@/lib/monthJump'
import { cn, getCurrentCycleMonthKey } from '@/lib/utils'
import { MonthJumpSheet } from '@/components/transactions/MonthJump'
import { EntryContext, type EntryActions } from '@/contexts/EntryContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useNotify } from '@/contexts/notificationState'
import { useAuth } from '@/contexts/AuthContext'
import { InlineLoadError } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { FormError } from '@/components/ui/form-error'
import type { FormErrorValue } from '@/lib/dataErrors'
import { authErrorActionLabel } from '@/lib/authErrors'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTransactions } from '@/hooks/useTransactions'
import { useCardPayment } from '@/hooks/useCardPayment'
import { useAccounts } from '@/hooks/useAccounts'
import { useFirstRunChecklist } from '@/hooks/useFirstRunChecklist'
import { isNavUnlocked } from '@/lib/firstRunChecklist'
import { recurringRunNotice } from '@/lib/recurringTransactions'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { NetworkStatusProvider } from '@/contexts/NetworkStatusContext'
import { useSignOut } from '@/hooks/useSignOut'
import { useReceiptSweep } from '@/hooks/useReceiptSweep'
import { SignOutConfirm } from '@/components/layout/SignOutConfirm'
import { ExitConfirm } from '@/components/layout/ExitConfirm'
import { useExitGuard } from '@/hooks/useExitGuard'
import { ExchangeRatesProvider } from '@/contexts/ExchangeRatesContext'
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
import { TransactionEntryHeader } from '@/components/transactions/TransactionEntryHeader'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import { entryDialogWidthClass, type TransactionKind } from '@/components/transactions/transactionKinds'
import { SearchPalette } from '@/components/search/SearchPalette'
import { EntryDetail } from '@/components/transactions/EntryDetail'
import { X } from 'lucide-react'
import { useCreditCardNotifications } from '@/hooks/useCreditCardNotifications'
import { QuickLogForm } from '@/components/transactions/QuickLogForm'
import { QuickLogIntro } from '@/components/transactions/QuickLogIntro'
import { ReceiptCaptureForm } from '@/components/transactions/ReceiptCaptureForm'
import { transactionSchema } from '@/components/transactions/transactionFormSchema'
import { usePreferences } from '@/hooks/usePreferences'
import { saveQuickLogDraft, type QuickLogDraft } from '@/hooks/useQuickLogDrafts'
import type { QuickLogResolution, QuickLogSource } from '@/lib/quickLog'
import type { Transaction } from '@/types'

export type AddTransactionOptions = {
  targetAccountId?: string
  categoryId?: string
  prefill?: { amount: number; date: string }
}

export type AppLayoutContext = {
  /** `targetAccountId` locks the card or loan for card-payment and loan-repayment. */
  /** `categoryId` opens the form with that category chosen (search: "New expense in Groceries"). */
  /** `prefill` opens it with an amount and date (Home: Pay now on a loan bill). */
  openAddTransactionModal: (kind: TransactionKind, options?: AddTransactionOptions) => void
  openQuickLog: () => void
  openReceiptCapture: (accountId?: string) => void
  openQuickLogDraft: (draft: QuickLogDraft) => void
  /** Advisory locks (More's destinations follow the nav's). */
  setupComplete: boolean
}
export default function AppLayout() {
  return (
    <CycleProvider>
      <NotificationProvider>
        <NetworkStatusProvider>
          <ExchangeRatesProvider>
            <LayoutShell />
          </ExchangeRatesProvider>
        </NetworkStatusProvider>
      </NotificationProvider>
    </CycleProvider>
  )
}
function LayoutShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile, syncSettings, authError } = useAuth()
  const mobile = useMediaQuery('(max-width: 767px)')
  // At 1920 the capped page leaves room for a docked detail column; below it
  // the column would squeeze the list, so detail overlays instead (LED-99).
  const wide = useMediaQuery('(min-width: 1920px)')
  const networkStatus = useNetworkStatus()
  const { isOnline, pendingCount } = networkStatus
  useReceiptSweep()
  const exitGuard = useExitGuard()
  const { transactions, loading: transactionsLoading, generateDueRecurring, createTransaction, deleteTransaction } = useTransactions()
  const { createWithStatement } = useCardPayment(createTransaction)
  const notify = useNotify()
  const { formatAmount, prefs, set: setPreference } = usePreferences()
  const { accounts, loading: accountsLoading } = useAccounts()
  // ⌘F in search scopes to the account page it opened over.
  const accountRouteId = useMatch('/accounts/:accountId')?.params.accountId
  const routeAccount = accounts.find((account) => account.id === accountRouteId)
  const currentAccount = routeAccount ? { id: routeAccount.id, name: routeAccount.name } : null
  const { cycleConfirmed, dismissed } = useFirstRunChecklist()
  // "Skip setup" unlocks the nav too; only the checklist cares about real completion.
  const setupComplete = isNavUnlocked(
    {
      hasAccount: accounts.length > 0,
      hasTransaction: transactions.length > 0,
      cycleConfirmed,
      dismissed,
    },
    { loading: accountsLoading || transactionsLoading },
  )
  const hasGenerated = useRef(false)
  const [sheet, setSheet] = useState<'add' | 'account' | 'detail' | null>(null)
  const sheetSignOut = useSignOut((ok) => { if (!ok) setSheet(null) })
  const [transactionKind, setTransactionKind] =
    useState<TransactionKind>('expense')
  const [targetAccountId, setTargetAccountId] = useState<string | undefined>()
  const [prefillCategoryId, setPrefillCategoryId] = useState<string | undefined>()
  const [prefill, setPrefill] = useState<AddTransactionOptions['prefill']>()
  const [quickLogStep, setQuickLogStep] = useState<'intro' | 'form' | 'receipt' | null>(null)
  const [manualPhrase, setManualPhrase] = useState<string | null>(null)
  const [quickLogDraft, setQuickLogDraft] = useState<QuickLogDraft | null>(null)
  const [entry, setEntry] = useState<{
    transaction: Transaction
    actions?: EntryActions
  } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const reviewTrigger = useRef<HTMLElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [fabHidden, setFabHidden] = useState(false)
  // Phones jump months from the cycle dates under the header (M-04). Built
  // from the shell's own transactions, only while the sheet is open.
  const { startDay, selectedMonth, setSelectedMonth } = useCycle()
  const [monthsOpen, setMonthsOpen] = useState(false)
  const months = useMemo(
    () =>
      monthsOpen
        ? buildMonthNets(transactions, { startDay, currentKey: getCurrentCycleMonthKey(startDay) })
        : [],
    [monthsOpen, transactions, startDay],
  )
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
  // Hidden at the end of a list (it would cover the last row) and while scrolling down (decision D).
  const lastScrollTop = useRef(0)
  const scrollHidden = useRef(false)
  const syncFab = () => {
    const main = mainRef.current
    if (!main) return
    scrollHidden.current = hiddenByScroll(lastScrollTop.current, main.scrollTop, scrollHidden.current)
    lastScrollTop.current = main.scrollTop
    setFabHidden(scrollHidden.current || isNearScrollEnd(main))
  }
  const [formError, setFormError] = useState<FormErrorValue>(null)
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
    // A new page starts at the top, so a hide from scrolling the last one does not carry over.
    scrollHidden.current = false
    lastScrollTop.current = main.scrollTop
    const sync = () => setFabHidden(scrollHidden.current || isNearScrollEnd(main))
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(content)
    return () => observer.disconnect()
  }, [location.pathname])
  const touchStart = useRef<number | null>(null)
  const openAddTransactionModal = (kind: TransactionKind, options?: AddTransactionOptions) => {
    rememberTrigger()
    setFormError(null)
    setTransactionKind(kind)
    setTargetAccountId(options?.targetAccountId)
    setPrefillCategoryId(options?.categoryId)
    setPrefill(options?.prefill)
    setQuickLogStep(null)
    setQuickLogDraft(null)
    setManualPhrase(null)
    setSheet('add')
  }
  const openQuickLog = () => {
    openAddTransactionModal('expense')
    setQuickLogStep(prefs.quickLogIntroSeen ? 'form' : 'intro')
  }
  const openReceiptCapture = (accountId?: string) => {
    openAddTransactionModal('expense', { targetAccountId: accountId })
    setQuickLogStep('receipt')
  }
  const openQuickLogDraft = (draft: QuickLogDraft) => {
    const kind = draft.kind === 'income' || draft.kind === 'transfer'
      || draft.kind === 'card-payment' || draft.kind === 'loan-repayment' ? draft.kind : 'expense'
    openAddTransactionModal(kind)
    setQuickLogDraft(draft)
  }
  const finishQuickLogIntro = () => {
    setPreference('quickLogIntroSeen', true)
    setQuickLogStep('form')
    requestAnimationFrame(() => document.getElementById('quick-log-phrase')?.focus())
  }
  const openQuickLogSettings = () => {
    setPreference('quickLogIntroSeen', true)
    setQuickLogStep(null)
    setSheet(null)
    navigate('/settings#quick-log')
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
    if (hasGenerated.current) return
    hasGenerated.current = true
    // A recurring row that could not be posted, or a failed read of them, is reported with Retry,
    // not skipped silently (LED-232).
    const run = async () => {
      const notice = recurringRunNotice(await generateDueRecurring())
      if (!notice) return
      notify({ severity: 'failure', ...notice, action: { label: 'Retry', run: () => void run() } })
    }
    void run()
  }, [generateDueRecurring, notify])
  const handleCreate = async (values: TransactionFormValues) => {
    const result = quickLogDraft
      ? await createWithStatement({ ...values, entry_source: quickLogDraft.entry_source ?? 'ai_phrase', reviewed_at: new Date().toISOString() }, quickLogDraft.id)
      : await createWithStatement(values)
    const { error, errorDetail } = result
    if (error) {
      setFormError({ message: error, detail: errorDetail ?? null })
      return
    }
    if (quickLogDraft && result.id) announceQuickLog(values, result.id, result.queued)
    setFormError(null)
    setSheet(null)
  }
  const announceQuickLog = (values: TransactionFormValues, id: string, queued?: boolean) => {
    const source = accounts.find((account) => account.id === values.account_id)
    const destination = accounts.find((account) => account.id === values.to_account_id)
    const amount = formatAmount(values.amount, values.currency)
    const body = values.type === 'transfer' && destination
      ? `${source?.name ?? 'From account'} · ${amount} → ${destination.name} · ${formatAmount(values.destination_amount ?? values.amount, destination.currency)}`
      : `${amount} · ${source?.name ?? values.description}`
    notify({
      severity: 'success', title: queued ? 'Transaction queued' : 'Transaction saved', body,
      action: { label: 'Undo', run: () => {
        void deleteTransaction(id).then((result) => notify(result.error
          ? { severity: 'failure', title: 'Could not undo transaction', body: result.error }
          : { severity: 'success', title: result.queued ? 'Undo queued' : 'Transaction undone' }))
      } },
    })
  }
  const saveQuickLog = async (draft: QuickLogResolution, phrase: string, id: string, entrySource: QuickLogSource = 'ai_phrase') => {
    if (!draft.ready) {
      const error = await saveQuickLogDraft(draft, phrase, id, entrySource)
      if (error) return error
      notify({
        severity: 'success', title: 'Saved for review', body: draft.reason,
        action: { label: 'Needs review', run: () => navigate('/transactions?review=needed') },
      })
      return null
    }
    const validated = transactionSchema.safeParse(draft.values)
    if (!validated.success) return 'Ledger could not save this transaction.'
    const result = await createTransaction({
      ...validated.data, entry_source: entrySource, reviewed_at: null, destination_currency: draft.destinationCurrency,
    }, id)
    if (result.error) return result.error
    if (!result.id) return 'Ledger could not confirm that the transaction was saved.'
    announceQuickLog(validated.data, result.id, result.queued)
    return null
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
  const mobileAvatar = (
    <Avatar className="size-9">
      <AvatarImage src={profile?.avatar_url ?? undefined} />
      <AvatarFallback className="bg-accent text-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
  const headerMeta = resolveHeaderMeta(location.pathname, location.search)
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
        onSaveTemplate={closeThen(entry.actions?.onSaveTemplate)}
        onMarkReviewed={closeThen(entry.actions?.onMarkReviewed)}
      />
    </ErrorBoundary>
  )
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
          mobileAvatar={mobileAvatar}
          onAvatarClick={() => {
            rememberTrigger()
            setSheet('account')
          }}
          onSearch={() => setSearchOpen(true)}
          setupComplete={setupComplete}
          mobileTitle={
            location.pathname === '/'
              ? 'Good day, ' + (profile?.full_name?.split(' ')[0] ?? 'there')
              : headerMeta.title
          }
          titleIsHeading={headerMeta.titleIsHeading}
        />
        <PageHeader onOpenMonths={() => setMonthsOpen(true)} />
        <MonthJumpSheet
          open={monthsOpen}
          onOpenChange={setMonthsOpen}
          months={months}
          activeKey={selectedMonth}
          onPick={(key) => {
            setSelectedMonth(key)
            // Not scrollIntoView: it moves Chrome's focus starting point (LED-155).
            if (mainRef.current) mainRef.current.scrollTop = 0
          }}
        />
        <div className="flex flex-1 min-h-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <OfflineBanner
            status={networkStatus}
            onReview={() => {
              reviewTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
              setReviewOpen(true)
            }}
          />
          <QueueReviewSheet
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            status={networkStatus}
            // Resolving the last flagged item removes the banner and its Review button. Focus the
            // main region then, as the skip link does: handed `main`, base-ui would move on to its
            // first field, which on a phone opens the keyboard (LED-179).
            finalFocus={() => {
              if (reviewTrigger.current?.isConnected) return reviewTrigger.current
              requestAnimationFrame(() => mainRef.current?.focus())
              return false
            }}
          />
          {authError && (
            <div className="shrink-0 px-4 pt-3 md:px-6">
              <InlineLoadError
                message={authError.message}
                actionLabel={authErrorActionLabel(authError.kind)}
                onRetry={() => {
                  if (authError.kind === 'signout') void signOut()
                  else if (authError.kind === 'profile') void refreshProfile()
                  else if (authError.kind === 'settings') void syncSettings()
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
            className="outline-none flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0"
          >
            <div
              key={location.pathname}
              className="animate-page-in min-h-full min-w-0 w-full max-w-full"
            >
              <ErrorBoundary>
                {/* A page's code arrives on first open (LED-317); the shell stays and the page area waits. */}
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet context={{ openAddTransactionModal, openQuickLog, openReceiptCapture, openQuickLogDraft, setupComplete } satisfies AppLayoutContext} />
                </Suspense>
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
            className="relative w-[380px] shrink-0 border-l border-border bg-sidebar p-5 overflow-y-auto animate-page-in"
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
        {/* One size, one position (M-09). The FAB comes before the nav in the DOM, so Tab reaches the page's
            primary action before Home (27a). */}
        {mobile && !sheet && location.pathname !== '/settings' && location.pathname !== '/more' && (
          // Same action as the page's Add button: pick a kind, then the entry dialog.
          <TransactionKindMenu
            onQuickLog={() => { openQuickLog(); trigger.current = 'fab' }}
            onCaptureReceipt={() => {
              openReceiptCapture(routeAccount?.is_active && routeAccount.type !== 'loan' ? routeAccount.id : undefined)
              trigger.current = 'fab'
            }}
            onSelect={(kind) => {
              openAddTransactionModal(kind)
              trigger.current = 'fab'
            }}
            trigger={
              <button
                ref={fabRef}
                aria-label="Add transaction"
                aria-hidden={fabHidden}
                tabIndex={fabHidden ? -1 : 0}
                className={cn(
                  'fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 size-14 rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(0,0,0,.3)] flex items-center justify-center transition-opacity duration-(--dur-base)',
                  fabHidden && 'opacity-0 pointer-events-none',
                )}
              >
                <Plus className="size-6" />
              </button>
            }
          />
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
            // Add matches the Activity page's entry dialog; only the account sheet is a bottom sheet.
            className={cn(
              sheet === 'add'
                ? `max-h-[calc(var(--vv-height,100dvh)-0.75rem)] ${entryDialogWidthClass(transactionKind)} overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4`
                : 'max-h-[calc(var(--vv-height,100dvh)*0.9)] max-w-md overflow-y-auto',
              // translate-*-0 drops the dialog's centering translate here: the production
              // minifier folds the CSS's `translate: none` into `transform`, so it can't.
              mobile && sheet === 'account' && 'm3-bottom-sheet translate-x-0 translate-y-0',
            )}
          >
            {mobile && sheet === 'account' && (
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
            {sheet === 'add' && quickLogStep === 'intro' ? (
              <QuickLogIntro onContinue={finishQuickLogIntro} onSettings={openQuickLogSettings} />
            ) : sheet === 'add' && (quickLogStep === 'form' || quickLogStep === 'receipt') ? (
              <DialogHeader className="flex-row items-center gap-3 pr-8">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {quickLogStep === 'receipt' ? <ReceiptText className="size-5" aria-hidden /> : <Zap className="size-5" aria-hidden />}
                </span>
                <DialogTitle>{quickLogStep === 'receipt' ? 'Capture Receipt' : 'Quick Log'}</DialogTitle>
              </DialogHeader>
            ) : sheet === 'add' ? (
              <TransactionEntryHeader kind={transactionKind} onChangeKind={setTransactionKind} />
            ) : (
              <DialogHeader>
                <DialogTitle>Your account</DialogTitle>
              </DialogHeader>
            )}
            <FormError error={formError} className="px-0 mt-0" />
            {sheet === 'add' && quickLogStep === 'form' && (
              <QuickLogForm
                online={isOnline}
                onManual={(phrase) => {
                  setManualPhrase(phrase.trim())
                  setQuickLogStep(null)
                }}
                onSave={saveQuickLog}
                onSaved={() => setSheet(null)}
              />
            )}
            {sheet === 'add' && quickLogStep === 'receipt' && (
              <ReceiptCaptureForm
                online={isOnline}
                initialAccountId={targetAccountId}
                onSave={(draft, label, id) => saveQuickLog(draft, label, id, 'ai_receipt')}
                onSaved={() => setSheet(null)}
              />
            )}
            {sheet === 'add' && quickLogDraft && (
              <p className="break-words rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{quickLogDraft.entry_source === 'ai_receipt' ? 'Captured receipt' : 'Quick Log phrase'}</span>
                {' · '}{quickLogDraft.entry_source === 'ai_receipt' ? quickLogDraft.reason : quickLogDraft.phrase}
              </p>
            )}
            {sheet === 'add' && quickLogStep === null && (
              <TransactionForm
                entryKind={transactionKind}
                lockedCardAccountId={transactionKind === 'card-payment' ? targetAccountId : undefined}
                lockedLoanAccountId={transactionKind === 'loan-repayment' ? targetAccountId : undefined}
                defaultValues={quickLogDraft ? {
                  description: quickLogDraft.description ?? quickLogDraft.phrase,
                  account_id: quickLogDraft.account_id ?? '',
                  to_account_id: quickLogDraft.to_account_id,
                  category_id: quickLogDraft.category_id,
                  subcategory_id: quickLogDraft.subcategory_id,
                  amount: quickLogDraft.amount ?? 0,
                  currency: quickLogDraft.currency ?? profile?.default_currency,
                  date: quickLogDraft.transaction_date ?? '',
                  destination_amount: quickLogDraft.destination_amount,
                  transfer_fee: quickLogDraft.transfer_fee,
                  notes: quickLogDraft.notes ?? null,
                  receipt_url: quickLogDraft.receipt_url ?? null,
                } : (manualPhrase !== null
                  ? { description: manualPhrase }
                  : prefillCategoryId || prefill ? { ...(prefillCategoryId ? { category_id: prefillCategoryId } : {}), ...prefill } : undefined)}
                quickLogReview={quickLogDraft ? { destinationCurrency: quickLogDraft.destination_currency } : undefined}
                onSubmit={handleCreate}
                onClose={() => setSheet(null)}
              />
            )}
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
                {/* Phones reach these from More (M-02); the grid stays above md. */}
                {mobile ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSheet(null)
                      navigate('/more')
                    }}
                  >
                    All settings
                  </Button>
                ) : (
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
                )}
                <Button
                  variant="outline"
                  onClick={sheetSignOut.request}
                  className="w-full text-expense"
                >
                  <LogOut />
                  Sign out
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <SignOutConfirm {...sheetSignOut.confirm} />
        <ExitConfirm {...exitGuard} />
      </div>
    </EntryContext.Provider>
  )
}

/** The page area while a page's code downloads: the page's own layout is not known yet, so plain cards. */
function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-32 rounded-[20px]" />
      <Skeleton className="h-64 rounded-[20px]" />
      <Skeleton className="h-48 rounded-[20px]" />
    </div>
  )
}
