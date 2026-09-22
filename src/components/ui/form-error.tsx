import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormErrorProps {
  children?: ReactNode
  className?: string
}

export function FormError({ children, className }: FormErrorProps) {
  if (!children) return null

  return (
    <p role="alert" className={cn('text-sm text-destructive px-1 -mt-2', className)}>
      {children}
    </p>
  )
}
