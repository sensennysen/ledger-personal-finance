import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowLeftRight, Menu, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import type { TransactionKind } from '@/components/transactions/transactionKinds'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/settings', label: 'More', icon: Menu },
]

type BottomNavProps = {
  onAddTransaction?: (kind: TransactionKind) => void
  addTransactionOpen?: boolean
  onMoreMenu?: () => void
  moreMenuOpen?: boolean
}

export default function BottomNav({
  onAddTransaction,
  addTransactionOpen = false,
  onMoreMenu,
  moreMenuOpen = false,
}: BottomNavProps) {
  const location = useLocation()
  const insertIndex = 2

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 box-border w-full max-w-full overflow-hidden px-3 pb-2 pt-2 md:hidden">
      <div
        className="absolute inset-0 rounded-t-3xl border border-sidebar-border/70 bg-sidebar/90"
        style={{ backdropFilter: 'blur(12px)' }}
      />
      <TransactionKindMenu
        side="top"
        align="center"
        onSelect={(kind) => onAddTransaction?.(kind)}
        trigger={
          <button
            type="button"
            aria-label="Add transaction"
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-2xl border border-primary/40 shadow-md',
              'bg-primary text-primary-foreground flex items-center justify-center transition-transform duration-200 active:scale-95',
              addTransactionOpen && 'ring-4 ring-primary/30'
            )}
          >
            <Plus className="w-6 h-6" />
          </button>
        }
      />
      <div className="relative grid h-20 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem_minmax(0,1fr)_minmax(0,1fr)] items-center px-1">
        {navItems.map(({ to, label, icon: Icon, exact }, index) => {
          const isMore = label === 'More'
          const active = exact ? location.pathname === to : location.pathname.startsWith(to)
          const isMoreDestination = ['/budgets', '/categories', '/reports', '/settings'].some((path) => location.pathname.startsWith(path))
          const isActive = isMore ? moreMenuOpen || isMoreDestination : active
          return (
            <div key={to} className="contents">
              {index === insertIndex && <div className="w-16" aria-hidden />}
              {isMore ? (
                <button
                  type="button"
                  onClick={onMoreMenu}
                  className={cn(
                    'flex w-full min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[0.625rem] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('mb-1 transition-all duration-200', isActive ? 'w-4 h-4' : 'w-[18px] h-[18px]')} />
                  <span className="leading-none">{label}</span>
                </button>
              ) : (
                <NavLink
                  to={to}
                  end={exact}
                  className={cn(
                    'flex w-full min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[0.625rem] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('mb-1 transition-all duration-200', isActive ? 'w-4 h-4' : 'w-[18px] h-[18px]')} />
                  <span className="leading-none">{label}</span>
                </NavLink>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
