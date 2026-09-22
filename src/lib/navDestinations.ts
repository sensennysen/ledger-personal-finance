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
