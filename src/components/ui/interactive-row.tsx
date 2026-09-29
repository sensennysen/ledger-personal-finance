import * as React from "react"

import { cn } from "@/lib/utils"

interface InteractiveRowProps extends Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "type"> {
  as?: React.ElementType
  onActivate: () => void
}

// LED-157: every row/card built on this primitive must show a focus ring —
// baked in here so a caller can't ship one that forgets it.
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"

/**
 * One row component for every clickable row/card. Defaults to a real
 * `<button>` (native Enter/Space handling, no role/tabIndex needed). Pass
 * `as` when the row contains its own nested interactive controls (e.g. an
 * Edit/Delete button) — a literal `<button>` can't wrap other interactive
 * elements — to get `role="button"` + `tabIndex` + the same Enter/Space
 * handling on that element instead.
 */
export function InteractiveRow({ as: Component = "button", onActivate, className, ...props }: InteractiveRowProps) {
  if (Component === "button") {
    return <button type="button" onClick={onActivate} className={cn(FOCUS_RING, className)} {...props} />
  }

  return (
    <Component
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onActivate()
        }
      }}
      className={cn(FOCUS_RING, className)}
      {...props}
    />
  )
}
