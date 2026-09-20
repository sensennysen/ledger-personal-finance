import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  FileBarChart2,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sun,
  Tag,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  NAV_TABS,
  SETTINGS_DESTINATION,
  isDestinationActive,
  type NavIconKey,
} from '@/lib/navDestinations'

const ICONS: Record<NavIconKey, LucideIcon> = {
  home: LayoutDashboard,
  accounts: Wallet,
  activity: ArrowLeftRight,
  budgets: Target,
  categories: Tag,
  reports: FileBarChart2,
  settings: Settings,
}

export function TopBar({
  avatar,
  onAvatarClick,
  mobileTitle,
  mobileStatus,
}: {
  avatar: ReactNode
  onAvatarClick: () => void
  mobileTitle: string
  mobileStatus: string
}) {
  const { pathname } = useLocation()
  const tabStrip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tabStrip.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])
  const { theme, toggleTheme } = useTheme()
  const SettingsIcon = ICONS[SETTINGS_DESTINATION.icon]
  return (
    <>
    <header className="hidden md:flex shrink-0 h-16 items-center gap-6 border-b border-border bg-sidebar px-6 lg:px-8">
      <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
        <img
          src={theme === 'dark' ? '/l-white.png' : '/l-black.png'}
          alt=""
          className="size-8 object-contain"
        />
        <span
          className="hidden lg:inline text-sm font-semibold tracking-[0.08em] uppercase text-foreground/80"
          style={{ fontFamily: '"Roboto", sans-serif' }}
        >
          Ledger
        </span>
      </NavLink>
      <nav aria-label="Main navigation" className="flex items-center gap-1">
        {NAV_TABS.map((tab) => {
          const Icon = ICONS[tab.icon]
          const active = isDestinationActive(pathname, tab)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              aria-current={active ? 'page' : undefined}
              title={tab.label}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full px-3 lg:px-4 text-[0.8125rem] font-medium transition-colors press-scale',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/4',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="sr-only lg:not-sr-only">{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="flex-1" />
      <button
        type="button"
        disabled
        aria-label="Search (coming soon)"
        className="flex h-10 w-10 lg:w-60 items-center justify-center lg:justify-start gap-2.5 rounded-full border border-border bg-background lg:px-3.5 text-[0.8125rem] text-muted-foreground disabled:cursor-default"
      >
        <Search className="size-4" />
        <span className="hidden lg:block flex-1 text-left">Search…</span>
        <kbd className="hidden lg:block rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold">
          ⌘K
        </kbd>
      </button>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <NavLink
          to={SETTINGS_DESTINATION.to}
          aria-label={SETTINGS_DESTINATION.label}
          className={({ isActive }) =>
            cn(
              'flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/4',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )
          }
        >
          <SettingsIcon className="size-4" />
        </NavLink>
        <button
          type="button"
          aria-label="Open account menu"
          onClick={onAvatarClick}
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring"
        >
          {avatar}
        </button>
      </div>
    </header>
    <header className="md:hidden shrink-0 bg-background">
      <div className="flex items-center justify-between gap-3 h-16 px-4">
        <div className="min-w-0">
          <p className="text-lg font-medium truncate">{mobileTitle}</p>
          <p className="text-xs text-muted-foreground">{mobileStatus}</p>
        </div>
        <div className="flex items-center gap-1">
          <div id="mobile-dashboard-tools" />
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-label="Search (coming soon)"
          >
            <Search />
          </Button>
          <button
            type="button"
            aria-label="Open account menu"
            onClick={onAvatarClick}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring"
          >
            {avatar}
          </button>
        </div>
      </div>
      <nav
        ref={tabStrip}
        aria-label="Sections"
        className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      >
        {NAV_TABS.map((tab) => {
          const active = isDestinationActive(pathname, tab)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-[0.8125rem] font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </NavLink>
          )
        })}
      </nav>
    </header>
    </>
  )
}
