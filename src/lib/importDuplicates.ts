import { EMPTY_DESCRIPTION } from './csvImport.ts'
import { transferCredit } from './transferCredit.ts'

// Import duplicate detection (LED-73): a CSV row that matches a transaction
// already in the account on date + amount + type + normalised description is
// flagged before the write, so a re-imported or overlapping statement doesn't
// silently add every row twice.
//
// Transfers and loan repayments (LED-75, LED-147) match on date + amount + direction only: the other bank
// words the same movement differently, so once one statement's side is
// imported as a transfer, the other statement's side is flagged too.
//
// A row imported from a statement in another currency is stored converted, at the rate of the
// day (LED-136), together with the statement's own amount and currency. Importing the same
// statement again at a different rate converts to different amounts, so those rows also match on
// the original amount and currency: the same statement is caught whatever the rate. A transfer
// imported that way keeps its original too, and matches on it by direction (LED-225).

export interface ImportCandidate {
  /** 1-based data row number in the file. */
  line: number
  date: string | null
  amount: number | null
  type: 'income' | 'expense' | null
  description: string
  /** The statement's own amount and currency, when the statement is not in the account's currency. */
  original?: { amount: number; currency: string } | null
}

export interface ExistingTx {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  description: string | null
  account_id: string
  to_account_id: string | null
  exchange_rate: number | null
  /** What a transfer between two currencies credited its destination (LED-185). */
  destination_amount?: number | null
  /** Set on a row imported from a statement in another currency. */
  original_amount?: number | null
  original_currency?: string | null
}

/**
 * Lowercase, punctuation to spaces, and drop digit runs of four or more (card,
 * reference and terminal numbers), so "GRAB *TRIP 8842" and "Grab Trip 1190"
 * compare equal.
 */
