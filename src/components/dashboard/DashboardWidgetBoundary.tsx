import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { DashboardWidgetKey } from '@/hooks/useDashboardPrefs'

/** Height of a card that failed before it was ever measured. */
const UNMEASURED_HEIGHT = 160

interface Measured {
  height: number
  gridColumn: string
}

/**
 * One Home widget's error boundary (LED-243, OD-13 item 11): a widget that throws shows "This card
 * couldn't load" with Retry in its own space, and the rest of Home keeps working.
 *
 * While the widget renders, the wrapper is `display: contents`, so the widget stays the grid item
 * with its own order and span. The wrapper remembers the visible child's height and grid column,
 * and the fallback takes them with the widget's order, so the layout doesn't jump.
 */
export function DashboardWidgetBoundary({
  widget,
  style,
  children,
}: {
  widget: DashboardWidgetKey
  /** The widget's grid style (its order), from DashboardPage's widgetGridStyle. */
  style: CSSProperties
  children: ReactNode
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const measured = useRef<Measured | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const measure = () => {
      // The stats widget has a phone and a desktop child; only one is visible at a time.
      for (const child of wrapper.children) {
        const rect = child.getBoundingClientRect()
        if (rect.height > 0) {
          measured.current = { height: rect.height, gridColumn: getComputedStyle(child).gridColumn }
          return
        }
      }
    }
    const resize = new ResizeObserver(measure)
    const observeChildren = () => {
      resize.disconnect()
      for (const child of wrapper.children) resize.observe(child)
      measure()
    }
    const mutations = new MutationObserver(observeChildren)
    mutations.observe(wrapper, { childList: true })
    observeChildren()
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [])

  return (
    <div ref={wrapperRef} className="contents" data-widget={widget}>
      <ErrorBoundary
        variant="card"
        cardStyle={() => ({
          ...style,
          gridColumn: measured.current?.gridColumn,
          ...(measured.current ? { height: measured.current.height } : { minHeight: UNMEASURED_HEIGHT }),
        })}
      >
        {import.meta.env.DEV && <DevThrow widget={widget} />}
        {children}
      </ErrorBoundary>
    </div>
  )
}

const thrown = new Set<string>()

/**
 * Dev-only forced failure for the browser check: `/?throwWidget=<key>` makes that widget throw
 * once, two seconds after it mounts (its data has loaded and its size was measured); Retry's
 * remount then succeeds. It fails
 * through state rather than a throw-once flag, because React retries a render that threw and the
 * retry would pass. It is rendered only under `import.meta.env.DEV`, so production builds drop it.
 */
function DevThrow({ widget }: { widget: DashboardWidgetKey }) {
  const [fail, setFail] = useState(false)
  useEffect(() => {
    if (thrown.has(widget)) return
    if (new URLSearchParams(window.location.search).get('throwWidget') !== widget) return
    // Marked when it fires, not when it is set: StrictMode's first effect run is cleaned up.
    const timer = setTimeout(() => {
      thrown.add(widget)
      setFail(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [widget])
  if (fail) throw new Error(`Forced failure of the ${widget} widget (?throwWidget)`)
  return null
}
