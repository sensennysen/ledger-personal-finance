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

export function isSetupComplete(progress: FirstRunProgress): boolean {
  return progress.hasAccount && progress.hasTransaction && progress.cycleConfirmed
}
