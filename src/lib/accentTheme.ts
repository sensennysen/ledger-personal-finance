import { contrastRatio, hexToRgb, readableInk, relativeLuminance } from './contrast.ts'

/** WCAG AA for body text. */
export const MIN_ACCENT_CONTRAST = 4.5

export interface AccentTokens {
  primary: string
  onPrimary: string
  container: string
  onContainer: string
}

/** The preferred ink when it reads on `bg`, otherwise black or white, whichever reads better. */
export function readableOn(preferred: string, bg: string): string {
  if (contrastRatio(preferred, bg) >= MIN_ACCENT_CONTRAST) return preferred
  return readableInk(bg) ?? preferred
}

/** Share of the accent kept in its hover fill; the rest is black or white (LED-248). */
export const PRIMARY_HOVER_WEIGHT = 0.88

/** `color` mixed with `other` in sRGB, `weight` of `color`, as `color-mix(in srgb, …)` does. */
function mixHex(color: string, other: string, weight: number): string {
  const [a, b] = [hexToRgb(color), hexToRgb(other)]
  return '#' + a.map((v, i) => Math.round(v * weight + b[i] * (1 - weight)).toString(16).padStart(2, '0')).join('')
}

/**
 * The hover fill for a primary button: the accent moved away from its ink, darker under a light ink
 * and lighter under a dark one, so the label gains contrast on hover instead of losing it.
 */
export function primaryHover(primary: string, onPrimary: string): string {
  const away = relativeLuminance(onPrimary) > relativeLuminance(primary) ? '#000000' : '#ffffff'
  return mixHex(primary, away, PRIMARY_HOVER_WEIGHT)
}

/**
 * Tokens for a custom accent, from the tones Material picked for it (`ThemeContext` reads them
 * out of `themeFromSourceColor`, which Node cannot load, so this stays pure). A saturated hue can
 * leave M3's on-primary under 4.5:1, so the text on each tone is checked here (LED-151).
 * All four are `#RRGGBB`.
 */
export function accentTokens(material: AccentTokens): AccentTokens & { primaryHover: string } {
  const onPrimary = readableOn(material.onPrimary, material.primary)
  return {
    primary: material.primary,
    onPrimary,
    primaryHover: primaryHover(material.primary, onPrimary),
    container: material.container,
    onContainer: readableOn(material.onContainer, material.container),
  }
}
