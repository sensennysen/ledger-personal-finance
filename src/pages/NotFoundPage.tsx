import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button-variants'

// An unknown signed-in route (a stale bookmark, a mistyped URL) gets a page with
// a way back instead of a blank screen (QA-003).
export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="This page doesn't exist or has moved."
      action={
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Go to Home
        </Link>
      }
    />
  )
}
