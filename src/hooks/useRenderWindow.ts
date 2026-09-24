import { useEffect, useState } from 'react'
import { nextRowCount } from '@/lib/transactionWindow'

/**
 * Renders a list `step` rows at a time, growing when the sentinel nears the
 * viewport. A changed `resetKey` (a new filter) starts over from one step;
 * anything outside the key, such as a cycle change, keeps the current window so
 * the scroll position survives it.
 */
export function useRenderWindow(total: number, { step, resetKey }: { step: number; resetKey: string }) {
  const [state, setState] = useState({ key: resetKey, count: step })
  // Held in state, not a ref: switching flat/grouped or leaving an empty state
  // mounts a new sentinel node, and the observer must follow it.
  const [sentinel, sentinelRef] = useState<HTMLDivElement | null>(null)

  let count = Math.max(state.count, step)
  if (state.key !== resetKey) {
    setState({ key: resetKey, count: step })
    count = step
  }
  const rendered = Math.min(count, total)
  const hasMore = rendered < total

  useEffect(() => {
    if (!hasMore || !sentinel) return
    // root null still accounts for clipping by the scrolling <main>.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState((current) => ({ ...current, count: nextRowCount(Math.max(current.count, step), step, total) }))
        }
      },
      { rootMargin: '0px 0px 600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, hasMore, rendered, step, total])

  return { rendered, hasMore, sentinelRef }
}
