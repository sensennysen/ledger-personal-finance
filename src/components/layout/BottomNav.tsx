import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV_TABS, isLocked, type NavIconKey } from '@/lib/navDestinations'

const ICONS: Partial<Record<NavIconKey, LucideIcon>> = {
  home: LayoutDashboard,
  accounts: Wallet,
  activity: ArrowLeftRight,
  budgets: PieChart,
}
export default function BottomNav({
  setupComplete = true,
}: {
  setupComplete?: boolean
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-[calc(88px+env(safe-area-inset-bottom))] rounded-t-[28px] border-t border-sidebar-border bg-sidebar pt-3 pb-[env(safe-area-inset-bottom)]"
    >
      {BOTTOM_NAV_TABS.map((tab) => {
        const { to, label, exact } = tab
        const locked = isLocked(tab, setupComplete)
        const Icon = locked ? Lock : (ICONS[tab.icon] ?? LayoutDashboard)
        return (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className="flex-1 min-w-0"
          title={locked ? `${label} (finish setup to unlock)` : undefined}
        >
          {({ isActive }) => (
            <span
              className={cn(
                'flex flex-col items-center gap-1 text-xs font-medium',
                !locked && isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-[60px] items-center justify-center rounded-full transition-colors duration-(--dur-base)',
                  !locked &&
                    isActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-5" />
              </span>
              {label}
            </span>
          )}
        </NavLink>
        )
      })}
    </nav>
  )
}
