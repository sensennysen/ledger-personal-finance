import { Fragment } from 'react'
import { NavLink, Navigate, useOutletContext } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  FileBarChart2,
  Lock,
  LogOut,
  Moon,
  Settings,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSignOut } from '@/hooks/useSignOut'
import { SignOutConfirm } from '@/components/layout/SignOutConfirm'
import { useTheme } from '@/contexts/ThemeContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { isLocked, type NavDestination } from '@/lib/navDestinations'
import type { AppLayoutContext } from '@/components/layout/AppLayout'

const DESTINATIONS: (NavDestination & { Icon: LucideIcon })[] = [
  { to: '/categories', label: 'Categories', icon: 'categories', Icon: Tag },
  { to: '/reports', label: 'Reports', icon: 'reports', Icon: FileBarChart2 },
  { to: '/thirteenth-month', label: '13th Month', icon: 'thirteenth-month', Icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: 'settings', Icon: Settings },
]

const card = 'rounded-[20px] border border-border bg-card'
const row =
  'flex h-14 w-full items-center gap-4 px-4 text-[15px] press-scale hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring'
const divider = <div aria-hidden className="ml-[52px] h-px bg-border" />

// Phones only: everything the bottom nav has no room for (M-02). Desktop
// reaches these from the top bar, so /more sends it home.
export default function MorePage() {
  const mobile = useMediaQuery('(max-width: 767px)')
  const { user, profile } = useAuth()
  const signOut = useSignOut()
  const { theme, toggleTheme } = useTheme()
  const { isOnline, pendingCount } = useNetworkStatus()
  const { setupComplete } = useOutletContext<AppLayoutContext>()
  if (!mobile) return <Navigate to="/" replace />
  const name = profile?.full_name ?? user?.email ?? 'Your account'
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const status = !isOnline
    ? 'Offline'
    : pendingCount > 0
      ? `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending`
      : 'All changes synced'
  return (
    <div className="p-4 space-y-3">
      <div className={`${card} flex items-center gap-3 p-4`}>
        <Avatar className="size-11">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[15px] font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email ? `${user.email} · ${status}` : status}
          </p>
        </div>
      </div>
      <nav aria-label="More destinations" className={`${card} overflow-hidden`}>
        {DESTINATIONS.map((destination, index) => {
          const locked = isLocked(destination, setupComplete)
          const Icon = locked ? Lock : destination.Icon
          return (
            <Fragment key={destination.to}>
              {index > 0 && divider}
              <NavLink
                to={destination.to}
                title={locked ? `${destination.label} (finish setup to unlock)` : undefined}
                className={row}
              >
                <Icon className="size-5 shrink-0 text-transfer" />
                <span className="flex-1 min-w-0 truncate">{destination.label}</span>
                <ChevronRight className="size-4 shrink-0 text-input" />
              </NavLink>
            </Fragment>
          )
        })}
      </nav>
      <div className={`${card} overflow-hidden`}>
        <div className="flex h-14 items-center gap-4 px-4 text-[15px]">
          <Moon className="size-5 shrink-0 text-transfer" />
          <span id="more-dark-theme" className="flex-1 min-w-0 truncate">Dark theme</span>
          <Switch
            aria-labelledby="more-dark-theme"
            checked={theme === 'dark'}
            onCheckedChange={toggleTheme}
          />
        </div>
        {divider}
        <button
          type="button"
          onClick={signOut.request}
          className={`${row} font-medium text-expense`}
        >
          <LogOut className="size-5 shrink-0" />
          Sign out
        </button>
      </div>
      <SignOutConfirm {...signOut.confirm} />
    </div>
  )
}
