import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
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
import { EntryContext } from '@/contexts/EntryContext'
import { useAuth } from '@/contexts/AuthContext'
import { InlineLoadError } from '@/components/ui/error-state'
import { authErrorActionLabel } from '@/lib/authErrors'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTransactions } from '@/hooks/useTransactions'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { EntryDetail } from '@/components/transactions/EntryDetail'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreditCardNotifications } from '@/hooks/useCreditCardNotifications'
import type { Transaction } from '@/types'

export type AppLayoutContext = {
  openAddTransactionModal: (kind: TransactionKind) => void
}
export default function AppLayout() {
  return (
    <CycleProvider>
      <LayoutShell />
    </CycleProvider>
  )
}
function LayoutShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile, authError } = useAuth()
  const mobile = useMediaQuery('(max-width: 767px)')
  const desktop = useMediaQuery('(min-width: 1024px)')
  const networkStatus = useNetworkStatus()
  const { isOnline, pendingCount } = networkStatus
  const { generateDueRecurring, createTransaction } = useTransactions()
  const hasGenerated = useRef(false)
  const [sheet, setSheet] = useState<'add' | 'account' | 'detail' | null>(null)
  const [transactionKind, setTransactionKind] =
    useState<TransactionKind>('expense')
  const [entry, setEntry] = useState<{
    transaction: Transaction
    onEdit?: () => void
  } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  useEffect(() => {
    if (sheet !== 'detail' || !desktop) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [sheet, desktop])
  const touchStart = useRef<number | null>(null)
  const openAddTransactionModal = (kind: TransactionKind) => {
    setFormError(null)
    setTransactionKind(kind)
    setSheet('add')
  }
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
  const title =
    sheet === 'account'
      ? 'Your account'
      : sheet === 'detail'
        ? 'Entry detail'
        : TRANSACTION_KIND_DIALOG_TITLES[transactionKind]
  return (
    <EntryContext.Provider
      value={(transaction, onEdit) => {
        setEntry({ transaction, onEdit })
        setSheet('detail')
      }}
    >
      <div className="flex h-dvh w-full max-w-full flex-col bg-background overflow-hidden pt-[env(safe-area-inset-top)] md:pt-0">
        <TopBar
          avatar={avatar}
          onAvatarClick={() => setSheet('account')}
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
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
            <div
              key={location.pathname}
              className="animate-page-in min-h-full min-w-0 w-full max-w-full"
            >
              <Outlet context={{ openAddTransactionModal }} />
            </div>
          </main>
        </div>
        <div
          id="dashboard-detail-pane"
          className={cn(
            'hidden lg:flex shrink-0 empty:hidden',
            sheet === 'detail' && 'lg:hidden',
          )}
        />
        {desktop && sheet === 'detail' && entry && (
          <aside
            aria-label="Entry detail"
            className="relative w-[340px] shrink-0 border-l border-border bg-sidebar p-5 overflow-y-auto animate-page-in"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-medium">Entry detail</h2>
              <Button
                autoFocus
                variant="ghost"
                size="icon"
                aria-label="Close entry details"
                onClick={() => setSheet(null)}
              >
                <X />
              </Button>
            </div>
            <EntryDetail
              transaction={entry.transaction}
              onEdit={
                entry.onEdit
                  ? () => {
                      setSheet(null)
                      entry.onEdit?.()
                    }
                  : undefined
              }
            />
          </aside>
        )}
        </div>
        <BottomNav />
        {mobile && !sheet && location.pathname !== '/settings' && (
          <button
            aria-label="Add transaction"
            onClick={() => openAddTransactionModal('expense')}
            className="fixed right-4 bottom-[calc(104px+env(safe-area-inset-bottom))] z-30 size-16 rounded-[20px] bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(0,0,0,.45)] flex items-center justify-center"
          >
            <Plus className="size-7" />
          </button>
        )}
        <PWAInstallBanner hidden={sheet !== null} />
        <Dialog
          open={sheet !== null && !(desktop && sheet === 'detail')}
          onOpenChange={(open) => {
            if (!open) {
              setSheet(null)
              setFormError(null)
            }
          }}
        >
          <DialogContent
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
                  onSubmit={handleCreate}
                  onClose={() => setSheet(null)}
                />
              ) : (
                <TransactionForm
                  entryKind={transactionKind}
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
            {sheet === 'detail' && entry && (
              <EntryDetail
                transaction={entry.transaction}
                onEdit={
                  entry.onEdit
                    ? () => {
                        setSheet(null)
                        entry.onEdit?.()
                      }
                    : undefined
                }
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EntryContext.Provider>
  )
}
