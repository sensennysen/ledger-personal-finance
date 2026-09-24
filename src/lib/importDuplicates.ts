// Import duplicate detection (LED-73): a CSV row that matches a transaction
// already in the account on date + amount + type + normalised description is
// flagged before the write, so a re-imported or overlapping statement doesn't
// silently add every row twice.

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

/**
 * Pairs each importable row with an existing transaction it duplicates. Each
 * existing row is used at most once, so two genuine identical purchases in the
 * file don't both hide behind a single existing one.
 */
export function matchDuplicates<T extends ImportCandidate>(
  rows: T[],
  existing: ExistingTx[],
): Map<number, ExistingTx> {
  const buckets = new Map<string, ExistingTx[]>()
  for (const tx of existing) {
    if (tx.type === 'transfer') continue
    const key = matchKey(tx.date, Number(tx.amount), tx.type, tx.description)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(tx)
    else buckets.set(key, [tx])
  }

  const matches = new Map<number, ExistingTx>()
  for (const row of rows) {
    if (row.date === null || row.amount === null || row.type === null) continue
    const bucket = buckets.get(matchKey(row.date, row.amount, row.type, row.description))
    const match = bucket?.shift()
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
