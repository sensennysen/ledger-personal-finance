export interface BalanceAdjustment {
  type: 'income' | 'expense'
  amount: number
}

/**
 * An account edit that changes the balance is two writes: the account fields, then a
 * balance-adjustment transaction (a trigger applies it to the balance). Splitting the
 * plan out lets a failed second write be rerun without saving the account again.
 */
export function planAccountSave<T extends { balance?: number }>(
  oldBalance: number,
  values: T,
): { updatePayload: T; adjustment: BalanceAdjustment | null } {
  const newBalance = values.balance ?? oldBalance
  if (newBalance === oldBalance) return { updatePayload: { ...values }, adjustment: null }

  const updatePayload = { ...values }
  delete updatePayload.balance
  const diff = newBalance - oldBalance
  return {
    updatePayload,
    adjustment: { type: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff) },
  }
}
