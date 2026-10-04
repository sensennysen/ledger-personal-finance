export interface FirstRunStep {
  id: 'account' | 'transaction' | 'cycle'
  title: string
  description: string
}

export const FIRST_RUN_STEPS: FirstRunStep[] = [
  {
    id: 'account',
    title: 'Add your first account',
    description:
      'A bank account, cash, a card or a loan. Everything else measures against these.',
  },
  {
    id: 'transaction',
    title: 'Record something, or import a statement',
    description: 'One transaction is enough to start. Or drop in a bank CSV.',
  },
  {
    id: 'cycle',
    title: 'Set your pay cycle',
    description:
      'Budgets follow when you get paid, not the calendar month. Default is the 1st.',
  },
]

export interface FirstRunProgress {
  hasAccount: boolean
  hasTransaction: boolean
  cycleConfirmed: boolean
}

export interface FirstRunStepStatus extends FirstRunStep {
  done: boolean
}

export function getStepStatus(progress: FirstRunProgress): FirstRunStepStatus[] {
  const done: Record<FirstRunStep['id'], boolean> = {
    account: progress.hasAccount,
    transaction: progress.hasTransaction,
    cycle: progress.cycleConfirmed,
  }
  return FIRST_RUN_STEPS.map((step) => ({ ...step, done: done[step.id] }))
}

/**
 * `loading` means accounts/transactions are still being read. The shell must
 * not lock nav on a query that hasn't answered yet (LED-95), so an unknown
 * answer counts as complete — unless the locally stored cycle flag already
 * says setup isn't done.
 */
export function isSetupComplete(
  progress: FirstRunProgress,
  { loading = false }: { loading?: boolean } = {},
): boolean {
  if (!progress.cycleConfirmed) return false
  if (loading) return true
  return progress.hasAccount && progress.hasTransaction
}

/**
 * While accounts and transactions load, Home reserves the checklist's space only when the card is
 * certain to show (LED-199). It shows unless setup is complete, and `isSetupComplete` is false for
 * every user whose pay cycle is not confirmed, a flag stored on the device and known before paint.
 * A user who confirmed the cycle may or may not see it until the reads answer, so nothing is
 * reserved: a card that then does not show would shift Home the other way.
 */
export function shouldReserveChecklist({
  dismissed,
  cycleConfirmed,
}: {
  dismissed: boolean
  cycleConfirmed: boolean
}): boolean {
  if (dismissed) return false
  return !isSetupComplete({ hasAccount: false, hasTransaction: false, cycleConfirmed }, { loading: true })
}
