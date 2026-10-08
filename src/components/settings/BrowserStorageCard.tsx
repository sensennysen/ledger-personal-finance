import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, HardDrive } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSignOut } from '@/hooks/useSignOut'
import { SignOutConfirm } from '@/components/layout/SignOutConfirm'
import { useNotify } from '@/contexts/notificationState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { STORAGE_ROWS, keysInGroup, unsyncedWarning, type StorageRow } from '@/lib/browserStorage'
import { clearOfflineQueue, listQueue } from '@/lib/offlineQueue'
import { clearPendingReceipts, PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'

function localStorageKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) keys.push(key)
  }
  return keys
}

/**
 * Settings → Browser storage (LED-245): each group the Cookies and storage notice lists, what it is
 * for, and a way to clear it on this device. The session is cleared by signing out; the offline
 * queue and pending receipts say what would be lost before they go.
 */
export function BrowserStorageCard() {
  const { user } = useAuth()
  const signOut = useSignOut()
  const notify = useNotify()
  const [confirming, setConfirming] = useState<StorageRow | null>(null)
  const [clearing, setClearing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()

  // The Cookies and storage notice links here as /settings#browser-storage.
  useEffect(() => {
    if (hash === '#browser-storage') cardRef.current?.scrollIntoView({ block: 'start' })
  }, [hash])

  const queue = confirming ? listQueue() : []
  const withReceipt = queue.filter(
    (item) => typeof item.payload.receipt_url === 'string' && item.payload.receipt_url.startsWith(PENDING_RECEIPT_PREFIX),
  ).length
  const warning = confirming ? unsyncedWarning(confirming, queue.length, withReceipt) : null

  const clear = async (row: StorageRow) => {
    setClearing(true)
    try {
      if (row.clear === 'queue') await clearOfflineQueue()
      else if (row.clear === 'receipts') await clearPendingReceipts()
      else for (const key of keysInGroup(row, localStorageKeys(), user?.id ?? null)) localStorage.removeItem(key)
    } catch (err) {
      setClearing(false)
      setConfirming(null)
      notify({
        severity: 'failure',
        title: `Couldn't clear ${row.what.toLowerCase()}`,
        body: err instanceof Error ? err.message : 'Try again.',
        action: { label: 'Retry', run: () => void clear(row) },
      })
      return
    }
    if (row.reload) {
      // These are held in memory too; reload so the app reads the defaults back.
      window.location.reload()
      return
    }
    setClearing(false)
    setConfirming(null)
    notify({ severity: 'success', title: `${row.what} cleared on this device` })
  }

  return (
    <Card ref={cardRef} id="browser-storage" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HardDrive className="w-4 h-4" /> Browser storage</CardTitle>
        <CardDescription>
          What Ledger keeps on this device, and why. See the{' '}
          <Link to="/cookies" className="text-primary underline-offset-4 hover:underline">Cookies and storage notice</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border border-t border-border">
          {STORAGE_ROWS.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{row.what}</p>
                <p className="text-xs text-muted-foreground">{row.why}.</p>
              </div>
              {row.clear === 'signOut' ? (
                <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={signOut.request}>
                  Sign out
                </Button>
              ) : row.clear === 'none' ? (
                <p className="shrink-0 text-xs text-muted-foreground sm:max-w-48 sm:text-right">{row.removed}</p>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={() => setConfirming(row)}
                  aria-label={`Clear ${row.what.toLowerCase()} on this device`}
                >
                  Clear on this device
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open && !clearing) setConfirming(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {confirming?.what.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Only this browser is affected.
                {confirming?.reload ? ' Ledger reloads to use the defaults.' : ''}
              </span>
              {warning && (
                <span className="flex items-start gap-2 font-medium text-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  {warning}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <Button
              variant={warning ? 'destructive' : 'default'}
              disabled={clearing}
              onClick={() => confirming && void clear(confirming)}
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SignOutConfirm {...signOut.confirm} />
    </Card>
  )
}
