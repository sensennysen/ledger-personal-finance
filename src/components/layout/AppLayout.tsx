import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Tag, Target, FileBarChart2, ChevronRight, Sun, Moon } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { PWAInstallBanner } from './PWAInstallBanner'
import { useTransactions } from '@/hooks/useTransactions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

function PageTransition() {
  const location = useLocation()
  return (
    <div key={location.key} className="animate-page-in min-h-full">
      <Outlet />
    </div>
  )
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { generateDueRecurring, createTransaction } = useTransactions()
  const hasGenerated = useRef(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (hasGenerated.current) return
    hasGenerated.current = true
    generateDueRecurring().then((count) => {
      if (count > 0) {
        console.info(`[Recurring] Created ${count} recurring transaction${count !== 1 ? 's' : ''}.`)
      }
    })
  }, [])

  useEffect(() => {
    setMoreMenuOpen(false)
  }, [location.pathname])

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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PWAInstallBanner />
        <GuestModeBanner />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <PageTransition />
        </main>
      </div>
      <BottomNav
        onAddTransaction={() => {
          setMoreMenuOpen(false)
          setCreateOpen(true)
        }}
        addTransactionOpen={createOpen}
        onMoreMenu={() => setMoreMenuOpen((v) => !v)}
        moreMenuOpen={moreMenuOpen}
      />
      {moreMenuOpen && (
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
                { label: 'Categories', sub: 'Manage tags', to: '/categories', icon: Tag, color: 'text-teal-400' },
                { label: 'Budgets', sub: 'Set limits', to: '/budgets', icon: Target, color: 'text-violet-400' },
                { label: 'Reports', sub: 'View insights', to: '/reports', icon: FileBarChart2, color: 'text-amber-400' },
              ].map(({ label, sub, to, icon: Icon, color }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
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
            <div className="flex items-center justify-between rounded-lg px-1.5 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Sun className="h-4 w-4 text-muted-foreground" />
                Light mode
              </span>
              <Switch checked={theme === 'light'} onCheckedChange={(checked) => setTheme(checked ? 'light' : 'dark')} />
            </div>
            <button
              type="button"
              onClick={() => {
                setMoreMenuOpen(false)
                navigate('/settings')
              }}
              className="flex w-full items-center justify-between rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-white/4"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Moon className="h-4 w-4 text-muted-foreground" />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          <TransactionForm
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
