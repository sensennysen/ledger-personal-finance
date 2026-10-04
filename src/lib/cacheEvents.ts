/**
 * Module-level event bus for cross-hook cache invalidation.
 * Used when an offline mutation in one hook needs to trigger a state reload
 * in another hook without going through React context.
 */

type Listener = () => void

const accountsListeners = new Set<Listener>()
const loanPurchasesListeners = new Set<Listener>()
const transactionsListeners = new Set<Listener>()

export function registerAccountsListener(cb: Listener): () => void {
  accountsListeners.add(cb)
  return () => accountsListeners.delete(cb)
}

export function notifyAccountsRefresh(): void {
  accountsListeners.forEach((cb) => cb())
}

export function registerLoanPurchasesListener(cb: Listener): () => void {
  loanPurchasesListeners.add(cb)
  return () => loanPurchasesListeners.delete(cb)
}

export function notifyLoanPurchasesRefresh(): void {
  loanPurchasesListeners.forEach((cb) => cb())
}

/** A card payment was recorded, changed or removed; the card page re-reads its payment history (LED-192). */
const cardPaymentsListeners = new Set<Listener>()

export function registerCardPaymentsListener(cb: Listener): () => void {
  cardPaymentsListeners.add(cb)
  return () => cardPaymentsListeners.delete(cb)
}

export function notifyCardPaymentsRefresh(): void {
  cardPaymentsListeners.forEach((cb) => cb())
}

/** A transactions hook wrote its cache (an offline create, edit or delete); the others re-read theirs. */
export function registerTransactionsListener(cb: Listener): () => void {
  transactionsListeners.add(cb)
  return () => transactionsListeners.delete(cb)
}

export function notifyTransactionsRefresh(): void {
  transactionsListeners.forEach((cb) => cb())
}
