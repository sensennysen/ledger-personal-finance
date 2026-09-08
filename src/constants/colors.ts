/**
 * Replacement for src/constants/colors.ts
 *
 * Before: three hard-coded oklch strings (EMERALD / CORAL / GOLD) imported
 * into DashboardPage, SettingsPage, chart components and badges — which meant
 * money colors could not follow the theme.
 *
 * After: read the CSS custom properties, so the same constant resolves to the
 * light or dark M3 tone automatically. Recharts and inline `style` props need
 * real color strings, so expose both the var() reference (for CSS) and a
 * resolver (for canvas/SVG libraries that cannot parse var()).
 */

/** Use inside style props / className-free CSS. Theme-aware. */
export const INCOME = 'var(--income)'
export const EXPENSE = 'var(--expense)'
export const TRANSFER = 'var(--transfer)'
export const GOLD = 'var(--primary)'

export const INCOME_CONTAINER = 'var(--income-container)'
export const EXPENSE_CONTAINER = 'var(--expense-container)'
export const TRANSFER_CONTAINER = 'var(--transfer-container)'


/**
 * Recharts fills: `fill="var(--income)"` works in the DOM, but any library
 * that measures color (gradients, canvas fallbacks) needs a computed value.
 */
export function resolveToken(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

export type TxKind = 'income' | 'expense' | 'transfer'

/** One place that decides how a transaction row is colored. */
export const txTone = (kind: TxKind) => ({
  ink: `var(--${kind})`,
  container: `var(--${kind}-container)`,
  icon: kind === 'income' ? 'south_west' : kind === 'expense' ? 'north_east' : 'swap_horiz',
  sign: kind === 'income' ? '+' : kind === 'expense' ? '\u2212' : '',
})

/**
 * Direction is judged by OUTCOME, not arithmetic: rising spend is --expense
 * even though the number grew. Use this for every delta chip.
 */
export const deltaTone = (pctChange: number, metric: 'income' | 'spend' | 'networth') => {
  const good = metric === 'spend' ? pctChange < 0 : pctChange > 0
  return {
    ink: good ? 'var(--income)' : 'var(--expense)',
    container: good ? 'var(--income-container)' : 'var(--expense-container)',
    arrow: pctChange > 0 ? 'arrow_upward' : 'arrow_downward',
  }
}
