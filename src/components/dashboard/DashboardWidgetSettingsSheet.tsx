import { ArrowDown, ArrowUp, GripVertical, Settings2 } from 'lucide-react'
import { DASHBOARD_WIDGET_LABELS, DEFAULT_WIDGET_ORDER, type DashboardWidgetKey } from '@/hooks/useDashboardPrefs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

interface DashboardWidgetSettingsSheetProps {
  widgetOrder: DashboardWidgetKey[]
  widgets: Record<DashboardWidgetKey, boolean>
  isDesktopDrag: boolean
  draggedWidget: DashboardWidgetKey | null
  dropTargetWidget: DashboardWidgetKey | null
  setDraggedWidget: (widget: DashboardWidgetKey | null) => void
  setDropTargetWidget: (widget: DashboardWidgetKey | null) => void
  moveWidget: (key: DashboardWidgetKey, direction: -1 | 1) => void
  reorderWidget: (sourceKey: DashboardWidgetKey, targetKey: DashboardWidgetKey) => void
  toggleWidget: (key: DashboardWidgetKey) => void
  setWidgetControlRef: (key: DashboardWidgetKey) => (node: HTMLElement | null) => void
}

export function DashboardWidgetSettingsSheet({
  widgetOrder,
  widgets,
  isDesktopDrag,
  draggedWidget,
  dropTargetWidget,
  setDraggedWidget,
  setDropTargetWidget,
  moveWidget,
  reorderWidget,
  toggleWidget,
  setWidgetControlRef,
}: DashboardWidgetSettingsSheetProps) {
  const orderedWidgetControls = widgetOrder.filter((key) => DEFAULT_WIDGET_ORDER.includes(key))

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="gap-1.5 shrink-0" />}>
        <Settings2 className="w-3.5 h-3.5" />
        <span className="text-[0.8125rem]">Widgets</span>
      </SheetTrigger>
      <SheetContent className="w-[280px] sm:max-w-[280px]">
        <SheetHeader>
          <SheetTitle>Dashboard Widgets</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-1">
          {orderedWidgetControls.map((key, index) => (
            <div
              key={key}
              ref={setWidgetControlRef(key)}
              draggable={isDesktopDrag}
              onDragStart={() => {
                setDraggedWidget(key)
                setDropTargetWidget(null)
              }}
              onDragEnter={() => {
                if (draggedWidget && draggedWidget !== key) setDropTargetWidget(key)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (draggedWidget && draggedWidget !== key) setDropTargetWidget(key)
              }}
              onDrop={() => {
                if (draggedWidget) reorderWidget(draggedWidget, key)
                setDraggedWidget(null)
                setDropTargetWidget(null)
              }}
              onDragEnd={() => {
                setDraggedWidget(null)
                setDropTargetWidget(null)
              }}
              className={cn(
                'reorder-motion flex items-center gap-2 py-2.5 px-2 -mx-2 border border-transparent border-b-border/40 last:border-b-transparent rounded-md',
                draggedWidget === key && 'is-dragging bg-muted/70',
                dropTargetWidget === key && 'is-drop-target'
              )}
            >
              <GripVertical className="reorder-handle hidden md:block w-3.5 h-3.5 text-muted-foreground cursor-grab" />
              <span className="text-sm flex-1">{DASHBOARD_WIDGET_LABELS[key]}</span>
              <div className="flex items-center gap-1 md:hidden">
                <Button variant="ghost" size="icon-xs" onClick={() => moveWidget(key, -1)} disabled={index === 0}>
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveWidget(key, 1)}
                  disabled={index === orderedWidgetControls.length - 1}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
              <Switch checked={widgets[key]} onCheckedChange={() => toggleWidget(key)} />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
