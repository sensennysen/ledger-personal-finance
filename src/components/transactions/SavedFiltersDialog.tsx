import { useState } from 'react'
import { Bookmark, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import { Input } from '@/components/ui/input'
import { TechnicalDetail } from '@/components/ui/technical-detail'
import { Label } from '@/components/ui/label'
import { withDetail, type FormErrorValue, type MutationResult } from '@/lib/dataErrors'
import { resolveLoadState } from '@/lib/loadState'
import {
  describeFilter,
  isFilterActive,
  validateFilterName,
  SAVED_FILTER_NAME_MAX,
  type ActivityFilter,
  type SavedFilter,
} from '@/lib/savedFilters'

interface SavedFiltersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The filter Activity is showing now; it can be saved when it narrows anything. */
  current: ActivityFilter
  filters: SavedFilter[]
  loading: boolean
  error: string | null
  errorDetail: string | null
  /** Saved rows this version could not read. */
  skipped: number
  onRetry: () => void
  onSave: (name: string) => Promise<MutationResult>
  onRename: (id: string, name: string) => Promise<MutationResult>
  onDelete: (id: string) => Promise<MutationResult>
  onApply: (filter: ActivityFilter) => void
}

/** Save the filter on screen, and apply, rename or delete the ones already saved (LED-138). */
export function SavedFiltersDialog({
  open,
  onOpenChange,
  current,
  filters,
  loading,
  error,
  errorDetail,
  skipped,
  onRetry,
  onSave,
  onRename,
  onDelete,
  onApply,
}: SavedFiltersDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<FormErrorValue>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [rowError, setRowError] = useState<FormErrorValue>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadState = resolveLoadState({ loading, error, hasData: filters.length > 0 })
  const canSaveCurrent = isFilterActive(current)

  const reset = () => {
    setName('')
    setFormError(null)
    setEditingId(null)
    setRowError(null)
  }

  const handleSave = async () => {
    const problem = validateFilterName(name, filters)
    if (problem) {
      setFormError(problem)
      return
    }
    setSaving(true)
    const result = await onSave(name)
    setSaving(false)
    if (result.error) {
      setFormError(withDetail(result))
      return
    }
    setName('')
    setFormError(null)
  }

  const handleRename = async (saved: SavedFilter) => {
    const problem = validateFilterName(editName, filters, saved.id)
    if (problem) {
      setRowError(problem)
      return
    }
    setBusyId(saved.id)
    const result = await onRename(saved.id, editName)
    setBusyId(null)
    if (result.error) {
      setRowError(withDetail(result))
      return
    }
    setEditingId(null)
    setRowError(null)
  }

  const handleDelete = async (saved: SavedFilter) => {
    setBusyId(saved.id)
    const result = await onDelete(saved.id)
    setBusyId(null)
    setRowError(result.error ? withDetail(result) : null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-0.75rem)] max-w-md overflow-y-auto sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Saved filters
          </DialogTitle>
          <DialogDescription>
            A saved filter keeps the type, search text and tag you filter Activity by. It applies to whichever cycle you are viewing.
          </DialogDescription>
        </DialogHeader>

        {canSaveCurrent && (
          <form
            className="space-y-2 rounded-lg border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <p className="text-xs text-muted-foreground">
              Current filter: <span className="font-medium text-foreground">{describeFilter(current)}</span>
            </p>
            <Label htmlFor="saved-filter-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="saved-filter-name"
                value={name}
                maxLength={SAVED_FILTER_NAME_MAX}
                placeholder="e.g. Rideshare, this quarter"
                className="min-w-0 flex-1"
                onChange={(event) => {
                  setName(event.target.value)
                  setFormError(null)
                }}
              />
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
            <FormError error={formError} className="mt-0 px-0" />
          </form>
        )}

        <div className="space-y-2">
          {loadState === 'loading' && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
          {(loadState === 'error' || loadState === 'stale-error') && error && (
            <div className="space-y-1">
              <InlineLoadError message={error} onRetry={onRetry} />
              {errorDetail && <TechnicalDetail detail={errorDetail} />}
            </div>
          )}
          {loadState === 'empty' && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No saved filters yet. Filter Activity by type, search or tag, then save it here.
            </p>
          )}
          {filters.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Saved filters">
              {filters.map((saved) => {
                const editing = editingId === saved.id
                const busy = busyId === saved.id
                return (
                  <li key={saved.id} className="flex items-center gap-2 px-3 py-2">
                    {editing ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void handleRename(saved)
                        }}
                      >
                        <Input
                          aria-label={`New name for ${saved.name}`}
                          value={editName}
                          maxLength={SAVED_FILTER_NAME_MAX}
                          className="min-w-0 flex-1"
                          onChange={(event) => {
                            setEditName(event.target.value)
                            setRowError(null)
                          }}
                        />
                        <Button type="submit" size="sm" disabled={busy || !editName.trim()}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null)
                            setRowError(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="min-w-0 flex-1 rounded-md text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          onClick={() => {
                            onApply(saved.filter)
                            onOpenChange(false)
                          }}
                        >
                          <span className="block truncate text-sm font-medium">{saved.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{describeFilter(saved.filter)}</span>
                        </button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Rename ${saved.name}`}
                          disabled={busy}
                          onClick={() => {
                            setEditingId(saved.id)
                            setEditName(saved.name)
                            setRowError(null)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${saved.name}`}
                          disabled={busy}
                          onClick={() => void handleDelete(saved)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <FormError error={rowError} className="mt-0 px-0" />
          {skipped > 0 && (
            <p className="text-xs text-muted-foreground">
              {skipped} saved {skipped === 1 ? 'filter was' : 'filters were'} made by a newer version of Ledger and{' '}
              {skipped === 1 ? 'is' : 'are'} not shown.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
