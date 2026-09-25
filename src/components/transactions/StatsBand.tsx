import type { ReactNode } from 'react'

export interface StatsBandItem {
  label: string
  /** Wording for widths below `lg`, where the designs abbreviate ("Available" for "Available credit"). */
  shortLabel?: string
  value: ReactNode
  /** Small line under the value. */
  note?: ReactNode
}

/** The band of figures above a liability payment's amount (card, LED-24; loan, LED-106). Two or three cells. */
export function StatsBand({ items }: { items: StatsBandItem[] }) {
  return (
    <dl
      className={`grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm ${items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-muted-foreground">
            {item.shortLabel ? (
              <>
                <span className="lg:hidden">{item.shortLabel}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </>
            ) : (
              item.label
            )}
          </dt>
          <dd className="font-semibold">{item.value}</dd>
          {item.note && <dd className="text-xs text-muted-foreground">{item.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
