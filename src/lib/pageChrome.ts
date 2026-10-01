export const PAGE_ACTIONS_ID = 'page-actions'

export interface HeaderMeta {
  title: string
  showStepper: boolean
  // false when the page owns the visible heading (e.g. the account name)
  titleIsHeading: boolean
}

const STEPPER_PATHS = ['/', '/transactions', '/budgets', '/reports']

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/accounts': 'Accounts',
  '/transactions': 'Activity',
  '/categories': 'Categories',
  '/budgets': 'Budgets',
  '/reports': 'Reports',
  '/thirteenth-month': '13th Month',
  '/settings': 'Settings',
}

// Budgets' Goals view is not per-cycle, so the stepper would move nothing on screen.
function followsCycle(pathname: string, search: string): boolean {
  if (!STEPPER_PATHS.includes(pathname)) return false
  return !(pathname === '/budgets' && new URLSearchParams(search).get('view') === 'goals')
}

export function resolveHeaderMeta(pathname: string, search = ''): HeaderMeta {
  if (/^\/accounts\/[^/]+$/.test(pathname)) {
    return { title: 'Account', showStepper: false, titleIsHeading: false }
  }
  return {
    title: TITLES[pathname] ?? 'Ledger',
    showStepper: followsCycle(pathname, search),
    titleIsHeading: true,
  }
}
