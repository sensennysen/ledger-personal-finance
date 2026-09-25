/** WCAG 2.x contrast math for `#RRGGBB` colors. Pure, so tests can load it. */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Not a #RRGGBB color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Label inks for text drawn on an arbitrary category colour. */
/** Black and white, not the design ink: their better contrast is at least 4.58:1 on any colour. */
export const INK_ON_LIGHT = '#000000'
export const INK_ON_DARK = '#FFFFFF'

/** The label ink with the higher contrast on `bg`, or null when `bg` is not #RRGGBB. */
export function readableInk(bg: string): string | null {
  try {
    return contrastRatio(INK_ON_DARK, bg) >= contrastRatio(INK_ON_LIGHT, bg) ? INK_ON_DARK : INK_ON_LIGHT
  } catch {
    return null
  }
}
