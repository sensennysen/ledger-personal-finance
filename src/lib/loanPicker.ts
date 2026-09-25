import type { EditTargetKind } from './editTarget.ts'

/**
 * The loan a repayment form should open on, or null to leave the choice to the user.
 * Only a locked loan or the user's single loan is picked for them; with two or more,
 * an automatic pick would record a payment against an arbitrary debt.
 */
export function resolveInitialLoanId(
  loans: { id: string }[],
  lockedLoanAccountId: string | null | undefined,
  editTarget: EditTargetKind,
): string | null {
  if (lockedLoanAccountId) return lockedLoanAccountId
  if (editTarget === 'loan') return null
  return loans.length === 1 ? loans[0].id : null
}
