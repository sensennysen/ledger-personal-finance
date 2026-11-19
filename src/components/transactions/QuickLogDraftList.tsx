import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useNotify } from '@/contexts/notificationState'
import { discardQuickLogDraft, type QuickLogDraft } from '@/hooks/useQuickLogDrafts'
import { formatCurrency } from '@/lib/utils'

export function QuickLogDraftList({ drafts, canDiscard, onEdit }: {
  drafts: QuickLogDraft[]
  canDiscard: boolean
  onEdit: (draft: QuickLogDraft) => void
}) {
  return (
    <section aria-labelledby="quick-log-drafts-title" className="overflow-hidden rounded-lg border bg-card">
      <div className="space-y-1 border-b px-4 py-3">
        <h2 id="quick-log-drafts-title" className="text-sm font-semibold">Quick Log drafts</h2>
        <p className="text-xs text-muted-foreground">These entries affect your balances once you finish them.</p>
      </div>
      <ul className="divide-y">
        {drafts.map((draft) => (
          <QuickLogDraftRow key={draft.id} draft={draft} canDiscard={canDiscard} onEdit={() => onEdit(draft)} />
        ))}
      </ul>
    </section>
  )
}

function QuickLogDraftRow({ draft, canDiscard, onEdit }: {
  draft: QuickLogDraft
  canDiscard: boolean
  onEdit: () => void
}) {
  const notify = useNotify()
  const [open, setOpen] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const discard = async () => {
    setDiscarding(true)
    setError(null)
    try {
      const error = await discardQuickLogDraft(draft.id)
      if (error) setError(error)
      else {
        setOpen(false)
        notify({ severity: 'success', title: 'Quick Log draft discarded' })
      }
    } catch {
      setError('Could not discard the draft. Try again.')
    } finally {
      setDiscarding(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-sm font-medium">{draft.phrase}</p>
        <p className="mt-1 text-xs text-muted-foreground">{draft.reason}</p>
      </div>
      {draft.amount !== null && (
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {draft.currency && /^[A-Z]{3}$/.test(draft.currency)
            ? formatCurrency(draft.amount, draft.currency) : new Intl.NumberFormat().format(draft.amount)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden /> Finish entry<span className="sr-only"> for {draft.phrase}</span>
        </Button>
        <AlertDialog open={open} onOpenChange={(next) => {
          if (discarding) return
          setError(null)
          setOpen(next)
        }}>
          <AlertDialogTrigger render={<Button variant="ghost" size="icon" disabled={!canDiscard} />}
            aria-label={'Discard draft for ' + draft.phrase}>
            <Trash2 aria-hidden />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard Quick Log draft?</AlertDialogTitle>
              <AlertDialogDescription className="break-words">{draft.phrase}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={discarding}>Keep draft</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={discarding} onClick={() => void discard()}>
                {discarding ? 'Discarding…' : 'Discard draft'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}
