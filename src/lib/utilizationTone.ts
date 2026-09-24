// Credit utilisation colour as a scale (LED-77), not a snap from green to red:
// income at 0%, gold (--primary, "liability due") at the card's target, expense at 100%.

function mix(from: string, to: string, t: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, t)) * 100)
  if (pct === 0) return `var(${from})`
  if (pct === 100) return `var(${to})`
  return `color-mix(in oklch, var(${to}) ${pct}%, var(${from}))`
}

export function utilizationTone(pct: number, targetPct: number = 30): string {
  const target = Math.min(99, Math.max(1, targetPct))
  if (!Number.isFinite(pct) || pct <= 0) return 'var(--income)'
  if (pct < target) return mix('--income', '--primary', pct / target)
  return mix('--primary', '--expense', (pct - target) / (100 - target))
}

/** Pass as `style` to <Progress>; its indicator reads --progress-tone. */
export function utilizationToneStyle(pct: number, targetPct?: number): Record<string, string> {
  return { '--progress-tone': utilizationTone(pct, targetPct) }
}

/** Class for a <Progress> given utilizationToneStyle: its indicator takes the tone. */
export const TONED_PROGRESS_CLASS = '[&_[data-slot=progress-indicator]]:bg-(--progress-tone)'
