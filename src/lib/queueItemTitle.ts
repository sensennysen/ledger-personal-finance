// Pure queue-item display helpers (no imports) so they can be unit-tested under plain node.
import { MAX_ATTEMPTS, type QueueItem } from './queueState.ts'

/** Tables that get queued today, and what one row of each is called. Extend as new tables start queuing. */
const TABLE_NAMES: Record<string, string> = {
  transactions: 'Transaction',
  profiles: 'Profile',
}

/** A readable, singular name for a table this app doesn't recognise — never the raw table string. */
function humanizeTable(table: string): string {
  if (TABLE_NAMES[table]) return TABLE_NAMES[table]
  const spaced = table.replace(/_/g, ' ')
  const singular = spaced.endsWith('s') ? spaced.slice(0, -1) : spaced
  return singular.charAt(0).toUpperCase() + singular.slice(1)
}

function pickName(source: Record<string, unknown> | undefined): string | undefined {
  if (!source) return undefined
  const name = source.description ?? source.name ?? source.title
  return typeof name === 'string' && name ? name : undefined
}

/**
 * The row an item changes, by what it is — its own label (captured at enqueue
 * time, since a delete or a partial update may not carry a name), then its
 * payload, then what the server held when a conflict was found. Falls back to
 * the table's singular name, never the raw table string (LED-160).
 */
export function itemTitle(item: QueueItem): string {
  return item.label ?? pickName(item.payload) ?? pickName(item.serverSnapshot) ?? humanizeTable(item.table)
}

const OPERATION_LABEL = { insert: 'New', update: 'Edit', delete: 'Delete' } as const

export function itemNote(item: QueueItem): string {
  if (item.status === 'conflict') {
    if (item.conflictKind === 'deleted') return 'Deleted on another device since you queued this'
    return `Edited on another device since you queued this${item.operation === 'delete' ? ' delete' : ''}`
  }
  if (item.status === 'failed') return `Couldn't save after ${MAX_ATTEMPTS} tries${item.lastError ? `: ${item.lastError}` : ''}`
  if (item.status === 'expired') return 'Waited more than 30 days to sync'
  // Still pending, but the last drain could not check the saved copy, so it wrote nothing (LED-297).
  if (item.lastError && !item.attempts) return item.lastError
  return `${OPERATION_LABEL[item.operation]} · ${humanizeTable(item.table)}`
}
