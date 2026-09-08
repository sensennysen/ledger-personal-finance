import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from 'react'
type CycleState = {
  startDay: number
  selectedMonth: string
  setSelectedMonth: Dispatch<SetStateAction<string>>
}
export const CycleContext = createContext<CycleState | null>(null)
export function useCycle() {
  const context = useContext(CycleContext)
  if (!context) throw new Error('useCycle requires CycleProvider')
  return context
}
