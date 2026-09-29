import { formatCurrency } from '@/lib/utils'
import { signPrefix } from '@/lib/netSign'

/** Signed per-currency amounts joined with " · "; currencies are never added together. */
export function formatNet(net: Record<string, number>): string {
  return Object.entries(net)
    .map(([currency, amount]) => `${signPrefix(amount)}${formatCurrency(Math.abs(amount), currency)}`)
    .join(' · ')
}
