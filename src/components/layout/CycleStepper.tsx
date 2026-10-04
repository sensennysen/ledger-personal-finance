import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCycle } from '@/contexts/cycleState'
import { getCurrentCycleMonthKey, getCustomMonthRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function CycleStepper({
  className = '',
  variant = 'full',
  onOpenMonths,
}: {
  className?: string
  variant?: 'full' | 'bar' | 'line'
  /** line: tapping the dates opens the month sheet (M-04). */
  onOpenMonths?: () => void
}) {
  const { selectedMonth, setSelectedMonth, startDay } = useCycle()
  const current = selectedMonth >= getCurrentCycleMonthKey(startDay)
  const [year, month] = selectedMonth.split('-').map(Number)
  const range = getCustomMonthRange(selectedMonth, startDay)
  const label = (value: string) =>
    new Date(value + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  const move = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    )
  }
  if (variant === 'line') {
    // Phones: a 40px line under the header, left-aligned with no fill.
    return (
      <div
        role="group"
        aria-label="Cycle"
        className={`flex h-10 items-center px-1 ${className}`}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous cycle"
          onClick={() => move(-1)}
          className="text-muted-foreground [&_svg]:size-[18px]"
        >
          <ChevronLeft />
        </Button>
        <button
          type="button"
          onClick={onOpenMonths}
          aria-haspopup="dialog"
          className="flex h-10 items-center gap-1.5 rounded-full px-1 text-[0.8125rem] font-semibold text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {label(range.start)} – {label(range.end)}
          <span className="font-medium text-muted-foreground">
            · {current ? 'Open' : 'Closed'}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next cycle"
          disabled={current}
          onClick={() => move(1)}
          className="text-muted-foreground [&_svg]:size-[18px]"
        >
          <ChevronRight />
        </Button>
      </div>
    )
  }
  if (variant === 'bar') {
    return (
      <div
        className={`flex items-center gap-1 ${className}`}
        role="group"
        aria-label="Cycle"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous cycle"
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-[0.8125rem] font-semibold">
          {label(range.start)} – {label(range.end)} ·{' '}
          {current ? 'Open' : 'Closed'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next cycle"
          disabled={current}
          onClick={() => move(1)}
        >
          <ChevronRight />
        </Button>
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous cycle"
        onClick={() => move(-1)}
      >
        <ChevronLeft />
      </Button>
      <span className="flex-1 rounded-full bg-accent text-accent-foreground px-3 py-2 text-center text-xs font-medium">
        {label(range.start)} – {label(range.end)} ·{' '}
        {current ? 'Open' : 'Closed'}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next cycle"
        disabled={current}
        onClick={() => move(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
