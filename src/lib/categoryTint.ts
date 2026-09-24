/**
 * Category colors are stored as the light-theme hue. In dark they step one
 * tint lighter (Tailwind 500 → 400, per the design's body.dark tokens) so
 * swatches hold against dark surfaces. Custom colors outside the palette are
 * returned unchanged.
 */
const DARK_TINT: Record<string, string> = {
  '#6366f1': '#818CF8',
  '#8b5cf6': '#A78BFA',
  '#ec4899': '#F472B6',
  '#ef4444': '#F87171',
  '#f97316': '#FB923C',
  '#eab308': '#FACC15',
  '#22c55e': '#4ADE80',
  '#14b8a6': '#2DD4BF',
  '#3b82f6': '#60A5FA',
  '#06b6d4': '#22D3EE',
  '#a855f7': '#C084FC',
  '#f43f5e': '#FB7185',
  '#84cc16': '#A3E635',
  '#f59e0b': '#FBBF24',
  '#10b981': '#34D399',
  '#6b7280': '#9CA3AF',
  '#94a3b8': '#CBD5E1',
}

export function categoryInk(hex: string, theme: 'light' | 'dark'): string {
  if (theme !== 'dark') return hex
  return DARK_TINT[hex.trim().toLowerCase()] ?? hex
}
