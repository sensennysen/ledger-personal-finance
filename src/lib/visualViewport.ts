// iOS Safari does not shrink the layout viewport (or dvh) for the on-screen keyboard; only
// window.visualViewport does. Fixed dialogs sized to the layout viewport end up with their
// sticky footer behind the keyboard (LED-252). These values let them follow the visible area.

export interface ViewportSample {
  /** visualViewport.height */
  height: number
  /** visualViewport.offsetTop */
  offsetTop: number
  /** visualViewport.scale */
  scale: number
  /** documentElement.clientHeight, the layout viewport */
  layoutHeight: number
}

export type ViewportVars = Record<'--vv-height' | '--vv-center' | '--vv-bottom', string>

/**
 * CSS variables for the visible area, or null when the visual viewport covers the layout
 * viewport (no keyboard) or the page is pinch-zoomed. Null means "remove the variables",
 * so every rule falls back to its usual dvh/50% value.
 */
export function visualViewportVars(sample: ViewportSample): ViewportVars | null {
  const { height, offsetTop, scale, layoutHeight } = sample
  if (Math.abs(scale - 1) > 0.01) return null
  if (height >= layoutHeight - 1) return null
  const bottom = Math.max(0, layoutHeight - offsetTop - height)
  return {
    '--vv-height': `${Math.round(height)}px`,
    '--vv-center': `${Math.round(offsetTop + height / 2)}px`,
    '--vv-bottom': `${Math.round(bottom)}px`,
  }
}
