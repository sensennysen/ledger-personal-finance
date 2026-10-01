import { Check, X } from 'lucide-react'
import type { Pd851Row } from '@/lib/thirteenthMonth'

// The PD 851 rules as a scannable list (design 15a), driven by the ticked records: a cross
// row with ticked records that look like it says so, in words.
export function Pd851Checklist({ rows }: { rows: Pd851Row[] }) {
  return (
    <section aria-labelledby="pd851-heading" className="rounded-xl border border-border bg-card p-4">
      <h2 id="pd851-heading" className="text-sm font-semibold">What counts under PD 851</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2">
            {row.counts ? (
              <Check className="mt-0.5 size-4 shrink-0 text-income" aria-hidden />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="sr-only">{row.counts ? 'Counts: ' : 'Does not count: '}</span>
              {row.label}
              {row.selected > 0 && (
                <span className="mt-0.5 block text-xs font-medium text-warning">
                  {row.counts
                    ? `${row.selected} selected ${row.selected === 1 ? 'record' : 'records'}`
                    : `${row.selected} selected ${row.selected === 1 ? 'record looks' : 'records look'} like this. Untick ${row.selected === 1 ? 'it' : 'them'} to follow PD 851.`}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        An estimate from your own records, not payroll advice. Your selection is saved on this device only and never
        affects your account balances.
      </p>
    </section>
  )
}
