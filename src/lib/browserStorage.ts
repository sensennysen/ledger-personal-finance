// What Ledger keeps in the browser, and how each group is cleared (LED-245). Pure: the Cookies and
// storage notice lists these rows and Settings clears them, so both read one list.
//
// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). Every key below is
// one the code writes; tests/legalPages.test.mjs fails when a new one appears without a row here.
// The rows for settings moved to the account (LED-263 to LED-268: preferences, Home layout, setup
// checklist, card reminders, 13th month picks) were approved by the owner on 2026-10-06. The templates
// row (LED-257) is still a draft the owner reviews in the epic-22 pull request.

/**
 * How Settings clears a group on this device. `keys` removes the matching local storage keys;
 * `signOut` and `queue` go through the code that owns them, so listeners hear of it; `receipts` empties
 * the IndexedDB store; `none` is not cleared from inside Ledger.
 */
export type ClearKind = 'signOut' | 'keys' | 'queue' | 'receipts' | 'none'

export interface StorageRow {
  id: string
  what: string
  keys: string[]
  where: string
  why: string
  removed: string
  clear: ClearKind
  /** Whether a key belongs to this group, for the signed-in user. Only `keys` groups need one. */
  match?: (key: string, userId: string | null) => boolean
  /** The app holds this group in memory too, so it reloads after clearing to read the defaults back. */
  reload?: boolean
}

const exactly = (...names: string[]) => (key: string) => names.includes(key)

export const STORAGE_ROWS: StorageRow[] = [
  {
    id: 'session',
    what: 'Sign-in session',
    keys: ['sb-…-auth-token'],
    where: 'local storage',
    why: 'Keeps you signed in',
    removed: 'When you sign out',
    clear: 'signOut',
  },
  {
    id: 'cache',
    what: 'A copy of your data',
    keys: ['ledger_cache:…'],
    where: 'local storage',
    why: 'Opens fast and works offline; refreshed from the server, kept up to 24 hours',
    removed: 'When you sign out or delete your account',
    clear: 'keys',
    match: (key) => key.startsWith('ledger_cache:'),
  },
  {
    id: 'queue',
    what: 'Changes waiting to sync',
    keys: ['ledger_offline_queue'],
    where: 'IndexedDB',
    why: 'Changes made offline, sent when you reconnect',
    removed: 'When they sync, or when you sign out',
    clear: 'queue',
  },
  {
    id: 'receipts',
    what: 'Receipts waiting to upload',
    keys: ['ledger_receipts'],
    where: 'IndexedDB',
    why: 'Receipt images attached offline',
    removed: 'When they upload, or when you sign out',
    clear: 'receipts',
  },
  {
    id: 'appearance',
    what: 'Theme, text size and accent colour',
    keys: ['ledger-theme', 'ledger-font-size', 'ledger-accent-color'],
    where: 'local storage',
    why: 'Your appearance settings',
    removed: 'When you clear site data',
    clear: 'keys',
    match: exactly('ledger-theme', 'ledger-font-size', 'ledger-accent-color'),
    reload: true,
  },
  {
    id: 'preferences',
    what: 'Preferences (older copy)',
    keys: ['ledger-preferences'],
    where: 'local storage',
    why: 'Number and date format, list view and notification settings saved on this browser before they were kept in your account. Ledger copies them to your account the next time you sign in, then removes them here',
    removed: 'When they are copied to your account, or when you sign out',
    clear: 'keys',
    match: exactly('ledger-preferences'),
    reload: true,
  },
  {
    id: 'home-layout',
    what: 'Home layout (older copy)',
    keys: ['ledger-dashboard-widgets', 'ledger-dashboard-widget-order'],
    where: 'local storage',
    why: 'Which Home widgets show, and their order, saved on this browser before they were kept in your account. Ledger copies them to your account the next time you sign in, then removes them here',
    removed: 'When they are copied to your account, or when you sign out',
    clear: 'keys',
    match: exactly('ledger-dashboard-widgets', 'ledger-dashboard-widget-order'),
    reload: true,
  },
  {
    id: 'checklist',
    what: 'Setup checklist (older copy)',
    keys: ['ledger-first-run'],
    where: 'local storage',
    why: 'Whether you confirmed your pay cycle or dismissed the checklist, saved on this browser before it was kept in your account. Ledger copies it to your account the next time you sign in, then removes it here',
    removed: 'When it is copied to your account, or when you sign out',
    clear: 'keys',
    match: exactly('ledger-first-run'),
    reload: true,
  },
  {
    id: 'templates',
    what: 'Saved templates (older copy)',
    keys: ['ledger_transaction_templates'],
    where: 'local storage',
    why: 'Templates saved on this browser before they were kept in your account. Ledger copies them to your account the next time you open Activity, then removes them here',
    removed: 'When they are copied to your account, or when you sign out',
    clear: 'keys',
    match: exactly('ledger_transaction_templates'),
    reload: true,
  },
  {
    id: 'card-reminders',
    what: 'Card reminders already shown (older copy)',
    keys: ['<your id>:cc-notifs-sent'],
    where: 'local storage',
    why: 'The card reminders this browser showed before they were kept in your account. Ledger copies them to your account the next time it checks your cards, then removes them here',
    removed: 'When they are copied to your account, or when you sign out',
    clear: 'keys',
    match: (key, userId) => userId !== null && key === `${userId}:cc-notifs-sent`,
  },
  {
    id: 'thirteenth-month',
    what: '13th month picks (older copy)',
    keys: ['13th-month-selection:<your id>:<year>'],
    where: 'local storage',
    why: 'The transactions you picked for the estimate on this browser before they were kept in your account. Ledger copies them to your account the next time you open 13th Month Pay, then removes them here',
    removed: 'When they are copied to your account, or when you sign out',
    clear: 'keys',
    match: (key, userId) => userId !== null && key.startsWith(`13th-month-selection:${userId}:`),
  },
  {
    id: 'install-banner',
    what: 'Install banner',
    keys: ['ledger_pwa_install_dismissed'],
    where: 'local storage',
    why: 'Remembers that you closed the install prompt',
    removed: 'When you clear site data',
    clear: 'keys',
    match: exactly('ledger_pwa_install_dismissed'),
    reload: true,
  },
  {
    id: 'app-files',
    what: 'App files and fonts',
    keys: [],
    where: 'browser cache (service worker)',
    why: 'Lets the app load offline; fonts kept for a year',
    removed: 'When the app updates, or you clear site data',
    clear: 'none',
  },
]

