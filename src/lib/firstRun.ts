// The setup checklist state (LED-265). Pure: stored as two times in `profiles`, null until the user
// dismissed the checklist or confirmed their pay cycle.

export interface FirstRunColumns {
  setup_checklist_dismissed_at?: string | null
  pay_cycle_confirmed_at?: string | null
}

/** Where the checklist state lived before LED-265: one key for the whole browser. */
export const LEGACY_FIRST_RUN_KEY = 'ledger-first-run'

export function firstRunState(profile: FirstRunColumns | null | undefined): { dismissed: boolean; cycleConfirmed: boolean } {
  return {
    dismissed: Boolean(profile?.setup_checklist_dismissed_at),
    cycleConfirmed: Boolean(profile?.pay_cycle_confirmed_at),
  }
}

/**
 * The columns the browser's old key sets: each one the key marks done and the account has not
 * recorded yet, stamped `now`. Empty when there is nothing to upload.
 */
export function legacyFirstRunUpload(raw: string | null, profile: FirstRunColumns, now: string): FirstRunColumns {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const { dismissed, cycleConfirmed } = parsed as Record<string, unknown>
  const upload: FirstRunColumns = {}
  if (dismissed === true && !profile.setup_checklist_dismissed_at) upload.setup_checklist_dismissed_at = now
  if (cycleConfirmed === true && !profile.pay_cycle_confirmed_at) upload.pay_cycle_confirmed_at = now
  return upload
}

export function readLegacyFirstRun(): string | null {
  try {
    return localStorage.getItem(LEGACY_FIRST_RUN_KEY)
  } catch {
    return null
  }
}

/** Removes the old browser-wide key: after an upload, and on sign-out. */
export function forgetLegacyFirstRun(): void {
  try {
    localStorage.removeItem(LEGACY_FIRST_RUN_KEY)
  } catch {
    /* storage unavailable: nothing to remove */
  }
}
