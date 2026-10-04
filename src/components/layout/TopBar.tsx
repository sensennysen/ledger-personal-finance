import { type KeyboardEvent, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarDays,
  Ellipsis,
  FileBarChart2,
  LayoutDashboard,
  Lock,
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
import { LedgerMark } from '@/components/brand/LedgerMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  NAV_TABS,
  SETTINGS_DESTINATION,
  isDestinationActive,
  isLocked,
  nextTabIndex,
  rovingTabStop,
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
  'thirteenth-month': CalendarDays,
  more: Ellipsis,
}

// Arrow keys move focus within a tab row; Tab leaves it (LED-90).
function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
  )
  const current = tabs.indexOf(document.activeElement as HTMLElement)
  if (current === -1) return
  const next = nextTabIndex(current, event.key, tabs.length)
  if (next === null) return
  event.preventDefault()
  tabs[next].focus()
  tabs[next].scrollIntoView({ inline: 'nearest', block: 'nearest' })
}

export function TopBar({
  avatar,
  mobileAvatar,
  onAvatarClick,
  onSearch,
  mobileTitle,
  titleIsHeading,
  setupComplete = true,
}: {
  avatar: ReactNode
  mobileAvatar: ReactNode
  onAvatarClick: () => void
  onSearch: () => void
  mobileTitle: string
  titleIsHeading: boolean
  setupComplete?: boolean
}) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const tabStop = rovingTabStop(NAV_TABS, pathname)
  const SettingsIcon = ICONS[SETTINGS_DESTINATION.icon]
  return (
    <>
    <header className="hidden md:flex shrink-0 h-16 items-center gap-6 border-b border-border bg-sidebar px-6 lg:px-8">
      {/* Out of the tab order (LED-148): Home is the next stop and the tab group is the way in. */}
      <NavLink to="/" tabIndex={-1} aria-label="Ledger home" className="flex items-center gap-2.5 shrink-0">
        <LedgerMark decorative className="size-8 text-foreground" />
        <span
          className="hidden xl:inline text-sm font-semibold tracking-[0.08em] uppercase text-foreground/80"
          style={{ fontFamily: '"Roboto", sans-serif' }}
        >
          Ledger
        </span>
      </NavLink>
      <nav aria-label="Main navigation">
        <div
          role="tablist"
          aria-label="Sections"
          onKeyDown={moveTabFocus}
          className="flex items-center gap-1"
        >
        {NAV_TABS.map((tab, index) => {
          const locked = isLocked(tab, setupComplete)
          const Icon = ICONS[tab.icon]
          const active = isDestinationActive(pathname, tab)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              tabIndex={index === tabStop ? 0 : -1}
              title={locked ? `${tab.label} (finish setup to unlock)` : tab.label}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full px-3 xl:px-4 text-[0.8125rem] font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                locked
                  ? 'text-muted-foreground hover:text-foreground hover:bg-foreground/4'
                  : active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/4',
              )}
            >
              {/* Keep the destination's own icon: below xl the tabs are icon-only,
                  so a plain Lock made every locked tab look the same. */}
              <span className="relative shrink-0">
                <Icon className="size-4" />
                {locked && (
                  <Lock
                    aria-hidden
                    className="absolute -right-1.5 -bottom-1 size-2.5 rounded-full bg-sidebar p-px text-muted-foreground"
                  />
                )}
              </span>
              <span className="sr-only xl:not-sr-only">{tab.label}</span>
              {locked && <span className="sr-only"> (locked until setup is done)</span>}
            </NavLink>
          )
        })}
        </div>
      </nav>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="flex h-10 w-10 xl:w-60 items-center justify-center xl:justify-start gap-2.5 rounded-full border border-border bg-background xl:px-3.5 text-[0.8125rem] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <Search className="size-4" />
        <span className="hidden xl:block flex-1 text-left">Search…</span>
        <kbd className="hidden xl:block rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold">
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
              'flex size-9 items-center justify-center rounded-full transition-colors hover:bg-foreground/4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
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
          className="rounded-full focus-visible:ring-3 focus-visible:ring-ring"
        >
          {avatar}
        </button>
      </div>
    </header>
    {/* Phones: one title and two actions. Sections live in the bottom nav
        and More (M-01); OfflineBanner below carries sync status (M-03). */}
    <header className="md:hidden shrink-0 bg-background">
      <div className="flex items-center justify-between gap-3 h-14 pl-4 pr-2">
        <div className="min-w-0">
          {titleIsHeading ? (
            <h1 className="text-[22px] font-medium tracking-[-0.01em] truncate">{mobileTitle}</h1>
          ) : (
            <p className="text-[22px] font-medium tracking-[-0.01em] truncate">{mobileTitle}</p>
          )}
        </div>
        <div className="flex items-center">
          <div id="mobile-dashboard-tools" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onSearch}
            aria-label="Search"
            className="size-12 [&_svg]:size-5"
          >
            <Search />
          </Button>
          <button
            type="button"
            aria-label="Open account menu"
            onClick={onAvatarClick}
            className="flex size-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            {mobileAvatar}
          </button>
        </div>
      </div>
    </header>
    </>
  )
}
