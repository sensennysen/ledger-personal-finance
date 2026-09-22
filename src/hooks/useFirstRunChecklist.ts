import { useState, useCallback, useEffect } from 'react'

interface FirstRunState {
  dismissed: boolean
  cycleConfirmed: boolean
}

const STORAGE_KEY = 'ledger-first-run'

const DEFAULTS: FirstRunState = {
  dismissed: false,
  cycleConfirmed: false,
}

function load(): FirstRunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function save(state: FirstRunState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage access failures and keep the in-memory state.
  }
}

let _state: FirstRunState = load()
const _listeners: Set<() => void> = new Set()

function notify() {
  _listeners.forEach((fn) => fn())
}

export function useFirstRunChecklist() {
  const [, forceRender] = useState(0)

  const subscribe = useCallback((fn: () => void) => {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  }, [])

  useEffect(() => {
    const unsub = subscribe(() => forceRender((n) => n + 1))
    return () => {
      unsub()
    }
  }, [subscribe])

  const dismiss = useCallback(() => {
    _state = { ..._state, dismissed: true }
    save(_state)
    notify()
  }, [])

  const confirmCycle = useCallback(() => {
    _state = { ..._state, cycleConfirmed: true }
    save(_state)
    notify()
  }, [])

  return {
    dismissed: _state.dismissed,
    cycleConfirmed: _state.cycleConfirmed,
    dismiss,
    confirmCycle,
  }
}
