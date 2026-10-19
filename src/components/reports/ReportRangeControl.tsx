import { CalendarDays } from 'lucide-react'
import { Input } from '@/components/ui/input'

type Range = { start: string; end: string }

/**
 * Reports' period: the cycle the header stepper selects, or a range the user picks. The range
 * covers everything the cycle would (stats, breakdowns, the table and both exports).
 */
export function ReportRangeControl({
  custom,
  cycleRange,
  label,
  onChange,
}: {
  /** The picked range, or null while Reports follows the cycle. */
  custom: Range | null
  /** The selected cycle, which a new custom range starts from. */
  cycleRange: Range
  /** What the report covers, as the stats and exports name it. */
  label: string
  onChange: (range: Range | null) => void
}) {
  // A cleared field is ignored; a start after the end (or an end before the start) moves the other with it.
  const setStart = (value: string) => {
    if (!custom || !value) return
    onChange({ start: value, end: value > custom.end ? value : custom.end })
  }
  const setEnd = (value: string) => {
    if (!custom || !value) return
    onChange({ start: value < custom.start ? value : custom.start, end: value })
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
      <select
        aria-label="Report period"
        value={custom ? 'custom' : 'cycle'}
        onChange={(e) => onChange(e.target.value === 'custom' ? cycleRange : null)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="cycle">Selected cycle</option>
        <option value="custom">Custom range</option>
      </select>
      {custom ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Report start date"
            value={custom.start}
            max={custom.end}
            onChange={(e) => setStart(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground" aria-hidden>–</span>
          <Input
            type="date"
            aria-label="Report end date"
            value={custom.end}
            min={custom.start}
            onChange={(e) => setEnd(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground tabular-nums">{label}</span>
      )}
    </div>
  )
}
