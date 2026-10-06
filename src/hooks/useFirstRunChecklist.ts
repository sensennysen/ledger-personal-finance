import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { firstRunState } from '@/lib/firstRun'

/**
 * Whether the setup checklist was dismissed and the pay cycle confirmed (LED-265), kept in the
 * profile so a new device and the next person on this browser each see their own. Saving goes
 * through `patchProfile`, which reports a failed save.
 */
export function useFirstRunChecklist() {
  const { profile, patchProfile } = useAuth()
  const { dismissed, cycleConfirmed } = firstRunState(profile)

  const dismiss = useCallback(() => {
    if (dismissed) return
    patchProfile({ setup_checklist_dismissed_at: new Date().toISOString() })
  }, [dismissed, patchProfile])

  const confirmCycle = useCallback(() => {
    if (cycleConfirmed) return
    patchProfile({ pay_cycle_confirmed_at: new Date().toISOString() })
  }, [cycleConfirmed, patchProfile])

  return {
    dismissed,
    cycleConfirmed,
    dismiss,
    confirmCycle,
  }
}
