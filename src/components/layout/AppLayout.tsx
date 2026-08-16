import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Tag, Target, FileBarChart2, ChevronRight, Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { PWAInstallBanner } from './PWAInstallBanner'
import { useTransactions } from '@/hooks/useTransactions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { TRANSACTION_KIND_DIALOG_TITLES, type TransactionKind } from '@/components/transactions/transactionKinds'
import { cn } from '@/lib/utils'
import { useCreditCardNotifications } from '@/hooks/useCreditCardNotifications'

export type AppLayoutContext = {
  openAddTransactionModal: (kind: TransactionKind) => void
}

function PageTransition({ context }: { context: AppLayoutContext }) {
  const location = useLocation()
  return (
    <div key={location.key} className="animate-page-in min-h-full min-w-0 w-full max-w-full overflow-x-hidden">
      <Outlet context={context} />
    </div>
  )
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { generateDueRecurring, createTransaction } = useTransactions()
  const hasGenerated = useRef(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [transactionKind, setTransactionKind] = useState<TransactionKind>('expense')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [moreMenuPath, setMoreMenuPath] = useState(location.pathname)
  const [formError, setFormError] = useState<string | null>(null)
  const moreMenuVisible = moreMenuOpen && moreMenuPath === location.pathname
  const openAddTransactionModal = (kind: TransactionKind) => {
    setMoreMenuOpen(false)
    setFormError(null)
    setTransactionKind(kind)
    setCreateOpen(true)
  }

  useCreditCardNotifications()

  useEffect(() => {
    if (hasGenerated.current) return
    hasGenerated.current = true
    void generateDueRecurring().then((count) => {
      if (count > 0) {
        console.info(`[Recurring] Created ${count} recurring transaction${count !== 1 ? 's' : ''}.`)
      }
    })
  }, [generateDueRecurring])

  const handleCreate = async (values: TransactionFormValues) => {
    const { error } = await createTransaction(values as Parameters<typeof createTransaction>[0])
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setCreateOpen(false)
    navigate('/transactions')
  }

  return (
    <div className="flex h-screen w-full max-w-full bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PWAInstallBanner />
        <OfflineBanner />
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-24 md:pb-0">
          <PageTransition context={{ openAddTransactionModal }} />
        </main>
      </div>
      <BottomNav
        onAddTransaction={openAddTransactionModal}
        addTransactionOpen={createOpen}
        onMoreMenu={() => {
          setMoreMenuPath(location.pathname)
          setMoreMenuOpen((value) => !value)
        }}
        moreMenuOpen={moreMenuVisible}
      />
      {moreMenuVisible && (
        <>
          <button
            type="button"
            className="md:hidden fixed inset-0 z-40 bg-black/45"
            aria-label="Close more menu"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div className="md:hidden fixed inset-x-2 bottom-24 z-50 rounded-2xl border border-sidebar-border/70 bg-sidebar/95 p-3 shadow-2xl">
            <p className="mb-2 px-1 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">More</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Budgets', sub: 'Plan spending', to: '/budgets', icon: Target, color: 'text-violet-400' },
                { label: 'Categories', sub: 'Organize spending', to: '/categories', icon: Tag, color: 'text-teal-400' },
                { label: 'Reports', sub: 'View insights', to: '/reports', icon: FileBarChart2, color: 'text-amber-400' },
              ].map(({ label, sub, to, icon: Icon, color }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    setMoreMenuPath(to)
                    navigate(to)
                  }}
                  className="rounded-xl border border-border/40 bg-white/3 px-3 py-2.5 text-left transition-colors hover:bg-white/6"
                >
                  <Icon className={cn('mb-2 h-4 w-4', color)} />
                  <p className="text-xs font-semibold leading-tight">{label}</p>
                  <p className="text-[0.6875rem] text-muted-foreground leading-tight mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
            <div className="my-3 h-px bg-border/50" />
            <button
              type="button"
              onClick={() => {
                setMoreMenuOpen(false)
                setMoreMenuPath('/settings')
                navigate('/settings')
              }}
              className="flex w-full items-center justify-between rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-white/4"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </>
      )}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setFormError(null)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto p-3 sm:max-h-[90vh] sm:p-4">
          <DialogHeader>
            <DialogTitle>{TRANSACTION_KIND_DIALOG_TITLES[transactionKind]}</DialogTitle>
          </DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          <TransactionForm
            entryKind={transactionKind}
            onSubmit={handleCreate}
            onClose={() => {
              setCreateOpen(false)
              setFormError(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
