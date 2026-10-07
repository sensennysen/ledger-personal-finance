// What a read shows offline (LED-307). Pure, shared by every entity read through the store.

/**
 * Offline with nothing on this device for the read (never read here, or the copy outlived its TTL),
 * the store pauses it until the connection returns. That is not loading: the screen says the list
 * is unavailable, and the read resumes on its own once online.
 */
export function offlineUnavailable({ hasData, paused }: { hasData: boolean; paused: boolean }): boolean {
  return paused && !hasData
}

/** The sentence for that state; `label` names the list ("your accounts", "these transactions"). */
export function offlineNoCopyMessage(label: string): string {
  return `You're offline and this device has no saved copy of ${label}. They load when you're back online.`
}
