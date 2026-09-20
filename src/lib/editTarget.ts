export type EditTargetKind = 'none' | 'pending' | 'missing' | 'loan' | 'card' | 'other'

/**
 * What an edited expense's target account is. Only the target's type decides between a
 * loan repayment and a card payment; when the accounts are not loaded yet ('pending') or
 * the target is not among them ('missing') the caller must not guess.
 */
export function resolveEditTarget(
  targetId: string | null | undefined,
  accounts: { id: string; type: string }[],
): EditTargetKind {
  if (!targetId) return 'none'
  if (accounts.length === 0) return 'pending'
  const target = accounts.find((account) => account.id === targetId)
  if (!target) return 'missing'
  if (target.type === 'loan') return 'loan'
  if (target.type === 'credit_card') return 'card'
  return 'other'
}
