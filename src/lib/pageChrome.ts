export const PAGE_ACTIONS_ID = 'page-actions'

export interface HeaderMeta {
  title: string
  showStepper: boolean
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

export function resolveHeaderMeta(pathname: string): HeaderMeta {
  if (/^\/accounts\/[^/]+$/.test(pathname)) {
    return { title: 'Account', showStepper: false }
  }
  return {
    title: TITLES[pathname] ?? 'Ledger',
    showStepper: STEPPER_PATHS.includes(pathname),
  }
}
