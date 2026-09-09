import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  ArrowLeftRight,
  Target,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Target },
]

const MORE_ROUTES = ['/categories', '/reports', '/settings', '/thirteenth-month']

export default function BottomNav({ onMore }: { onMore: () => void }) {
  const { pathname } = useLocation()
  const moreActive = MORE_ROUTES.some((route) => pathname.startsWith(route))

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-[calc(80px+env(safe-area-inset-bottom))] border-t border-outline-variant bg-nav-container pt-2.5 pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ to, label, icon: Icon, exact }) => (
        <NavLink key={to} to={to} end={exact} className="flex-1 min-w-0">
          {({ isActive }) => (
            <span
              className={cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-2xl transition-colors duration-200',
                  isActive && 'bg-primary-container text-on-primary-container',
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              {label}
            </span>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        aria-label="More"
        className={cn(
          'flex-1 min-w-0 flex flex-col items-center gap-1 text-[11px] font-medium',
          moreActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-14 items-center justify-center rounded-2xl transition-colors duration-200',
            moreActive && 'bg-primary-container text-on-primary-container',
          )}
        >
          <MoreHorizontal className="size-[18px]" />
        </span>
        More
      </button>
    </nav>
  )
}
