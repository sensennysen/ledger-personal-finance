import { useLocation } from 'react-router-dom'
import { PAGE_ACTIONS_ID, resolveHeaderMeta } from '@/lib/pageChrome'
import { CycleStepper } from './CycleStepper'

// Row 2 of the shell. Reads only the route and the cycle, never page data,
// so it is interactive from the first frame.
export function PageHeader() {
  const { pathname } = useLocation()
  const { title, showStepper, titleIsHeading } = resolveHeaderMeta(pathname)
  return (
    <>
    {showStepper && (
      <CycleStepper className="md:hidden px-4 pb-3" />
    )}
    <div className="hidden md:flex shrink-0 h-14 items-center justify-between gap-4 border-b border-border bg-background px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        {titleIsHeading ? (
          <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
        ) : (
          <p className="text-xl font-bold tracking-tight truncate">{title}</p>
        )}
        {showStepper && <CycleStepper variant="bar" />}
      </div>
      <div
        id={PAGE_ACTIONS_ID}
        className="flex shrink-0 items-center gap-1.5 empty:hidden"
      />
    </div>
    </>
  )
}
