import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCycle } from '@/contexts/cycleState'
import { getCurrentCycleMonthKey, getCustomMonthRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function CycleStepper({ className = '' }: { className?: string }) {
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
