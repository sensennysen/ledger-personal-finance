import type { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { AlertTriangle, Clock, CloudOff, RefreshCw } from 'lucide-react'

const TONES = {
  offline: { background: 'var(--expense-container)', color: 'var(--expense)' },
  syncing: { background: 'var(--primary)', color: 'var(--primary-foreground)' },
  pending: { background: 'var(--warning-container)', color: 'var(--warning)' },
}

export function OfflineBanner({
  status,
  onReview,
}: {
  status: ReturnType<typeof useNetworkStatus>
  onReview: () => void
}) {
  const { isOnline, isSyncing, pendingCount, flaggedCount, failedCount, syncProgress, syncNow, storageError } = status

  if (isOnline && pendingCount === 0 && flaggedCount === 0) return null

  // Offline with nowhere to keep changes: a genuine failure, so it is red, not the pending gold.
  if (!isOnline && storageError) {
    return (
      <div
        role="alert"
        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
        style={{ background: 'var(--expense-container)', color: 'var(--expense)' }}
      >
        <AlertTriangle className="size-4 shrink-0" />
        Offline — {storageError}
      </div>
    )
  }

  if (flaggedCount > 0) {
    return (
      <div
        role="alert"
        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
        style={{ background: 'var(--expense-container)', color: 'var(--expense)' }}
      >
        <AlertTriangle className="size-4 shrink-0" />
        {flaggedCount} change{flaggedCount !== 1 ? 's' : ''}{' '}
        {failedCount === flaggedCount ? "couldn't be saved and" : "didn't sync and"} need
        {flaggedCount === 1 ? 's' : ''} your review{' '}
        <button type="button" onClick={onReview} className="underline underline-offset-2 font-semibold">
          Review
        </button>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
      style={TONES[!isOnline ? 'offline' : isSyncing ? 'syncing' : 'pending']}
    >
      {!isOnline && (
        <>
          <CloudOff className="size-4 shrink-0" />
          {pendingCount === 0
            ? "Offline — you're not connected"
            : `Offline — ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} will sync when you reconnect`}
        </>
      )}
      {isOnline && isSyncing && (
        <>
          <span
            className="inline-block w-3 h-3 rounded-full border border-t-transparent animate-spin"
            style={{
              borderColor: 'currentColor',
              borderTopColor: 'transparent',
            }}
          />
          Syncing {syncProgress?.done ?? 0} of {syncProgress?.total ?? pendingCount} change
          {(syncProgress?.total ?? pendingCount) !== 1 ? 's' : ''}…
        </>
      )}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <Clock className="size-4 shrink-0" aria-hidden />
          Back online — {pendingCount} change{pendingCount !== 1 ? 's' : ''} still queued{' '}
          <button
            type="button"
            onClick={() => void syncNow()}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
            style={{ background: 'var(--warning)', color: 'var(--warning-container)' }}
          >
            <RefreshCw className="size-3" aria-hidden />
            Sync now
          </button>
        </>
      )}
    </div>
  )
}
