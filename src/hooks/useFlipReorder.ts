import { useCallback, useLayoutEffect, useRef } from 'react'

export function useFlipReorder<T extends string>(items: readonly T[], enabled = true) {
  const elementsRef = useRef(new Map<T, HTMLElement>())
  const rectsRef = useRef(new Map<T, DOMRect>())
  const orderKey = items.join('|')

  const setItemRef = useCallback((key: T) => (node: HTMLElement | null) => {
    if (node) elementsRef.current.set(key, node)
    else elementsRef.current.delete(key)
  }, [])

  useLayoutEffect(() => {
    const previousRects = rectsRef.current
    const nextRects = new Map<T, DOMRect>()

    elementsRef.current.forEach((element, key) => {
      const nextRect = element.getBoundingClientRect()
      const previousRect = previousRects.get(key)
      nextRects.set(key, nextRect)

      if (!enabled || !previousRect) return

      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

      element.animate(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    })

    rectsRef.current = nextRects
  }, [enabled, orderKey])

  return setItemRef
}
