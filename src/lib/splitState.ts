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

export function resolveSplit(total: number, lines: SplitLineInput[]): SplitState {
  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const diff = Math.round((total - sum) * 100) / 100
  const balanced = Math.abs(diff) < 0.01
  const blank = lines.flatMap((l, i) => (l.description.trim() ? [] : [i]))
  const zero = lines.flatMap((l, i) => (Number(l.amount) > 0 ? [] : [i]))
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
