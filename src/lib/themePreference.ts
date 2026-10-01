/** The choice the user makes in Settings; `system` follows the OS and can change under them. */
export type ThemePreference = 'light' | 'dark' | 'system'
/** What is actually painted. */
export type Theme = 'light' | 'dark'

/** New users keep the dark Obsidian Ledger default. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark'

/** A stored value that is not one of the three (or is missing) falls back to the default. */
export function parseStoredTheme(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : DEFAULT_THEME_PREFERENCE
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
