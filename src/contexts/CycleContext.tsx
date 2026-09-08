import { useState, type Dispatch, type SetStateAction } from 'react'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { getCurrentCycleMonthKey } from '@/lib/utils'

import { CycleContext } from './cycleState'
export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { startDay } = useMonthCycle()
  const [selection, setSelectedMonth] = useState<string | null>(null)
  const selectedMonth = selection ?? getCurrentCycleMonthKey(startDay)
  const setMonth: Dispatch<SetStateAction<string>> = (value) =>
    setSelectedMonth((previous) =>
      typeof value === 'function'
        ? value(previous ?? getCurrentCycleMonthKey(startDay))
        : value,
    )
  return (
    <CycleContext.Provider
      value={{ startDay, selectedMonth, setSelectedMonth: setMonth }}
    >
      {children}
    </CycleContext.Provider>
  )
}
