import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormError } from '@/components/ui/form-error'
import { formatCurrency } from '@/lib/utils'
import type { FormErrorValue, MutationResult } from '@/lib/dataErrors'

export interface SuggestionRow {
  category_id: string
  name: string
  icon: string
  amount: number
}

// Confirms what "Add from last cycle" will create, and keeps a failure on screen instead of closing.
export function AddFromLastCycleDialog({
  open,
  onOpenChange,
  rows,
  currency,
  cycleLabel,
  unrated,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: SuggestionRow[]
  currency: string
  cycleLabel: string
  /** Currencies with no exchange rate that were left out of the spend. */
  unrated: string[]
  onConfirm: () => Promise<MutationResult>
}) {
  const [error, setError] = useState<FormErrorValue>(null)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    setError(null)
    const result = await onConfirm()
    setSaving(false)
    if (result.error) {
      setError({ message: result.error, detail: result.errorDetail ?? null })
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add budgets from last cycle</DialogTitle>
          <DialogDescription>
            You spent in these categories in {cycleLabel} and have no budget for them. Each is added as a monthly
            budget at that cycle's spend, rounded up.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
          {rows.map((row) => (
            <li key={row.category_id} className="flex items-center gap-2 px-3 py-2">
              <span aria-hidden>{row.icon}</span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="tabular-nums">{formatCurrency(row.amount, currency)}</span>
            </li>
          ))}
        </ul>
        {unrated.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Spend in {unrated.join(', ')} has no exchange rate and is left out of these amounts.
          </p>
        )}
        <FormError error={error} className="px-0 mt-0" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void confirm()} disabled={saving || rows.length === 0}>
            {saving ? 'Adding…' : `Add ${rows.length} ${rows.length === 1 ? 'budget' : 'budgets'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
