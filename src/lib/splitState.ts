export interface SplitLineInput {
  description: string
  amount: number
}

export type SplitBlocker =
  | { kind: 'unbalanced' }
  | { kind: 'blank-description'; lines: number[] }
  | { kind: 'zero-amount'; lines: number[] }

export interface SplitState {
  /** total − sum of lines, to the cent. Positive: unassigned; negative: over-allocated. */
  diff: number
  unassigned: number
  overAllocated: number
  balanced: boolean
  /** Every reason Split is disabled, each named on its own (line indexes are 0-based). */
  blockers: SplitBlocker[]
}

const toCents = (amount: unknown) => Math.round((Number(amount) || 0) * 100)

export function resolveSplit(total: number, lines: SplitLineInput[]): SplitState {
  // Each line counts as the cents it is sent as (buildSplitRpcLines), so the dialog balances exactly
  // when the server will: three lines of 33.333 are 99.99, not 100 (LED-330).
  const sum = lines.reduce((s, l) => s + toCents(l.amount), 0)
  const diff = (toCents(total) - sum) / 100
  const balanced = diff === 0
  const blank = lines.flatMap((l, i) => (l.description.trim() ? [] : [i]))
  const zero = lines.flatMap((l, i) => (toCents(l.amount) > 0 ? [] : [i]))
  const blockers: SplitBlocker[] = []
  if (!balanced) blockers.push({ kind: 'unbalanced' })
  if (blank.length) blockers.push({ kind: 'blank-description', lines: blank })
  if (zero.length) blockers.push({ kind: 'zero-amount', lines: zero })
  return {
    diff,
    unassigned: diff > 0 && !balanced ? diff : 0,
    overAllocated: diff < 0 && !balanced ? -diff : 0,
    balanced,
    blockers,
  }
}

export const SPLIT_OFFLINE_MESSAGE = 'Connect to the internet to split a transaction.'

// A type, not an interface, so it is assignable to the function's Json argument (LED-320).
export type SplitRpcLine = {
  description: string
  category_id: string | null
  amount: number
}

/** The `lines` argument of the split_transaction function: trimmed, cents-rounded, in order. */
export function buildSplitRpcLines(lines: SplitRpcLine[]): SplitRpcLine[] {
  return lines.map((line) => ({
    description: line.description.trim(),
    category_id: line.category_id,
    amount: toCents(line.amount) / 100,
  }))
}
