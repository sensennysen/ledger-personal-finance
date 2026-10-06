import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { hiddenToWidgets, normalizeOrder, widgetsToHidden, type DashboardWidgetKey, type DashboardWidgets } from '@/lib/dashboardLayout'

export {
  DASHBOARD_WIDGET_LABELS,
  DEFAULT_WIDGET_ORDER,
  type DashboardWidgetKey,
  type DashboardWidgets,
} from '@/lib/dashboardLayout'

/**
 * The Home layout (LED-264): which widgets show and their order, both kept in the profile so every
 * device shows the same Home. Changes show at once and are saved through `patchProfile`, which
 * reports a failed save.
 */
export function useDashboardPrefs() {
  const { profile, patchProfile } = useAuth()
  const widgets = hiddenToWidgets(profile?.dashboard_hidden_widgets)
  const widgetOrder = normalizeOrder(profile?.dashboard_widget_order)

  const toggle = useCallback((key: keyof DashboardWidgets) => {
    const next = { ...widgets, [key]: !widgets[key] }
    patchProfile({ dashboard_hidden_widgets: widgetsToHidden(next) })
  }, [patchProfile, widgets])

  const moveWidget = useCallback((key: DashboardWidgetKey, direction: -1 | 1) => {
    const from = widgetOrder.indexOf(key)
    const to = from + direction
    if (from < 0 || to < 0 || to >= widgetOrder.length) return
    const next = [...widgetOrder]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchProfile({ dashboard_widget_order: next })
  }, [patchProfile, widgetOrder])

  const reorderWidget = useCallback((fromKey: DashboardWidgetKey, toKey: DashboardWidgetKey) => {
    const from = widgetOrder.indexOf(fromKey)
    const to = widgetOrder.indexOf(toKey)
    if (from < 0 || to < 0 || from === to) return
    const next = [...widgetOrder]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchProfile({ dashboard_widget_order: next })
  }, [patchProfile, widgetOrder])

  return { widgets, widgetOrder, toggle, moveWidget, reorderWidget }
}
