import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Ellipsis,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BOTTOM_NAV_TABS,
  isDestinationActive,
  isLocked,
  type NavIconKey,
} from '@/lib/navDestinations'

const ICONS: Partial<Record<NavIconKey, LucideIcon>> = {
  home: LayoutDashboard,
  accounts: Wallet,
  activity: ArrowLeftRight,
  budgets: PieChart,
  more: Ellipsis,
}
export default function BottomNav({
  setupComplete = true,
}: {
  setupComplete?: boolean
}) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-[calc(80px+env(safe-area-inset-bottom))] border-t border-sidebar-border bg-sidebar pt-3 pb-[env(safe-area-inset-bottom)]"
    >
      {BOTTOM_NAV_TABS.map((tab) => {
        const { to, label, exact } = tab
        const locked = isLocked(tab, setupComplete)
        const Icon = locked ? Lock : (ICONS[tab.icon] ?? LayoutDashboard)
        const active = isDestinationActive(pathname, tab)
        return (
        <NavLink
          key={to}
          to={to}
          end={exact}
          aria-current={active ? 'page' : undefined}
          className="flex-1 min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          title={locked ? `${label} (finish setup to unlock)` : undefined}
        >
          <span
            className={cn(
              'flex flex-col items-center gap-1 text-xs',
              !locked && active
                ? 'font-semibold text-foreground'
                : 'font-medium text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-(--dur-base)',
                !locked &&
                  active &&
                  'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-5" />
            </span>
            {label}
          </span>
        </NavLink>
        )
      })}
    </nav>
  )
}
