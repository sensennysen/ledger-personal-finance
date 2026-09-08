import type { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { CloudOff } from 'lucide-react'

export function OfflineBanner({
  status,
}: {
  status: ReturnType<typeof useNetworkStatus>
}) {
  const { isOnline, isSyncing, pendingCount } = status

  if (isOnline && pendingCount === 0) return null

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
