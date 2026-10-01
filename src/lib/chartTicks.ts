const UNITS: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
]

const oneDecimal = (n: number) => Math.round(n * 10) / 10

/**
 * Short y-axis tick label for a money chart: 8000 → "8k", 1200000 → "1.2M".
 * No currency symbol; the tooltip carries the full formatted amount.
 */
export function abbreviateTick(value: number): string {
  const abs = Math.abs(value)
  const whole = Math.round(abs)
  if (whole === 0) return '0'
  const sign = value < 0 ? '−' : ''
  for (let i = 0; i < UNITS.length; i++) {
    const [size, suffix] = UNITS[i]
    if (whole < size) continue
    const scaled = oneDecimal(abs / size)
    // 999,960 rounds to "1000k"; say "1M" instead.
    if (scaled >= 1000 && i > 0) return `${sign}${oneDecimal(abs / UNITS[i - 1][0])}${UNITS[i - 1][1]}`
    return `${sign}${scaled}${suffix}`
  }
  return `${sign}${whole}`
}
