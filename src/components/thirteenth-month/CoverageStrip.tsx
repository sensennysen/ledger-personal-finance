import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MonthCoverage, MonthStatus } from '@/lib/thirteenthMonth'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Height and outline say the status as well as colour: a covered bar is tall and solid,
// a partial one is shorter, a missing month is a stub, and a future month is a dashed outline.
const BAR: Record<MonthStatus, string> = {
  covered: 'h-12 bg-income',
  partial: 'h-7 bg-gold',
  missing: 'h-1.5 bg-muted-foreground',
  future: 'h-12 border border-dashed border-muted-foreground',
}

const LEGEND: { status: MonthStatus; label: string }[] = [
  { status: 'covered', label: 'Covered' },
  { status: 'partial', label: 'Some records left out' },
  { status: 'missing', label: 'Nothing counted' },
  { status: 'future', label: 'Still to come' },
]

function describe(month: MonthCoverage): string {
  switch (month.status) {
    case 'covered':
      return `all ${month.totalCount} ${month.totalCount === 1 ? 'record' : 'records'} counted`
    case 'partial':
      return `${month.includedCount} of ${month.totalCount} records counted`
    case 'missing':
      return month.totalCount === 0 ? 'no income recorded' : 'nothing counted'
    case 'future':
      return 'not yet'
  }
}

// Which months feed the estimate (design 15a "Included by month"): the three states that
// explain an estimate that looks low. Every bar has a text alternative and the legend
// names the four states, so colour is never the only signal.
export function CoverageStrip({ coverage, loading }: { coverage: MonthCoverage[]; loading: boolean }) {
  const legend = (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {LEGEND.map(({ status, label }) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('inline-block w-3 rounded-sm', BAR[status].replace(/h-\S+/, 'h-3'))} />
          {label}
        </li>
      ))}
    </ul>
  )
  return (
    <section aria-labelledby="coverage-heading" className="rounded-xl border border-border bg-card p-4">
      <h2 id="coverage-heading" className="text-sm font-semibold">Included by month</h2>
      {loading ? (
        <>
          <ol className="mt-3 flex h-16 items-end gap-1.5" aria-busy="true">
            {MONTH_NAMES.map((name) => (
              <li key={name} className="flex flex-1 flex-col items-center justify-end gap-1">
                <Skeleton className="h-8 w-full rounded-sm" />
                <span aria-hidden className="text-[0.6875rem] text-muted-foreground">{name[0]}</span>
              </li>
            ))}
          </ol>
          {legend}
        </>
      ) : (
        <>
          <ol className="mt-3 flex h-16 items-end gap-1.5">
            {coverage.map((month) => (
              <li key={month.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span aria-hidden className={cn('w-full rounded-sm', BAR[month.status])} />
                <span aria-hidden className="text-[0.6875rem] text-muted-foreground">
                  {MONTH_NAMES[month.month - 1][0]}
                </span>
                <span className="sr-only">
                  {MONTH_NAMES[month.month - 1]}: {describe(month)}
                </span>
              </li>
            ))}
          </ol>
          {legend}
        </>
      )}
    </section>
  )
}
