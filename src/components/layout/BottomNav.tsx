import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowLeftRight, Target, Settings, FileBarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.700 0.115 72 / 0.3), transparent)' }}
      />
      <div className="flex items-center h-15">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-medium tracking-wide transition-all duration-200 min-w-0',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4.5 h-4.5 transition-transform duration-200', active && 'scale-110')} />
              <span className="uppercase tracking-[0.06em]">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
