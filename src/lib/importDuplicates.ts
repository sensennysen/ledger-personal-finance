// Import duplicate detection (LED-73): a CSV row that matches a transaction
// already in the account on date + amount + type + normalised description is
// flagged before the write, so a re-imported or overlapping statement doesn't
// silently add every row twice.
//
// Transfers (LED-75) match on date + amount + direction only: the other bank
// words the same movement differently, so once one statement's side is
// imported as a transfer, the other statement's side is flagged too.

export interface ImportCandidate {
  /** 1-based data row number in the file. */
  line: number
  date: string | null
  amount: number | null
  type: 'income' | 'expense' | null
  description: string
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

function transferKey(date: string, amount: number, direction: 'income' | 'expense'): string {
  return `${date}|${Math.round(amount * 100)}|${direction}`
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
  const transfers = new Map<string, ExistingTx[]>()
  for (const tx of existing) {
    if (tx.type === 'transfer') {
      if (tx.account_id === importAccountId) {
        push(transfers, transferKey(tx.date, Number(tx.amount), 'expense'), tx)
      } else if (tx.to_account_id === importAccountId) {
        push(transfers, transferKey(tx.date, Number(tx.amount) * Number(tx.exchange_rate ?? 1), 'income'), tx)
      }
      continue
    }
    if (tx.account_id !== importAccountId) continue
    push(buckets, matchKey(tx.date, Number(tx.amount), tx.type, tx.description), tx)
  }

  const matches = new Map<number, ExistingTx>()
  for (const row of rows) {
    if (row.date === null || row.amount === null || row.type === null) continue
    const match =
      buckets.get(matchKey(row.date, row.amount, row.type, row.description))?.shift() ??
      transfers.get(transferKey(row.date, row.amount, row.type))?.shift()
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
