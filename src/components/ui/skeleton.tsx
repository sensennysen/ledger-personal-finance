import { cn } from "@/lib/utils"

// Skeletons grey out text runs inside real layout (LED-94), so the default
// radius suits a line of text. A skeleton standing in for a block — a chart
// area, an icon tile, a dot — passes its own radius.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// A grey run sitting inside a line of real text. The parent keeps its font size, so the
// line keeps its real height and nothing moves when the text arrives (LED-150).
function SkeletonText({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("inline-block h-[0.75em] align-middle", className)} {...props} />
}

export { Skeleton, SkeletonText }