// What sign-out removes as plain keys (LED-268): the data copy and every older copy of a group that now
// lives in the account, whoever's they are, so the next person on this browser finds none of them.
// The session, the queue and pending receipts go through their owners. Appearance and the install
// banner flag stay: they are this device's, not the account's (decision C).
const PERSONAL_EXACT = [
  'ledger-preferences',
  'ledger-dashboard-widgets',
  'ledger-dashboard-widget-order',
  'ledger-first-run',
  'ledger_transaction_templates',
]

export function isPersonalKey(key: string): boolean {
  return key.startsWith('ledger_cache:')
    || PERSONAL_EXACT.includes(key)
    || key.endsWith(':cc-notifs-sent')
    || key.startsWith('13th-month-selection:')
}

/** Removes every personal key from this browser, at sign-out and account deletion. */
export function forgetPersonalBrowserCopies(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && isPersonalKey(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

/** The keys among `allKeys` that clearing `row` removes: exactly its own, and only the signed-in user's. */
export function keysInGroup(row: StorageRow, allKeys: string[], userId: string | null): string[] {
  if (row.clear !== 'keys' || !row.match) return []
  return allKeys.filter((key) => row.match!(key, userId))
}

/** What the confirmation says will be lost, or null when nothing would be. */
export function unsyncedWarning(row: StorageRow, queued: number, queuedWithReceipt: number): string | null {
  if (row.clear === 'queue' && queued > 0) {
    return `${queued} change${queued === 1 ? '' : 's'} not yet synced will be lost. They will not reach your account.`
  }
  if (row.clear === 'receipts' && queuedWithReceipt > 0) {
    return `${queuedWithReceipt} transaction${queuedWithReceipt === 1 ? '' : 's'} waiting to sync will be saved without ${queuedWithReceipt === 1 ? 'its' : 'their'} receipt.`
  }
  return null
}
