import { useEffect } from 'react'
import { visualViewportVars, type ViewportVars } from '@/lib/visualViewport'

const KEYS: (keyof ViewportVars)[] = ['--vv-height', '--vv-center', '--vv-bottom']

/** Mirrors the visual viewport into --vv-* on <html> while the on-screen keyboard is open (LED-252). */
export function useVisualViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      const vars = visualViewportVars({
        height: vv.height,
        offsetTop: vv.offsetTop,
        scale: vv.scale,
        layoutHeight: root.clientHeight,
      })
      for (const key of KEYS) {
        if (vars) root.style.setProperty(key, vars[key])
        else root.style.removeProperty(key)
      }
    }
    // Once a dialog shrinks to the visible area, the focused field can sit under its sticky
    // footer. Centre it in the dialog. scrollTop is set directly because iOS ignores
    // scrollIntoView inside the fixed dialog. Run once the new size has laid out and again
    // after the keyboard animation settles; centring an already-centred field is a no-op.
    let settle: number | undefined
    const centre = () => {
      const field = document.activeElement
      if (!root.style.getPropertyValue('--vv-height')) return
      if (!(field instanceof HTMLElement) || !field.matches('input, textarea, select')) return
      const scroller = field.closest<HTMLElement>('[data-slot="dialog-content"]')
      if (!scroller) return
      const box = scroller.getBoundingClientRect()
      const target = field.getBoundingClientRect()
      scroller.scrollTop += target.top + target.height / 2 - (box.top + box.height / 2)
    }
    const centreFocusedField = () => {
      requestAnimationFrame(() => requestAnimationFrame(centre))
      window.clearTimeout(settle)
      settle = window.setTimeout(centre, 350)
    }
    const onResize = () => {
      update()
      centreFocusedField()
    }
    update()
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', update)
    // Moving between fields with the keyboard already open fires no resize.
    document.addEventListener('focusin', centreFocusedField)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', update)
      document.removeEventListener('focusin', centreFocusedField)
      window.clearTimeout(settle)
      for (const key of KEYS) root.style.removeProperty(key)
    }
  }, [])
}
