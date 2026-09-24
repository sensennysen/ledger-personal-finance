import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { FormErrorValue } from '@/lib/dataErrors'
import { TechnicalDetail } from '@/components/ui/technical-detail'

interface FormErrorProps {
  /** A sentence, or a described failure whose raw text stays collapsed. */
  error?: FormErrorValue
  children?: ReactNode
  className?: string
}

export function FormError({ error, children, className }: FormErrorProps) {
  const message = typeof error === 'string' ? error : error?.message
  const detail = error && typeof error === 'object' ? error.detail : null
  if (!children && !message) return null

  return (
    <div role="alert" className={cn('text-sm text-destructive px-1 -mt-2', className)}>
      <p>{children ?? message}</p>
      {detail && <TechnicalDetail detail={detail} className="mt-1" />}
    </div>
  )
}
