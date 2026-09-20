import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorStateProps {
  title: string
  description?: string
  detail?: string | null
  onRetry: () => void
}

const DEFAULT_DESCRIPTION = "Check your connection and try again. Nothing was changed."

export function ErrorState({ title, description = DEFAULT_DESCRIPTION, detail, onRetry }: ErrorStateProps) {
  return (
    <Card className="text-center py-16" role="alert">
      <CardContent>
        <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try again
        </Button>
        {detail && (
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Details</summary>
            <p className="mt-1 break-words">{detail}</p>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

interface InlineLoadErrorProps {
  message: string
  onRetry: () => void
}

/** Non-blocking banner: a refetch failed but data is already on screen. */
export function InlineLoadError({ message, onRetry }: InlineLoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
    >
      <span className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {message}
      </span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