export function normaliseDescription(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchKey(date: string, amount: number, type: string, description: string | null): string {
  return `${date}|${Math.round(amount * 100)}|${type}|${normaliseDescription(description)}`
}

function originalKey(date: string, amount: number, currency: string, type: string, description: string | null): string {
  return `${currency}|${matchKey(date, amount, type, description)}`
}

function transferKey(date: string, amount: number, direction: 'income' | 'expense'): string {
  return `${date}|${Math.round(amount * 100)}|${direction}`
}

function originalTransferKey(date: string, amount: number, currency: string, direction: 'income' | 'expense'): string {
  return `${currency}|${transferKey(date, amount, direction)}`
}

/** Money moved between two of the user's accounts: a transfer, or an expense paid to a loan. */
function isMovement(tx: ExistingTx): boolean {
  return tx.type === 'transfer' || (tx.type === 'expense' && tx.to_account_id !== null)
}

function push<T>(buckets: Map<string, T[]>, key: string, value: T) {
  const bucket = buckets.get(key)
  if (bucket) bucket.push(value)
  else buckets.set(key, [value])
}

/**
 * Pairs each importable row with an existing transaction it duplicates. Each
 * existing row is used at most once, so two genuine identical purchases in the
 * file don't both hide behind a single existing one. A transfer out of the
 * account matches money out; a transfer into it matches money in, at the
 * amount that arrived.
 */
export function matchDuplicates<T extends ImportCandidate>(
  rows: T[],
  existing: ExistingTx[],
  importAccountId: string,
): Map<number, ExistingTx> {
  const buckets = new Map<string, ExistingTx[]>()
  const originals = new Map<string, ExistingTx[]>()
  const transfers = new Map<string, ExistingTx[]>()
  const originalTransfers = new Map<string, ExistingTx[]>()
  for (const tx of existing) {
    // A loan repayment is an expense with a target account (LED-147); the loan's statement words it
    // differently from the payer's, so it matches like a transfer: date, amount and direction.
    if (isMovement(tx)) {
      const direction = tx.account_id === importAccountId ? 'expense' : tx.to_account_id === importAccountId ? 'income' : null
      if (direction === 'expense') {
        push(transfers, transferKey(tx.date, Number(tx.amount), 'expense'), tx)
      } else if (direction === 'income') {
        const received = tx.type === 'transfer'
          ? transferCredit({ amount: Number(tx.amount), exchange_rate: Number(tx.exchange_rate ?? 1), destination_amount: tx.destination_amount == null ? null : Number(tx.destination_amount) })
          : Number(tx.amount)
        push(transfers, transferKey(tx.date, received, 'income'), tx)
      }
      // Imported from a statement in another currency: the statement's own amount, whichever leg the
      // account is on (an imported transfer only goes between accounts in the same currency).
      if (direction && tx.original_amount != null && tx.original_currency) {
        push(originalTransfers, originalTransferKey(tx.date, Number(tx.original_amount), tx.original_currency, direction), tx)
      }
      continue
    }
    if (tx.account_id !== importAccountId) continue
    push(buckets, matchKey(tx.date, Number(tx.amount), tx.type, tx.description), tx)
    if (tx.original_amount != null && tx.original_currency) {
      push(originals, originalKey(tx.date, Number(tx.original_amount), tx.original_currency, tx.type, tx.description), tx)
    }
  }

  // Each existing row is used once, whichever way it was found.
  const used = new Set<string>()
  const take = (bucket: ExistingTx[] | undefined) => {
    while (bucket && bucket.length > 0) {
      const next = bucket.shift() as ExistingTx
      if (!used.has(next.id)) {
        used.add(next.id)
        return next
      }
    }
    return undefined
  }

  const matches = new Map<number, ExistingTx>()
  for (const row of rows) {
    if (row.date === null || row.amount === null || row.type === null) continue
    // A description-less row is saved as EMPTY_DESCRIPTION (ImportCSVDialog), so it must be
    // matched on that same text, not the empty string the file actually has (LED-171).
    const description = row.description || EMPTY_DESCRIPTION
    const match =
      (row.original
        ? take(originals.get(originalKey(row.date, row.original.amount, row.original.currency, row.type, description))) ??
          take(originalTransfers.get(originalTransferKey(row.date, row.original.amount, row.original.currency, row.type)))
        : undefined) ??
      take(buckets.get(matchKey(row.date, row.amount, row.type, description))) ??
      take(transfers.get(transferKey(row.date, row.amount, row.type)))
    if (match) matches.set(row.line, match)
  }
  return matches
}

/** The date range the duplicate check has to read, or null with no dated rows. */
export function duplicateSpan(rows: { date: string | null }[]): { start: string; end: string } | null {
  let start: string | null = null
  let end: string | null = null
  for (const { date } of rows) {
    if (!date) continue
    if (start === null || date < start) start = date
    if (end === null || date > end) end = date
  }
  return start && end ? { start, end } : null
}

/**
 * Rows of one file that are identical to each other (LED-234, OD-13 item 2): same date, amount,
 * direction and description. Unlike the saved-row check, the description is compared as written
 * (trimmed, spaces collapsed, any case): two rows that differ only in a reference number are
 * different rows. Each line maps to the other lines it repeats, in file order. Nothing is
 * unticked; the preview only says so, since two identical coffees on one day are real.
 */
export function findIdenticalRows(rows: ImportCandidate[]): Map<number, number[]> {
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    if (row.date === null || row.amount === null || row.type === null) continue
    const description = (row.description || EMPTY_DESCRIPTION).trim().replace(/\s+/g, ' ').toLowerCase()
    push(groups, `${row.date}|${Math.round(row.amount * 100)}|${row.type}|${description}`, row.line)
  }
  const identical = new Map<number, number[]>()
  for (const lines of groups.values()) {
    if (lines.length < 2) continue
    for (const line of lines) identical.set(line, lines.filter((other) => other !== line))
  }
  return identical
}

/** "Identical to row 5 in this file" / "Identical to rows 5 and 9 in this file". */
export function identicalRowsLabel(others: number[]): string {
  if (others.length === 1) return `Identical to row ${others[0]} in this file`
  const list = others.length === 2 ? `${others[0]} and ${others[1]}` : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`
  return `Identical to rows ${list} in this file`
}
