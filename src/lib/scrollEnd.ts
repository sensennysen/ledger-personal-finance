// The mobile FAB floats over the list, so it would cover the last row's
// trailing controls at scroll end. It hides once the remaining scroll
// distance is within the FAB's footprint, and never on pages that don't scroll.
export const FAB_CLEARANCE_PX = 72

export function isNearScrollEnd(
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number },
  clearance: number = FAB_CLEARANCE_PX,
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = metrics
  if (scrollHeight <= clientHeight + clearance) return false
  return scrollHeight - scrollTop - clientHeight <= clearance
}

// It also gets out of the way while reading (decision D, 2026-10-05): scrolling down hides it,
// scrolling up or reaching the top brings it back. Small moves are ignored so a jitter or a
// momentum bounce does not flicker it.
export const FAB_SCROLL_THRESHOLD_PX = 8

/** Whether a downward-scroll hide is in force after a scroll from `previousTop` to `top`. */
export function hiddenByScroll(previousTop: number, top: number, wasHidden: boolean, threshold: number = FAB_SCROLL_THRESHOLD_PX): boolean {
  if (top <= 0) return false
  const delta = top - previousTop
  if (delta > threshold) return true
  if (delta < -threshold) return false
  return wasHidden
}
