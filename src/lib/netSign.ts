/** U+2212, the minus sign 29a draws for negative money (a hyphen is too short and reads as a dash). */
export const MINUS = '−'

/** The sign shown before an amount: '+' for money in, U+2212 for money out, nothing for zero. */
export function signPrefix(amount: number): string {
  return amount > 0 ? '+' : amount < 0 ? MINUS : ''
}
