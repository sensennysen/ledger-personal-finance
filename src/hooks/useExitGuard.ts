import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isStandalone } from '@/hooks/useInstallPrompt'

/** React Router keeps the entry's position in `history.state.idx`; 0 is the app's first entry. */
const historyIndex = () => (window.history.state as { idx?: number } | null)?.idx ?? 0

/**
 * Back on Home in the installed app asks before leaving (instead of closing at once). Home, as the
 * app's first history entry, gets a guard entry pushed on top; back pops it, and landing on the
 * first entry again opens the confirm. Stay re-pushes the guard; a second back press leaves, since
 * nothing sits below the first entry.
 */
export function useExitGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const armed = useRef(false)
  const enabled = isStandalone()

  const arm = useCallback(() => {
    armed.current = true
    navigate('/', { state: { exitGuard: true } })
  }, [navigate])

  useEffect(() => {
    // Read inside the effect: after arming, history is already on the guard (StrictMode re-runs).
    if (!enabled || location.pathname !== '/' || historyIndex() !== 0) return
    if (armed.current) setOpen(true)
    else arm()
  }, [enabled, location.pathname, location.key, arm])

  const stay = () => {
    setOpen(false)
    arm()
  }

  return { open, stay }
}
