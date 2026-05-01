import { useEffect } from 'react'

/**
 * Fires `handler` when the given key is pressed, ignoring events
 * that originate from inputs / textareas / contenteditable elements.
 */
export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal keystrokes while typing
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        handler(e)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, handler, enabled])
}
