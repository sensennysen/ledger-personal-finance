import { useState, useCallback } from 'react'

export interface DashboardWidgets {
  stats: boolean
  cashflowChart: boolean
  categoryPie: boolean
  budgets: boolean
  savingsGoals: boolean
  upcomingBills: boolean
  cashflowForecast: boolean
  quickAdd: boolean
}

const STORAGE_KEY = 'ledger-dashboard-widgets'

const DEFAULTS: DashboardWidgets = {
  stats: true,
  cashflowChart: true,
  categoryPie: true,
  budgets: true,
  savingsGoals: true,
  upcomingBills: true,
  cashflowForecast: true,
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

function persist(w: DashboardWidgets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
  } catch {}
}

export function useDashboardPrefs() {
  const [widgets, setWidgets] = useState<DashboardWidgets>(load)

  const toggle = useCallback((key: keyof DashboardWidgets) => {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      persist(next)
      return next
    })
  }, [])

  return { widgets, toggle }
}
