import { contrastRatio, readableInk } from './contrast.ts'

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

/**
 * Tokens for a custom accent, from the tones Material picked for it (`ThemeContext` reads them
 * out of `themeFromSourceColor`, which Node cannot load, so this stays pure). A saturated hue can
 * leave M3's on-primary under 4.5:1, so the text on each tone is checked here (LED-151).
 * All four are `#RRGGBB`.
 */
export function accentTokens(material: AccentTokens): AccentTokens {
  return {
    primary: material.primary,
    onPrimary: readableOn(material.onPrimary, material.primary),
    container: material.container,
    onContainer: readableOn(material.onContainer, material.container),
  }
}
