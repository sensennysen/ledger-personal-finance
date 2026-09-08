import { createContext } from 'react'
import type { DashboardWidgetKey } from '@/hooks/useDashboardPrefs'
export const WidgetDragContext = createContext<{
  start: (key: DashboardWidgetKey) => void
  drop: (key: DashboardWidgetKey) => void
  end: () => void
} | null>(null)
