// The mobile FAB floats over the list, so it would cover the last row's
// trailing controls at scroll end. It hides once the remaining scroll
// distance is within the FAB's footprint, and never on pages that don't scroll.
export const FAB_CLEARANCE_PX = 80

export function isNearScrollEnd(
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number },
  clearance: number = FAB_CLEARANCE_PX,
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = metrics
  if (scrollHeight <= clientHeight + clearance) return false
  return scrollHeight - scrollTop - clientHeight <= clearance
}
