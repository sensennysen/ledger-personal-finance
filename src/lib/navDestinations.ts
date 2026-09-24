export type NavIconKey =
  | 'home'
  | 'accounts'
  | 'activity'
  | 'budgets'
  | 'categories'
  | 'reports'
  | 'settings'

export interface NavDestination {
  to: string
  label: string
  icon: NavIconKey
  exact?: boolean
}

export const NAV_TABS: NavDestination[] = [
  { to: '/', label: 'Home', icon: 'home', exact: true },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
  { to: '/transactions', label: 'Activity', icon: 'activity' },
  { to: '/budgets', label: 'Budgets', icon: 'budgets' },
  { to: '/categories', label: 'Categories', icon: 'categories' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
]

export const SETTINGS_DESTINATION: NavDestination = {
  to: '/settings',
  label: 'Settings',
  icon: 'settings',
}

// The four destinations the mobile bottom nav keeps.
export const BOTTOM_NAV_TABS: NavDestination[] = NAV_TABS.filter((tab) =>
  ['/', '/accounts', '/transactions', '/budgets'].includes(tab.to),
)

// Destinations that can't do anything useful until first-run setup is done
// (an account, a transaction, a pay cycle). Advisory only — never blocks.
export const LOCKED_WHEN_SETUP_INCOMPLETE: string[] = [
  '/transactions',
  '/budgets',
  '/categories',
  '/reports',
]

export function isLocked(
  destination: NavDestination,
  setupComplete: boolean,
): boolean {
  return !setupComplete && LOCKED_WHEN_SETUP_INCOMPLETE.includes(destination.to)
}

export function isDestinationActive(
  pathname: string,
  destination: NavDestination,
): boolean {
  if (destination.exact) return pathname === destination.to
  return (
    pathname === destination.to || pathname.startsWith(destination.to + '/')
  )
}

// The tab rows are one tab stop (LED-90): the active tab is 0, the rest -1.
// With no tab active (Settings, 13th Month) the first tab takes the stop.
export function rovingTabStop(
  tabs: NavDestination[],
  pathname: string,
): number {
  return Math.max(
    0,
    tabs.findIndex((tab) => isDestinationActive(pathname, tab)),
  )
}

// Arrow keys move focus within a tab row and wrap; Home and End jump to the
// ends. Returns null for any other key so the browser keeps its behaviour.
export function nextTabIndex(
  current: number,
  key: string,
  count: number,
): number | null {
  if (key === 'ArrowRight') return (current + 1) % count
  if (key === 'ArrowLeft') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
