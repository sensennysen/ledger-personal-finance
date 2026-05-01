import { useState } from 'react'
import { Plus, Trash2, Scissors } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const total = tx.amount
  const splitSum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const diff = parseFloat((total - splitSum).toFixed(2))
  const balanced = Math.abs(diff) < 0.01
  const valid = balanced && lines.length >= 2 && lines.every((l) => l.description.trim() && Number(l.amount) > 0)

  const update = (id: string, field: keyof SplitInput, value: string | number | null) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        category_id: null,
        amount: diff > 0 ? parseFloat(diff.toFixed(2)) : 0,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Split Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original transaction summary */}
          <div className="flex items-center justify-between p-3 bg-muted/60 rounded-lg text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tx.date} · {tx.account?.name}
              </p>
            </div>
            <p className="font-semibold shrink-0 ml-2">{formatCurrency(total, tx.currency)}</p>
          </div>

          {/* Split lines */}
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={line.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                {/* Row 1: description label + input */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Split {idx + 1}
                  </Label>
                  <Input
                    value={line.description}
                    onChange={(e) => update(line.id, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full"
                  />
                </div>

                {/* Row 2: category + amount + delete */}
                <div className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                    <Select
                      value={line.category_id ?? UNCATEGORIZED_VALUE}
                      onValueChange={(v) => update(line.id, 'category_id', v === UNCATEGORIZED_VALUE ? null : v)}
                    >
                      <SelectTrigger className="w-full">
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
                  </div>
                  <div className="w-28 shrink-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.amount || ''}
                      onChange={(e) => update(line.id, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-8 shrink-0 self-end text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 2}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Balance row */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add line
            </Button>
            <span
              className={`text-sm font-medium ${
                balanced ? 'text-[oklch(0.660_0.150_155)]' : 'text-destructive'
              }`}
            >
              {balanced
                ? 'Balanced ✓'
                : diff > 0
                  ? `${formatCurrency(diff, tx.currency)} remaining`
                  : `${formatCurrency(-diff, tx.currency)} over budget`}
            </span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!valid || submitting}>
              {submitting ? 'Splitting…' : `Split into ${lines.length} transactions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
