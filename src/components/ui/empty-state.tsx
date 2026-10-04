import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  bare?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, bare }: EmptyStateProps) {
  const content = (
    <>
      <Icon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex items-center justify-center gap-2">{action}</div>}
    </>
  )

  if (bare) {
    return <div className="text-center py-8">{content}</div>
  }

  return (
    <Card className="text-center py-16">
      <CardContent>{content}</CardContent>
    </Card>
  )
}
