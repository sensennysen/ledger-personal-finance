// The Home layout (LED-264). Pure: the order is `profiles.dashboard_widget_order` and the hidden
// widgets `profiles.dashboard_hidden_widgets`; both are checked against the known widgets on read.

export interface DashboardWidgets {
  stats: boolean
  cashflowChart: boolean
  categoryPie: boolean
  recentTransactions: boolean
  budgets: boolean
  savingsGoals: boolean
  upcomingBills: boolean
  cashflowForecast: boolean
  creditCards: boolean
  quickAdd: boolean
}

export type DashboardWidgetKey = keyof DashboardWidgets

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  stats: 'Stats Cards',
  cashflowChart: 'Cash Flow Chart',
  categoryPie: 'Category Pie',
  recentTransactions: 'Recent Transactions',
  budgets: 'Budget Progress',
  savingsGoals: 'Savings Goals',
  upcomingBills: 'Upcoming Bills',
  cashflowForecast: 'Cash Flow Forecast',
  creditCards: 'Credit Card Tracker',
  quickAdd: 'Quick Add',
}

export const DEFAULT_WIDGET_ORDER: DashboardWidgetKey[] = [
  'upcomingBills',
  'stats',
  'creditCards',
  'budgets',
  'recentTransactions',
  'cashflowChart',
  'categoryPie',
  'cashflowForecast',
]

const WIDGET_KEYS = Object.keys(DASHBOARD_WIDGET_LABELS) as DashboardWidgetKey[]

/** Where the hidden widgets and the order lived before LED-264, for the whole browser. */
export const LEGACY_WIDGETS_KEY = 'ledger-dashboard-widgets'
export const LEGACY_WIDGET_ORDER_KEY = 'ledger-dashboard-widget-order'

/** The stored order, known widgets only, with any missing ones after it in their default place. */
export function normalizeOrder(order: unknown): DashboardWidgetKey[] {
  const valid = new Set<DashboardWidgetKey>(DEFAULT_WIDGET_ORDER)
  const parsed = Array.isArray(order) ? order.filter((key): key is DashboardWidgetKey => valid.has(key as DashboardWidgetKey)) : []
  return [...parsed, ...DEFAULT_WIDGET_ORDER.filter((key) => !parsed.includes(key))]
}

/** Every widget shows unless the stored list names it. */
export function hiddenToWidgets(hidden: unknown): DashboardWidgets {
  const names = new Set(Array.isArray(hidden) ? hidden : [])
  return Object.fromEntries(WIDGET_KEYS.map((key) => [key, !names.has(key)])) as unknown as DashboardWidgets
}

export function widgetsToHidden(widgets: DashboardWidgets): DashboardWidgetKey[] {
  return WIDGET_KEYS.filter((key) => !widgets[key])
}

/**
 * The hidden widgets in the browser's old key, or null when there is nothing to upload: no key,
 * unreadable JSON, or every widget showing.
 */
export function legacyHiddenUpload(raw: string | null): DashboardWidgetKey[] | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const value = parsed as Record<string, unknown>
  const hidden = WIDGET_KEYS.filter((key) => value[key] === false)
  return hidden.length > 0 ? hidden : null
}

export function readLegacyWidgets(): string | null {
  try {
    return localStorage.getItem(LEGACY_WIDGETS_KEY)
  } catch {
    return null
  }
}

/** Removes both old keys: the order already lives in the account, and the hidden list now does. */
export function forgetLegacyDashboardKeys(): void {
  try {
    localStorage.removeItem(LEGACY_WIDGETS_KEY)
    localStorage.removeItem(LEGACY_WIDGET_ORDER_KEY)
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

/** Whether either old key is still in this browser. */
export function hasLegacyDashboardKeys(): boolean {
  try {
    return localStorage.getItem(LEGACY_WIDGETS_KEY) !== null || localStorage.getItem(LEGACY_WIDGET_ORDER_KEY) !== null
  } catch {
    return false
  }
}
