import { cn } from "@/lib/utils"

// Skeletons grey out text runs inside real layout (LED-94), so the default
// radius suits a line of text. A skeleton standing in for a block — a chart
// area, an icon tile, a dot — passes its own radius.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
