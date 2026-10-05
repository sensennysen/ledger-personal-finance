import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { keepTheirs, listQueue } from '@/lib/offlineQueue'
import { canKeepMine, describeConflict } from '@/lib/queueState'
import { itemTitle, itemNote } from '@/lib/queueItemTitle'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const fieldLabel = (field: string) => field.replace(/_/g, ' ')
const showValue = (value: unknown) =>
  value === null || value === undefined || value === '' ? 'empty' : typeof value === 'string' ? value : JSON.stringify(value)

function age(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000)
  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''} ago`
  const hours = Math.floor((Date.now() - timestamp) / 3_600_000)
  return hours >= 1 ? `${hours} hour${hours !== 1 ? 's' : ''} ago` : 'just now'
}

export function QueueReviewSheet({
  open,
  onOpenChange,
  status,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: ReturnType<typeof useNetworkStatus>
  /** Where focus goes on close; the opener (the banner's Review) may be gone by then. */
  finalFocus?: () => HTMLElement | boolean
}) {
  const { isSyncing, pendingCount, flaggedCount, syncNow, resolve, retry, refreshCount } = status
  const items = open ? listQueue() : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:w-full" finalFocus={finalFocus}>
        <SheetHeader>
          <SheetTitle>Waiting to sync</SheetTitle>
          <SheetDescription>
            Held on this device only — clearing site data loses them.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex-1 overflow-y-auto px-4">
          {items.length === 0 && (
            <li className="py-6 text-sm text-muted-foreground">Nothing is waiting.</li>
          )}
          {items.map((item) => {
            const Icon = item.status ? AlertTriangle : item.operation === 'insert' ? Plus : Pencil
            // Each item's buttons carry its title, so a list of them is not a run of identical "Discard" (LED-179).
            const title = itemTitle(item)
            return (
              <li key={item.id} className="flex items-center gap-3 border-t py-3 max-sm:flex-wrap max-sm:gap-y-2">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={
                    item.status
                      ? { background: 'var(--expense-container)', color: 'var(--expense)' }
                      : undefined
                  }
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-2.75rem)]">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {itemNote(item)} · {age(item.timestamp)}
                  </span>
                  {describeConflict(item).map((change) => (
                    <span key={change.field} className="block text-xs">
                      <span className="capitalize">{fieldLabel(change.field)}</span>:{' '}
                      <span className="text-muted-foreground">yours</span> {showValue(change.mine)}
                      {' · '}
                      <span className="text-muted-foreground">theirs</span> {showValue(change.theirs)}
                    </span>
                  ))}
                </span>
                {item.status === 'failed' && (
                  <span className="flex shrink-0 gap-2 max-sm:ml-11">
                    <Button size="sm" variant="outline" disabled={isSyncing} aria-label={`Discard ${title}`} onClick={() => resolve(item.id, 'theirs')}>
                      Discard
                    </Button>
                    <Button size="sm" disabled={isSyncing} aria-label={`Retry ${title}`} onClick={() => retry(item.id)}>
                      Retry
                    </Button>
                  </span>
                )}
                {item.status && item.status !== 'failed' && (
                  <span className="flex shrink-0 gap-2 max-sm:ml-11">
                    <Button size="sm" variant="outline" disabled={isSyncing} aria-label={`${canKeepMine(item) ? 'Keep theirs' : 'Discard'} ${title}`} onClick={() => resolve(item.id, 'theirs')}>
                      {canKeepMine(item) ? 'Keep theirs' : 'Discard'}
                    </Button>
                    {canKeepMine(item) && (
                      <Button size="sm" disabled={isSyncing} aria-label={`Keep mine ${title}`} onClick={() => resolve(item.id, 'mine')}>
                        Keep mine
                      </Button>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <SheetFooter>
          <p className="text-xs text-muted-foreground">
            Queued items that wait more than 30 days need your review before they sync.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-w-fit flex-1"
              disabled={isSyncing || flaggedCount === 0}
              onClick={async () => {
                await keepTheirs()
                refreshCount()
              }}
            >
              <Trash2 className="size-4" /> Discard flagged
            </Button>
            <Button className="min-w-fit flex-1" disabled={isSyncing || pendingCount === 0} onClick={() => syncNow()}>
              <RefreshCw className="size-4" /> Sync now
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
