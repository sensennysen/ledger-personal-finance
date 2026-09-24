import { useState } from 'react'
import { Plus, Trash2, Scissors } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency, formatDate } from '@/lib/utils'
import { resolveSplit, type SplitBlocker } from '@/lib/splitState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormError } from '@/components/ui/form-error'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UNCATEGORIZED_VALUE } from '@/constants/accounts'
import type { Transaction } from '@/types'

export interface SplitInput {
  description: string
  category_id: string | null
  amount: number
}

interface SplitLine extends SplitInput {
  id: string
}

interface Props {
  tx: Transaction
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (splits: SplitInput[]) => Promise<void>
}

export function SplitTransactionDialog({ tx, open, onOpenChange, onConfirm }: Props) {
  const { categories } = useCategories()
  const filteredCats = categories.filter((c) => c.type === tx.type || c.type === 'both')

  const [lines, setLines] = useState<SplitLine[]>(() => [
    { id: crypto.randomUUID(), description: tx.description, category_id: tx.category_id, amount: tx.amount },
    { id: crypto.randomUUID(), description: '', category_id: null, amount: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Line-level highlights wait for the first edit; the summary names every cause from the start.
  const [touched, setTouched] = useState(false)

  const total = tx.amount
  const split = resolveSplit(total, lines)
  const valid = lines.length >= 2 && split.blockers.length === 0
  const blankLines = new Set(split.blockers.find((b) => b.kind === 'blank-description')?.lines ?? [])
  const zeroLines = new Set(split.blockers.find((b) => b.kind === 'zero-amount')?.lines ?? [])
  const carriesExtras = !!tx.receipt_url || (tx.tags?.length ?? 0) > 0

  const update = (id: string, field: keyof SplitInput, value: string | number | null) => {
    setTouched(true)
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        category_id: null,
        amount: split.unassigned,
      },
    ])

  const removeLine = (id: string) => {
    if (lines.length > 2) setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleConfirm = async () => {
    if (!valid) return
    setError(null)
    setSubmitting(true)
    try {
      await onConfirm(
        lines.map((l) => ({
          description: l.description.trim(),
          category_id: l.category_id,
          amount: Number(l.amount),
        }))
      )
      onOpenChange(false)
    } catch {
      setError('Failed to split transaction. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const lineList = (idx: number[]) =>
    idx.length === 1 ? `Line ${idx[0] + 1}` : `Lines ${idx.slice(0, -1).map((i) => i + 1).join(', ')} and ${idx[idx.length - 1] + 1}`
  const blockerText = (b: SplitBlocker) =>
    b.kind === 'unbalanced'
      ? split.unassigned > 0
        ? `${formatCurrency(split.unassigned, tx.currency)} still unassigned`
        : `Lines add up to ${formatCurrency(split.overAllocated, tx.currency)} more than the transaction`
      : b.kind === 'blank-description'
        ? `${lineList(b.lines)} ${b.lines.length === 1 ? 'needs' : 'need'} a description`
        : `${lineList(b.lines)} ${b.lines.length === 1 ? 'needs' : 'need'} an amount above zero`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Split transaction
          </DialogTitle>
          <DialogDescription>
            The original is replaced by these lines. Totals must match.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original transaction summary */}
          <div className="flex items-center justify-between p-3 bg-muted/60 rounded-lg text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(tx.date)} · {tx.account?.name}
              </p>
            </div>
            <p className="font-semibold shrink-0 ml-2">{formatCurrency(total, tx.currency)}</p>
          </div>

          {/* Split lines: one row each; below sm the description takes its own line */}
          <div className="rounded-lg border divide-y">
            <div
              aria-hidden
              className="hidden sm:grid grid-cols-[1.5rem_1fr_11rem_7rem_2rem] gap-2 px-3 py-2 text-xs text-muted-foreground"
            >
              <span>#</span>
              <span>Description</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="grid grid-cols-[1.5rem_1fr_7rem_2rem] sm:grid-cols-[1.5rem_1fr_11rem_7rem_2rem] items-center gap-x-2 gap-y-1.5 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground tabular-nums row-span-2 sm:row-span-1 self-start sm:self-center pt-2 sm:pt-0">
                  {idx + 1}
                </span>
                <Input
                  aria-label={`Line ${idx + 1} description`}
                  aria-invalid={touched && blankLines.has(idx) ? true : undefined}
                  value={line.description}
                  onChange={(e) => update(line.id, 'description', e.target.value)}
                  placeholder="Describe this line…"
                  className="col-span-3 sm:col-span-1 h-9"
                />
                <Select
                  value={line.category_id ?? UNCATEGORIZED_VALUE}
                  onValueChange={(v) => update(line.id, 'category_id', v === UNCATEGORIZED_VALUE ? null : v)}
                >
                  <SelectTrigger aria-label={`Line ${idx + 1} category`} className="w-full h-9 min-w-0">
                    <SelectValue placeholder="Category">
                      {line.category_id
                        ? (() => {
                            const cat = categories.find((c) => c.id === line.category_id)
                            return cat ? `${cat.icon} ${cat.name}` : 'Category'
                          })()
                        : 'Uncategorized'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
                    {filteredCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label={`Line ${idx + 1} amount`}
                  aria-invalid={touched && zeroLines.has(idx) ? true : undefined}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={line.amount || ''}
                  onChange={(e) => update(line.id, 'amount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-9 text-right money"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${idx + 1}`}
                  className="h-9 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length <= 2}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Balance row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add line
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Split total {formatCurrency(total - split.diff, tx.currency)} of {formatCurrency(total, tx.currency)}
              </span>
              {split.balanced ? (
                <span className="font-medium text-income">Balanced</span>
              ) : split.unassigned > 0 ? (
                <Button size="sm" variant="secondary" onClick={addLine}>
                  {formatCurrency(split.unassigned, tx.currency)} unassigned → Add as a line
                </Button>
              ) : (
                <span className="font-medium text-destructive">
                  {formatCurrency(split.overAllocated, tx.currency)} over the transaction total
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The original transaction is deleted and replaced by {lines.length} entries. This can't be undone.
            {carriesExtras && ' Its receipt and tags won’t carry over.'}
          </p>

          {error && <FormError className="mt-0 px-0">{error}</FormError>}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
            {!valid && split.blockers.length > 0 && (
              <ul id="split-blockers" className="mr-auto space-y-0.5 text-xs text-destructive">
                {split.blockers.map((b) => (
                  <li key={b.kind}>{blockerText(b)}</li>
                ))}
              </ul>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!valid || submitting}
              aria-describedby={!valid ? 'split-blockers' : undefined}
            >
              {submitting ? 'Splitting…' : `Split into ${lines.length}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
