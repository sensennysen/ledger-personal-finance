import type { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { AlertTriangle, CloudOff } from 'lucide-react'

export function OfflineBanner({
  status,
  onReview,
}: {
  status: ReturnType<typeof useNetworkStatus>
  onReview: () => void
}) {
  const { isOnline, isSyncing, pendingCount, flaggedCount } = status

  if (isOnline && pendingCount === 0 && flaggedCount === 0) return null

  if (flaggedCount > 0) {
    return (
      <div
        role="alert"
        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-[0.6875rem] font-medium tracking-wide"
        style={{ background: 'var(--expense-container)', color: 'var(--expense)' }}
      >
        <AlertTriangle className="size-4 shrink-0" />
        {flaggedCount} change{flaggedCount !== 1 ? 's' : ''} didn't sync and need
        {flaggedCount === 1 ? 's' : ''} your review
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
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-[0.6875rem] font-medium tracking-wide"
      style={{
        background: isOnline ? 'var(--primary)' : 'var(--expense-container)',
        color: isOnline ? 'var(--primary-foreground)' : 'var(--expense)',
      }}
    >
      {!isOnline && (
        <>
          <CloudOff className="size-4 shrink-0" />
          Offline — {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'}{' '}
          will sync when you reconnect
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
          Syncing {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}…
        </>
      )}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued —
          reconnecting…
        </>
      )}
    </div>
  )
}
