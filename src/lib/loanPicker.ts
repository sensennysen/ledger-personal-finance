import type { EditTargetKind } from './editTarget.ts'
import type { LoanDeadline } from './loanInstallments.ts'

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

export interface LoanChoice {
  id: string
  name: string
  schedule: string | null
  outstanding: number
  /** The installment falling in the current cycle, or null when none does. */
  nextDeadline: { date: string; amount: number } | null
}

/** Nearest due date first, then largest outstanding. Loans with nothing due sort after those with a date. */
export function sortLoanChoices(choices: LoanChoice[]): LoanChoice[] {
  return [...choices].sort((left, right) => {
    if (left.nextDeadline && right.nextDeadline) {
      const byDate = left.nextDeadline.date.localeCompare(right.nextDeadline.date)
      if (byDate !== 0) return byDate
    } else if (left.nextDeadline || right.nextDeadline) {
      return left.nextDeadline ? -1 : 1
    }
    return right.outstanding - left.outstanding
  })
}

interface PickerGateInput {
  loanCount: number
  lockedLoanAccountId: string | null | undefined
  isEditing: boolean
}

/** Whether a repayment form starts with a loan-picker step: only when the user has to choose between loans. */
export function hasLoanPickerStep({ loanCount, lockedLoanAccountId, isEditing }: PickerGateInput): boolean {
  return !lockedLoanAccountId && !isEditing && loanCount >= 2
}

/**
 * The nearest unpaid deadline due on or before the end of the current cycle, or null when none is.
 * `deadlines` comes from getLoanDeadlines, so it is ascending and unpaid; an overdue one counts.
 */
export function nextDeadlineInCycle(deadlines: LoanDeadline[], cycleEnd: string): LoanDeadline | null {
  return deadlines.find((deadline) => deadline.dueDate <= cycleEnd) ?? null
}
