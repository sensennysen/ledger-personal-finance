import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

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

const STORAGE_KEY = 'ledger-dashboard-widgets'
const ORDER_STORAGE_KEY = 'ledger-dashboard-widget-order'

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
  'stats',
  'creditCards',
  'cashflowChart',
  'categoryPie',
  'recentTransactions',
  'budgets',
  'upcomingBills',
  'cashflowForecast',
]

const DEFAULTS: DashboardWidgets = {
  stats: true,
  cashflowChart: true,
  categoryPie: true,
  recentTransactions: true,
  budgets: true,
  savingsGoals: true,
  upcomingBills: true,
  cashflowForecast: true,
  creditCards: true,
  quickAdd: true,
}

function load(): DashboardWidgets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function normalizeOrder(order: unknown): DashboardWidgetKey[] {
  const valid = new Set<DashboardWidgetKey>(DEFAULT_WIDGET_ORDER)
  const parsed = Array.isArray(order) ? order.filter((key): key is DashboardWidgetKey => valid.has(key as DashboardWidgetKey)) : []
  return [...parsed, ...DEFAULT_WIDGET_ORDER.filter((key) => !parsed.includes(key))]
}

function loadOrder(): DashboardWidgetKey[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGET_ORDER
    return normalizeOrder(JSON.parse(raw))
  } catch {
    return DEFAULT_WIDGET_ORDER
  }
}

function persist(w: DashboardWidgets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function persistOrder(order: DashboardWidgetKey[]) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Best effort only; the database remains the source of truth when online.
  }
}

export function useDashboardPrefs() {
  const { user, profile, refreshProfile } = useAuth()
  const [widgets, setWidgets] = useState<DashboardWidgets>(load)
  const [widgetOrderOverride, setWidgetOrderOverride] = useState<DashboardWidgetKey[] | null>(null)
  const widgetOrder = widgetOrderOverride ?? normalizeOrder(profile?.dashboard_widget_order ?? loadOrder())

  const persistWidgetOrder = useCallback(async (order: DashboardWidgetKey[]) => {
    persistOrder(order)
    if (!user || !navigator.onLine) return
    const { error } = await supabase
      .from('profiles')
      .update({ dashboard_widget_order: order })
      .eq('id', user.id)
    if (!error) {
      await refreshProfile()
      setWidgetOrderOverride(null)
    }
  }, [user, refreshProfile])

  const toggle = useCallback((key: keyof DashboardWidgets) => {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      persist(next)
      return next
    })
  }, [])

  const moveWidget = useCallback((key: DashboardWidgetKey, direction: -1 | 1) => {
    setWidgetOrderOverride((prevOverride) => {
      const current = prevOverride ?? widgetOrder
      const from = current.indexOf(key)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.length) return prevOverride
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      persistWidgetOrder(next)
      return next
    })
  }, [persistWidgetOrder, widgetOrder])

  const reorderWidget = useCallback((fromKey: DashboardWidgetKey, toKey: DashboardWidgetKey) => {
    setWidgetOrderOverride((prevOverride) => {
      const current = prevOverride ?? widgetOrder
      const from = current.indexOf(fromKey)
      const to = current.indexOf(toKey)
      if (from < 0 || to < 0 || from === to) return prevOverride
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      persistWidgetOrder(next)
      return next
    })
  }, [persistWidgetOrder, widgetOrder])

  return { widgets, widgetOrder, toggle, moveWidget, reorderWidget }
}
