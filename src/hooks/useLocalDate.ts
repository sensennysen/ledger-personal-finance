import { useEffect, useState } from 'react'
import { getLocalDateString } from '@/lib/utils'
import { msUntilNextLocalMidnight } from '@/lib/countsYet'

/**
 * Today's local date ("YYYY-MM-DD"), updated at local midnight and when the tab becomes visible
 * again (timers sleep in a background tab). A tab left open overnight moves to the new day.
 */
export function useLocalDate(): string {
  const [today, setToday] = useState(getLocalDateString)
  useEffect(() => {
    let timer: number | undefined
    const check = () => setToday(getLocalDateString())
    const schedule = () => {
      window.clearTimeout(timer)
      // A second past midnight, so the new date is certain.
      timer = window.setTimeout(() => {
        check()
        schedule()
      }, msUntilNextLocalMidnight(new Date()) + 1000)
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      check()
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return today
}
