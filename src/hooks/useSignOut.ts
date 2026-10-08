import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { signOutWarnings } from '@/lib/browserStorage'
import { flaggedCount, listQueue, pendingCount } from '@/lib/offlineQueue'
import { PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'

export interface SignOutConfirmState {
  /** What would be lost; null while the confirmation is closed. */
  warnings: string[] | null
  busy: boolean
  confirm: () => void
  cancel: () => void
}

/**
 * Sign-out that asks first when this device holds anything not yet synced (LED-323). Sign-out
 * clears the offline queue, pending receipts and unsaved settings, so with nothing waiting it
 * signs out at once; otherwise `confirm` carries the warnings for <SignOutConfirm>.
 */
export function useSignOut(onDone?: (ok: boolean) => void): { request: () => void; confirm: SignOutConfirmState } {
  const { signOut, hasPendingSettings } = useAuth()
  const [warnings, setWarnings] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    const ok = await signOut()
    setBusy(false)
    setWarnings(null)
    onDone?.(ok)
  }

  const request = () => {
    const withReceipt = listQueue().filter(
      (item) => typeof item.payload.receipt_url === 'string' && item.payload.receipt_url.startsWith(PENDING_RECEIPT_PREFIX),
    ).length
    const lines = signOutWarnings({
      pending: pendingCount(),
      flagged: flaggedCount(),
      withReceipt,
      pendingSettings: hasPendingSettings(),
    })
    if (lines.length === 0) void run()
    else setWarnings(lines)
  }

  return {
    request,
    confirm: { warnings, busy, confirm: () => void run(), cancel: () => { if (!busy) setWarnings(null) } },
  }
}
