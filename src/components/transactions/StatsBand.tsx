import type { ReactNode } from 'react'

export interface StatsBandItem {
  label: string
  value: ReactNode
  /** Small line under the value. */
  note?: ReactNode
}

/** The three-figure band above a liability payment's amount (card, LED-24; loan, LED-106). */
export function StatsBand({ items }: { items: StatsBandItem[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-semibold">{item.value}</dd>
          {item.note && <dd className="text-xs text-muted-foreground">{item.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
