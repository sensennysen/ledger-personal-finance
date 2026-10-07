/**
 * The one subscription contract for "this entity changed" (LED-306). invalidateAfterWrite raises
 * it after a write or a queue drain; hooks that read outside the shared store (budgets, loan
 * purchases, a card's payment history) register a refetch here.
 */

import type { ReadEntity } from './invalidation.ts'

type Listener = () => void

const listeners = new Map<ReadEntity, Set<Listener>>()

export function registerEntityListener(entity: ReadEntity, cb: Listener): () => void {
  let set = listeners.get(entity)
  if (!set) {
    set = new Set()
    listeners.set(entity, set)
  }
  set.add(cb)
  return () => { set.delete(cb) }
}

export function notifyEntityChanged(entity: ReadEntity): void {
  listeners.get(entity)?.forEach((cb) => cb())
}
