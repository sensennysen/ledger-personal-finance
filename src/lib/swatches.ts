/** The app's indigo, the light `--primary` in index.css. Choosing it removes the accent overrides. */
export const DEFAULT_ACCENT = '#55659a'

/**
 * The one swatch list for Categories, Accounts, Budgets and the Settings accent picker.
 * Every entry has a dark-theme tint in categoryTint.ts (guarded by a test).
 */
export const SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
  '#a855f7', '#f43f5e', '#84cc16', '#f59e0b', '#10b981',
] as const
