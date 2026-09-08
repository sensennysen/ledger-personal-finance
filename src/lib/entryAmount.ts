/** Decimal keypad editing without floating-point rounding or duplicate separators. */
export function editEntryAmount(previous: string, key: string): string {
  if (key === 'delete')
    return previous.length <= 1 ? '0' : previous.slice(0, -1)
  if (key === '.') return previous.includes('.') ? previous : previous + '.'
  if (!/^\d$/.test(key)) return previous
  if (previous.replace('.', '').length >= 12) return previous
  if (previous.includes('.') && previous.split('.')[1].length >= 2)
    return previous
  return previous === '0' ? key : previous + key
}
