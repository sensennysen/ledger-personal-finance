import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount } = useNetworkStatus()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-medium tracking-wide"
      style={{
        background: isOnline ? 'oklch(0.700 0.115 72)' : 'oklch(0.45 0.08 40)',
        color: isOnline ? 'oklch(0.20 0.04 40)' : 'oklch(0.96 0.01 80)',
      }}
    >
      {!isOnline && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          You're offline — changes will sync when reconnected
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </>
      )}
      {isOnline && isSyncing && (
        <>
          <span
            className="inline-block w-3 h-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
          />
          Syncing {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}…
        </>
      )}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued — reconnecting…
        </>
      )}
    </div>
  )
}
