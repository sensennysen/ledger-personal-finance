import { formatCurrency } from '@/lib/utils'

/** Signed per-currency amounts joined with " · "; currencies are never added together. */
export function formatNet(net: Record<string, number>): string {
  return Object.entries(net)
    .map(([currency, amount]) => `${amount > 0 ? '+' : amount < 0 ? '-' : ''}${formatCurrency(Math.abs(amount), currency)}`)
    .join(' · ')
}
