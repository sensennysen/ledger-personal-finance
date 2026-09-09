import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  ArrowLeftRight,
  Target,
  FileBarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()

  const name = profile?.full_name ?? user?.email ?? 'User'
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="hidden md:flex md:w-20 lg:w-60 shrink-0 flex-col border-r border-outline-variant bg-nav-container">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-4 lg:px-5 max-md:justify-center md:justify-center lg:justify-start">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[14px] font-bold text-primary-foreground">
          L
        </div>
        <span className="hidden lg:inline text-sm font-semibold tracking-[0.04em] text-foreground">
          Ledger
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 lg:gap-1 items-center lg:items-stretch">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const active = exact
            ? location.pathname === to
            : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={cn(
                'flex flex-col lg:flex-row items-center lg:gap-3 gap-0.5 lg:h-11 lg:w-full lg:rounded-full lg:px-4 text-[13px] font-medium transition-colors duration-200',
                active
                  ? 'text-on-primary-container lg:bg-primary-container'
                  : 'text-muted-foreground lg:hover:bg-foreground/[0.04] lg:hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-2xl lg:h-auto lg:w-auto lg:rounded-none',
                  active && 'bg-primary-container lg:bg-transparent',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium lg:text-[13px]',
                  active ? 'lg:font-semibold' : 'lg:font-medium',
                )}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>

      {/* User + sign out (desktop only) */}
      <div className="hidden lg:flex flex-col gap-0.5 border-t border-outline-variant p-4">
        <div className="flex items-center gap-2.5 p-2">
          <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {profile?.full_name ?? 'User'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-2.5 rounded-lg p-2 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <LogOut className="size-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
