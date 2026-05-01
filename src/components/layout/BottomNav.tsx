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
      <div className="flex items-center h-16">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200 min-w-0',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'flex items-center justify-center rounded-full transition-all duration-200',
                active ? 'bg-primary/10 w-10 h-6' : 'w-6 h-6'
              )}>
                <Icon className={cn(
                  'transition-all duration-200',
                  active ? 'w-4 h-4' : 'w-5 h-5'
                )} />
              </div>
              <span className={cn(
                'uppercase tracking-[0.06em] font-medium transition-all duration-200 leading-none',
                active ? 'text-[10px] opacity-100 max-h-4' : 'text-[0px] opacity-0 max-h-0 overflow-hidden'
              )}>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
