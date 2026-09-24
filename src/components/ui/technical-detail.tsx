import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Raw error text, collapsed, for a support conversation — never the headline. */
export function TechnicalDetail({ detail, className }: { detail: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <details className={cn('text-xs text-muted-foreground', className)}>
      <summary className="cursor-pointer">Technical detail</summary>
      <div className="mt-1 flex items-start gap-2">
        <code className="flex-1 break-words font-mono">{detail}</code>
        <button
          type="button"
          className="underline shrink-0"
          onClick={() => {
            navigator.clipboard?.writeText(detail).then(() => setCopied(true), () => undefined)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </details>
  )
}
