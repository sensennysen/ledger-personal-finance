import React, { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Pencil,
  Trash2,
  Smile,
  ChevronDown,
  ChevronRight,
  ListTree,
  Zap,
  GripVertical,
  GitMerge,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { useNotify } from '@/contexts/notificationState'
import { useCategories } from '@/hooks/useCategories'
import { useSubcategories } from '@/hooks/useSubcategories'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { useTransactionRules, type TransactionRule } from '@/hooks/useTransactionRules'
import { useCategoryUsage } from '@/hooks/useCategoryUsage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/contexts/AuthContext'
import { useCycle } from '@/contexts/cycleState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn, formatCurrency, formatDateShort, getCurrentCycleMonthKey, getCustomMonthRange } from '@/lib/utils'
import {
  buildCategoryUsage,
  deleteCostSentence,
  shareOf,
  unusedCategoryIds,
  type CategoryUsageRow,
  type Sides,
} from '@/lib/categoryUsage'
import { ErrorState, InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import type { FormErrorValue } from '@/lib/dataErrors'
import { resolveLoadState } from '@/lib/loadState'
import type { Category, Subcategory } from '@/types'
import { useCategoryInk } from '@/hooks/useCategoryInk'
import { SWATCHES } from '@/lib/swatches'
import { Switch } from '@/components/ui/switch'
import { clashSentence, findNameClash } from '@/lib/categoryNames'
import { mergeSubsetOrder, moveAnnouncement, moveId, reorderIds } from '@/lib/reorder'
import { budgetNote, mergedSentence, mergeSentence, mergeTargets, type MergePreview } from '@/lib/categoryMerge'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

const DEFAULT_CATEGORY_ICON = '\u{1F3F7}\uFE0F'
const DEFAULT_EMOJI_PLACEHOLDER = '\u{1F600}'
const RULE_TYPE_HINT_LABELS = { any: 'Any type', income: 'Income', expense: 'Expense', transfer: 'Transfer' } as const

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  type: z.enum(['income', 'expense', 'both']),
  color: z.string(),
  icon: z.string(),
  counts_as_salary: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function CategoryForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: SWATCHES[0],
      icon: DEFAULT_CATEGORY_ICON,
      counts_as_salary: false,
      ...defaultValues,
    },
  })
  // Salary is income: an expense-only category can't count as salary (LED-236).
  const canCountAsSalary = useWatch({ control: form.control, name: 'type' }) !== 'expense'

  React.useEffect(() => {
    const currentIcon = form.getValues('icon')
    if (!currentIcon) {
      form.setValue('icon', DEFAULT_CATEGORY_ICON, { shouldDirty: false, shouldTouch: false })
    }
  }, [form])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit({ ...values, counts_as_salary: canCountAsSalary && values.counts_as_salary }))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl><Input placeholder="e.g. Groceries" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue>
                      {field.value === 'expense' ? 'Expense' : field.value === 'income' ? 'Income' : 'Both'}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {canCountAsSalary && (
          <FormField
            control={form.control}
            name="counts_as_salary"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="cursor-pointer">Counts as salary</FormLabel>
                  <p className="text-xs text-muted-foreground">13th Month pay counts income in this category as basic salary.</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon</FormLabel>
              <FormControl>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-muted/50 text-2xl">
                    {field.value || DEFAULT_EMOJI_PLACEHOLDER}
                  </div>
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger render={
                      <Button type="button" variant="outline" className="gap-2">
                        <Smile className="w-4 h-4" />
                        Choose Emoji
                      </Button>
                    } />
                    <PopoverContent
                      align="start"
                      sideOffset={8}
                      className="w-[min(calc(100vw-2rem),20rem)] max-w-[calc(100vw-2rem)] overflow-hidden border-0 p-0 shadow-xl"
                    >
                      <EmojiPicker
                        onEmojiClick={(emoji) => {
                          field.onChange(emoji.emoji)
                          setEmojiPickerOpen(false)
                        }}
                        emojiStyle={EmojiStyle.NATIVE}
                        theme={Theme.AUTO}
                        width="100%"
                        height={380}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                        searchPlaceholder="Search emoji..."
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  palette={SWATCHES}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Category'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

type UsageSide = 'expense' | 'income'

// Reorder mode (LED-240, design 8a item 5): one Reorder control puts a list into this mode,
// where every row, at every width, can be dragged with a pointer or moved with these buttons.
function ReorderButtons({
  scope,
  id,
  name,
  index,
  count,
  onMove,
}: {
  scope: string
  id: string
  name: string
  index: number
  count: number
  onMove: (id: string, direction: -1 | 1) => void
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${name} up`}
        data-reorder={`${scope}:${id}:up`}
        onClick={() => onMove(id, -1)}
        disabled={index === 0}
      >
        <ArrowUp className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${name} down`}
        data-reorder={`${scope}:${id}:down`}
        onClick={() => onMove(id, 1)}
        disabled={index === count - 1}
      >
        <ArrowDown className="w-3 h-3" />
      </Button>
    </>
  )
}

/**
 * Keeps focus on the moved row's button after React moves the row, so a keyboard user can press
 * again. At an end the button in that direction is disabled, so the other one takes focus.
 */
function refocusMove(scope: string, id: string, direction: -1 | 1) {
  requestAnimationFrame(() => {
    const pick = (dir: string) =>
      document.querySelector<HTMLButtonElement>(`[data-reorder="${scope}:${id}:${dir}"]:not(:disabled)`)
    ;(pick(direction === -1 ? 'up' : 'down') ?? pick(direction === -1 ? 'down' : 'up'))?.focus()
  })
}

// `spendBySub` is this cycle's spend per subcategory; null while usage is not available, so a
// missing figure shows a dash and never a zero. Omit it to draw names only.
function SubcategoryPanel({
  category,
  spendBySub,
  side = 'expense',
  currency,
}: {
  category: Category
  spendBySub?: Map<string, Sides> | null
  side?: UsageSide
  currency?: string
}) {
  const { subcategories, loading, createSubcategory, updateSubcategory, deleteSubcategory, updateSubcategoryOrder } = useSubcategories(category.id)
  const notify = useNotify()
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState<FormErrorValue>(null)
  const [adding, setAdding] = useState(false)
  const [editSub, setEditSub] = useState<Subcategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<FormErrorValue>(null)
  const [rearrangeMode, setRearrangeMode] = useState(false)
  const [draggedSubcategoryId, setDraggedSubcategoryId] = useState<string | null>(null)
  const [dropTargetSubcategoryId, setDropTargetSubcategoryId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const subcategoryIds = useMemo(() => subcategories.map((sub) => sub.id), [subcategories])
  const setSubcategoryRef = useFlipReorder(subcategoryIds, rearrangeMode)

  const handleAdd = async () => {
    const trimmed = addName.trim()
    if (!trimmed) { setAddError('Name is required'); return }
    if (findNameClash(trimmed, subcategories)) { setAddError(clashSentence('subcategory', trimmed, category.name)); return }
    setAdding(true)
    const { error, errorDetail } = await createSubcategory(trimmed)
    setAdding(false)
    if (error) { setAddError({ message: error, detail: errorDetail ?? null }); return }
    setAddName('')
    setAddError(null)
  }

  const startEdit = (sub: Subcategory) => {
    setEditSub(sub)
    setEditName(sub.name)
    setEditError(null)
  }

  const handleEditSave = async () => {
    if (!editSub) return
    const trimmed = editName.trim()
    if (!trimmed) { setEditError('Name is required'); return }
    if (findNameClash(trimmed, subcategories, editSub)) { setEditError(clashSentence('subcategory', trimmed, category.name)); return }
    const { error, errorDetail } = await updateSubcategory(editSub.id, { name: trimmed })
    if (error) { setEditError({ message: error, detail: errorDetail ?? null }); return }
    setEditSub(null)
  }

  const persistSubcategoryOrder = async (nextIds: string[], movedId: string) => {
    const name = subcategories.find((sub) => sub.id === movedId)?.name ?? 'Subcategory'
    setAnnouncement(moveAnnouncement(name, nextIds, movedId))
    const { error } = await updateSubcategoryOrder(nextIds)
    if (error) notify({ severity: 'failure', title: "Couldn't change the order", body: error })
  }

  const reorderSubcategory = (fromId: string, toId: string) => {
    const nextIds = reorderIds(subcategoryIds, fromId, toId)
    if (nextIds !== subcategoryIds) void persistSubcategoryOrder(nextIds, fromId)
  }

  const moveSubcategory = (id: string, direction: -1 | 1) => {
    const nextIds = moveId(subcategoryIds, id, direction)
    if (nextIds === subcategoryIds) return
    void persistSubcategoryOrder(nextIds, id)
    refocusMove('sub', id, direction)
  }

  return (
    <div className="border-t bg-muted/30 px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-1.5">
          <ListTree className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subcategories</span>
        </div>
        {subcategories.length > 1 && (
          <Button
            variant={rearrangeMode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => {
              setRearrangeMode((current) => !current)
              setDraggedSubcategoryId(null)
              setDropTargetSubcategoryId(null)
            }}
          >
            {rearrangeMode ? <Check className="w-3 h-3" /> : <GripVertical className="w-3 h-3" />}
            {rearrangeMode ? 'Done' : 'Reorder'}
          </Button>
        )}
      </div>
      <div className="sr-only" aria-live="polite">{rearrangeMode ? announcement : ''}</div>
      {loading ? (
        <div className="space-y-1" aria-busy="true">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex min-h-8 items-center gap-2 rounded-md px-1 py-1">
              <span className="flex-1 pl-1 text-sm"><SkeletonText className="w-28" /></span>
              <span className="text-xs"><SkeletonText className="w-12" /></span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {subcategories.map((sub, idx) => (
            <div
              key={sub.id}
              ref={setSubcategoryRef(sub.id)}
              draggable={rearrangeMode}
              onDragStart={() => {
                if (rearrangeMode) {
                  setDraggedSubcategoryId(sub.id)
                  setDropTargetSubcategoryId(null)
                }
              }}
              onDragEnter={() => {
                if (rearrangeMode && draggedSubcategoryId && draggedSubcategoryId !== sub.id) {
                  setDropTargetSubcategoryId(sub.id)
                }
              }}
              onDragOver={(event) => {
                if (rearrangeMode) {
                  event.preventDefault()
                  if (draggedSubcategoryId && draggedSubcategoryId !== sub.id) {
                    setDropTargetSubcategoryId(sub.id)
                  }
                }
              }}
              onDrop={(event) => {
                if (!rearrangeMode) return
                event.preventDefault()
                if (draggedSubcategoryId) reorderSubcategory(draggedSubcategoryId, sub.id)
                setDraggedSubcategoryId(null)
                setDropTargetSubcategoryId(null)
              }}
              onDragEnd={() => {
                setDraggedSubcategoryId(null)
                setDropTargetSubcategoryId(null)
              }}
              className={cn(
                'reorder-motion flex items-center gap-2 rounded-md px-1 py-1',
                rearrangeMode && 'cursor-grab border border-transparent',
                draggedSubcategoryId === sub.id && 'is-dragging',
                dropTargetSubcategoryId === sub.id && 'is-drop-target'
              )}
            >
              {editSub?.id === sub.id ? (
                <>
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditSub(null) }}
                    autoFocus
                  />
                  <FormError error={editError} className="text-xs px-0 mt-0" />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={handleEditSave}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditSub(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1 pl-1 truncate">{sub.name}</span>
                  {spendBySub !== undefined && currency && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {spendBySub === null ? '—' : formatCurrency(spendBySub.get(sub.id)?.[side] ?? 0, currency)}
                    </span>
                  )}
                  {rearrangeMode ? (
                    <ReorderButtons scope="sub" id={sub.id} name={sub.name} index={idx} count={subcategories.length} onMove={moveSubcategory} />
                  ) : (
                  <>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => startEdit(sub)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" />}>
                      <Trash2 className="w-3 h-3" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete subcategory?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete "{sub.name}". Transactions using it will lose this subcategory.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          const { error } = await deleteSubcategory(sub.id)
                          if (error) console.error('Failed to delete subcategory:', error)
                        }}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </>
                  )}
                </>
              )}
            </div>
          ))}
          {subcategories.length === 0 && (
            <p className="text-xs text-muted-foreground pl-1">No subcategories yet</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Input
          className="h-7 text-sm flex-1"
          placeholder="New subcategory name"
          value={addName}
          onChange={(e) => { setAddName(e.target.value); setAddError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 shrink-0" onClick={handleAdd} disabled={adding}>
          <Plus className="w-3 h-3" />{adding ? 'Adding...' : 'Add'}
        </Button>
      </div>
      <FormError error={addError} className="text-xs px-0 pl-1 mt-0" />
    </div>
  )
}

// The category's detail (design 8a): this cycle's spend, its subcategories with their spend,
// and the auto-categorise rules that file into it. One component for both surfaces: the pane
// beside the list from xl up, and the block under a row below it.
function CategoryPane({
  category,
  row,
  side,
  total,
  currency,
  cycleLabel,
  rules,
  rulesLoading,
  rulesError,
  onManageRules,
  header,
  onMerge,
}: {
  category: Category
  /** Null while usage is not available: figures show a dash, never zero. */
  row: CategoryUsageRow | null
  side: UsageSide
  total: number
  currency: string
  cycleLabel: string
  rules: TransactionRule[]
  rulesLoading: boolean
  rulesError: string | null
  onManageRules: () => void
  header?: React.ReactNode
  /** Opens Merge into… (LED-239); omitted when no category can take this one's rows. */
  onMerge?: () => void
}) {
  const share = row ? shareOf(row.spend[side], total) : null
  const own = rules.filter((rule) => rule.category_id === category.id)
  return (
    <div className="space-y-0">
      {header}
      <div className="border-t bg-muted/30 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {side === 'income' ? 'Income' : 'Spend'} this cycle · {cycleLabel}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {row ? formatCurrency(row.spend[side], currency) : '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          {row
            ? `${share === null ? 'No' : `${share}% of all`} ${side === 'income' ? 'income' : 'spending'} this cycle · ${row.txCount} ${row.txCount === 1 ? 'transaction' : 'transactions'} all time`
            : 'Usage is not available right now.'}
        </p>
      </div>
      <SubcategoryPanel category={category} spendBySub={row ? row.bySubcategory : null} side={side} currency={currency} />
      <div className="border-t px-3 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />Auto-categorization
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onManageRules}>Manage all</Button>
        </div>
        {rulesError ? (
          <p className="text-xs text-destructive">{rulesError}</p>
        ) : rulesLoading ? (
          // One rule, as the loaded list shows it: its count line over a 34px row. The runs sit in spans
          // because a bare inline-block flex item is 9px, not the 20px text line (LED-200).
          <>
            <p className="text-xs"><SkeletonText className="w-48" /></p>
            <ul className="space-y-1" aria-busy="true">
              <li className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2.5 py-1.5 text-sm">
                <span><SkeletonText className="w-24" /></span>
                <span><SkeletonText className="w-6" /></span>
              </li>
            </ul>
          </>
        ) : own.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rules assign transactions to {category.name}.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {own.length} {own.length === 1 ? 'rule assigns' : 'rules assign'} transactions to {category.name}
            </p>
            <ul className="space-y-1">
              {own.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate font-medium">"{rule.keyword}"</span>
                  <Badge variant="secondary" className="text-xs">p{rule.priority}</Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {onMerge && (
        <div className="flex justify-end border-t px-3 py-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onMerge}>
            <GitMerge className="w-3.5 h-3.5" />Merge into…
          </Button>
        </div>
      )}
    </div>
  )
}

// Merge into… (LED-239, design 8a item 6). One rpc moves everything and deletes the source;
// the confirmation first reads what will move so the user sees the counts.
function MergeCategoryDialog({
  source,
  targets,
  previewMerge,
  onConfirm,
  onClose,
}: {
  source: Category
  targets: Category[]
  previewMerge: (sourceId: string, targetId: string) => Promise<{ preview: MergePreview | null; error: string | null }>
  /** Runs the merge; a failure is reported on the notification surface with Retry. */
  onConfirm: (target: Category) => Promise<void>
  onClose: () => void
}) {
  const { isOnline } = useNetworkStatus()
  const [targetId, setTargetId] = useState('')
  const [preview, setPreview] = useState<{ targetId: string; data: MergePreview | null; error: string | null } | null>(null)
  const [merging, setMerging] = useState(false)
  const target = targets.find((category) => category.id === targetId) ?? null
  const current = preview && preview.targetId === targetId ? preview : null

  const choose = async (id: string) => {
    setTargetId(id)
    if (!id) return
    const result = await previewMerge(source.id, id)
    setPreview({ targetId: id, data: result.preview, error: result.error })
  }

  const merge = async () => {
    if (!target) return
    setMerging(true)
    await onConfirm(target)
    setMerging(false)
  }

  const note = current?.data && target ? budgetNote(current.data.budgets, current.data.targetActiveBudgets, target.name) : null
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !merging) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Merge {source.name} into…</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={targetId} onValueChange={(value) => void choose(value ?? '')}>
            <SelectTrigger aria-label="Category to merge into">
              <SelectValue>
                {(value: string | null) => {
                  const chosen = targets.find((category) => category.id === value)
                  return chosen ? `${chosen.icon} ${chosen.name}` : 'Choose a category'
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {targets.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isOnline ? (
            <p className="text-sm text-muted-foreground">Connect to the internet to merge categories.</p>
          ) : !target ? (
            <p className="text-sm text-muted-foreground">
              Everything in {source.name} moves to the category you choose, then {source.name} is deleted.
            </p>
          ) : !current ? (
            <p className="text-sm" aria-busy="true"><SkeletonText className="w-64" /></p>
          ) : current.error ? (
            <InlineLoadError message={`Couldn't count what would move. ${current.error}`} onRetry={() => void choose(targetId)} />
          ) : current.data ? (
            <div className="space-y-1.5 text-sm" aria-live="polite">
              <p>{mergeSentence(current.data, source.name, target.name)}</p>
              {note && <p className="text-muted-foreground">{note}</p>}
              <p className="text-muted-foreground">This can't be undone.</p>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={merging}>Cancel</Button>
          <Button onClick={() => void merge()} disabled={!isOnline || !current?.data || merging}>
            {merging ? 'Merging…' : 'Merge'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage() {
  const ink = useCategoryInk()
  const notify = useNotify()
  const { categories, loading, error, errorDetail, refetch, createCategory, updateCategory, deleteCategory, updateCategoryOrder, previewMerge, mergeCategory } = useCategories()
  const loadState = resolveLoadState({ loading, error, hasData: categories.length > 0 })
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [formError, setFormError] = useState<FormErrorValue>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'unused'>('expense')
  const [rearrangeMode, setRearrangeMode] = useState(false)
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [mergeSource, setMergeSource] = useState<Category | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  // Rules load with the page: the button states their count and each category's pane lists its own.
  const { rules, loading: rulesLoading, error: rulesError, refetch: refetchRules, createRule, deleteRule } = useTransactionRules(true)
  const { profile } = useAuth()
  const { startDay } = useCycle()
  const usageData = useCategoryUsage()
  // From xl the detail is a pane beside the list; below it, the same detail opens under the row.
  const paneMode = useMediaQuery('(min-width: 1280px)')
  const currency = profile?.default_currency ?? 'USD'
  // "This cycle" is today's cycle: the Categories header has no stepper to move it.
  const cycleRange = useMemo(() => getCustomMonthRange(getCurrentCycleMonthKey(startDay), startDay), [startDay])
  const cycleLabel = `${formatDateShort(cycleRange.start)} – ${formatDateShort(cycleRange.end)}`
  const usage = useMemo(
    () => buildCategoryUsage(usageData.txs, cycleRange, currency),
    [usageData.txs, cycleRange, currency],
  )
  const [ruleKeyword, setRuleKeyword] = useState('')
  const [ruleCategoryId, setRuleCategoryId] = useState('')
  const [ruleTypeHint, setRuleTypeHint] = useState<'any' | 'income' | 'expense' | 'transfer'>('any')
  const [rulePriority, setRulePriority] = useState(1)

  const handleCreate = async (values: FormValues) => {
    if (findNameClash(values.name, categories)) { setFormError(clashSentence('category', values.name)); return }
    const { error, errorDetail } = await createCategory(values)
    if (error) { setFormError({ message: error, detail: errorDetail ?? null }); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editCategory) return
    if (findNameClash(values.name, categories, editCategory)) { setFormError(clashSentence('category', values.name)); return }
    const { error, errorDetail } = await updateCategory(editCategory.id, values)
    if (error) { setFormError({ message: error, detail: errorDetail ?? null }); return }
    setFormError(null)
    setEditCategory(null)
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  // Unused needs the usage read; until it succeeds the tab has nothing honest to list.
  const unusedIds = usageData.usable ? new Set(unusedCategoryIds(categories.map((c) => c.id), usage)) : null
  const unusedCategories = categories.filter((c) => unusedIds?.has(c.id))
  const tabCategories =
    activeTab === 'expense' ? expenseCategories : activeTab === 'income' ? incomeCategories : unusedCategories
  const visibleCategoryIds = useMemo(
    () => tabCategories.map((category) => category.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tabCategories is derived from the deps below
    [activeTab, expenseCategories, incomeCategories, unusedCategories]
  )
  const side: UsageSide = activeTab === 'income' ? 'income' : 'expense'
  // A category's figures; a category the read did not see has none. Null until usage is available.
  const usageRow = (id: string): CategoryUsageRow | null =>
    usageData.usable
      ? usage.byCategory.get(id) ?? { txCount: 0, spend: { expense: 0, income: 0 }, bySubcategory: new Map() }
      : null
  const paneCategory = paneMode
    ? tabCategories.find((category) => category.id === selectedCategoryId) ?? tabCategories[0] ?? null
    : null
  const isSelected = (id: string) => (paneMode ? paneCategory?.id === id : selectedCategoryId === id)

  const setCategoryRef = useFlipReorder(visibleCategoryIds, rearrangeMode)

  const persistCategoryOrder = async (nextVisibleIds: string[], movedId: string) => {
    const name = categories.find((category) => category.id === movedId)?.name ?? 'Category'
    setAnnouncement(moveAnnouncement(name, nextVisibleIds, movedId))
    const nextIds = mergeSubsetOrder(
      categories.map((category) => category.id),
      nextVisibleIds
    )
    const { error } = await updateCategoryOrder(nextIds)
    if (error) notify({ severity: 'failure', title: "Couldn't change the order", body: error })
  }

  const reorderCategory = (fromId: string, toId: string) => {
    const nextIds = reorderIds(visibleCategoryIds, fromId, toId)
    if (nextIds !== visibleCategoryIds) void persistCategoryOrder(nextIds, fromId)
  }

  const moveCategory = (id: string, direction: -1 | 1) => {
    const nextIds = moveId(visibleCategoryIds, id, direction)
    if (nextIds === visibleCategoryIds) return
    void persistCategoryOrder(nextIds, id)
    refocusMove('category', id, direction)
  }

  const mergeHandler = (category: Category) =>
    mergeTargets(categories, category).length > 0 ? () => setMergeSource(category) : undefined

  const runMerge = async (source: Category, target: Category) => {
    const { error, result } = await mergeCategory(source.id, target.id)
    if (error || !result) {
      setMergeSource(null)
      notify({
        severity: 'failure',
        title: `Couldn't merge ${source.name}`,
        body: error ?? 'Try again.',
        action: { label: 'Retry', run: () => void runMerge(source, target) },
      })
      return
    }
    handleMerged(source, target, result)
  }

  const handleMerged = (source: Category, target: Category, result: MergePreview) => {
    setMergeSource(null)
    setSelectedCategoryId(target.id)
    void usageData.refetch()
    void refetchRules()
    notify({
      severity: 'success',
      title: `Merged ${source.name} into ${target.name}`,
      body: [
        mergedSentence(result, source.name, target.name),
        budgetNote(result.budgets, result.targetActiveBudgets, target.name)?.replace(' will have ', ' now has '),
      ].filter(Boolean).join(' '),
    })
  }

  const toggleReorder = () => {
    setRearrangeMode((current) => !current)
    setDraggedCategoryId(null)
    setDropTargetCategoryId(null)
    setAnnouncement('')
  }

  // Column labels for md and up; the widths match the cells in each row.
  const columnHeader = (
    <div aria-hidden className="hidden items-center gap-2 px-3 text-xs font-medium text-muted-foreground md:flex">
      <span className="flex-1">Category</span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="w-24 text-right">Subcategories</span>
        <span className="w-24 text-right">{side === 'income' ? 'Income' : 'Spend'}</span>
        <span className="w-16 text-right">Share</span>
        <span className="w-24 text-right">Transactions</span>
      </div>
      <span className="w-16 shrink-0" />
    </div>
  )

  const renderCategories = (cats: Category[]) =>
    cats.map((cat, idx) => {
      const row = usageRow(cat.id)
      const subCount = usageData.subCounts.get(cat.id) ?? 0
      const share = row ? shareOf(row.spend[side], usage.totals[side]) : null
      const spendLabel = row ? (activeTab === 'unused' ? '—' : formatCurrency(row.spend[side], currency)) : '—'
      const txCountLabel = row ? `${row.txCount} tx` : ''
      return (
      <div
        key={cat.id}
        ref={setCategoryRef(cat.id)}
        draggable={rearrangeMode}
        onDragStart={() => {
          if (rearrangeMode) {
            setDraggedCategoryId(cat.id)
            setDropTargetCategoryId(null)
          }
        }}
        onDragEnter={() => {
          if (rearrangeMode && draggedCategoryId && draggedCategoryId !== cat.id) setDropTargetCategoryId(cat.id)
        }}
        onDragOver={(event) => {
          if (rearrangeMode) {
            event.preventDefault()
            if (draggedCategoryId && draggedCategoryId !== cat.id) setDropTargetCategoryId(cat.id)
          }
        }}
        onDrop={(event) => {
          if (!rearrangeMode) return
          event.preventDefault()
          if (draggedCategoryId) reorderCategory(draggedCategoryId, cat.id)
          setDraggedCategoryId(null)
          setDropTargetCategoryId(null)
        }}
        onDragEnd={() => {
          setDraggedCategoryId(null)
          setDropTargetCategoryId(null)
        }}
        className={cn(
          'reorder-motion rounded-lg border bg-card overflow-hidden animate-fade-up',
          rearrangeMode && 'cursor-grab',
          draggedCategoryId === cat.id && 'is-dragging',
          dropTargetCategoryId === cat.id && 'is-drop-target'
        )}
        style={{ '--anim-delay': `${Math.min(idx * 50, 200)}ms` } as React.CSSProperties}
      >
        <div className={cn('flex items-center justify-between gap-2 p-3 hover:bg-accent/50 transition-colors', paneMode && isSelected(cat.id) && 'bg-accent/60')}>
          <button
            type="button"
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
            aria-expanded={paneMode ? undefined : isSelected(cat.id)}
            aria-current={paneMode && isSelected(cat.id) ? 'true' : undefined}
            // While reordering, the row is moved, not opened: its move buttons take the keyboard.
            tabIndex={rearrangeMode ? -1 : undefined}
            onClick={() => {
              if (rearrangeMode) return
              setSelectedCategoryId(!paneMode && selectedCategoryId === cat.id ? null : cat.id)
            }}
          >
            {!paneMode && (isSelected(cat.id)
              ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <div
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: ink(cat.color) + '20' }}
            >
              {cat.icon}
            </div>
            <div className="min-w-0 flex-1 flex flex-col items-start">
              <p className="font-medium text-sm truncate max-w-full">{cat.name}</p>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {cat.type === 'both' ? 'Income & Expense' : cat.type === 'expense' ? 'Expense' : 'Income'}
                </Badge>
                {cat.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                {row
                  ? `${subCount} ${subCount === 1 ? 'sub' : 'subs'} · ${txCountLabel}${share === null ? '' : ` · ${share}% of ${side === 'income' ? 'income' : 'spend'}`}`
                  : 'Usage unavailable'}
              </p>
            </div>
            <span className="ml-auto shrink-0 text-sm font-medium tabular-nums md:hidden">{spendLabel}</span>
            <div className="hidden shrink-0 items-center gap-3 text-sm tabular-nums md:flex">
              <span className="w-24 text-right">{row ? subCount : '—'}</span>
              <span className="w-24 text-right">{spendLabel}</span>
              <span className="w-16 text-right text-muted-foreground">{share === null ? '—' : `${share}%`}</span>
              <span className="w-24 text-right">{row ? row.txCount : '—'}</span>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0 md:w-16 md:justify-end">
            {rearrangeMode ? (
              <ReorderButtons scope="category" id={cat.id} name={cat.name} index={idx} count={cats.length} onMove={moveCategory} />
            ) : (
            <>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${cat.name}`} onClick={() => setEditCategory(cat)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Delete ${cat.name}`} />}>
                <Trash2 className="w-3 h-3" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete category?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteCostSentence(cat.name, row ? row.txCount : null, usageData.usable ? subCount : null)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    const { error } = await deleteCategory(cat.id)
                    if (error) notify({ severity: 'failure', title: "Couldn't delete the category", body: error })
                  }}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </>
            )}
          </div>
        </div>
        {!paneMode && isSelected(cat.id) && (
          <CategoryPane
            category={cat}
            row={row}
            side={side}
            total={usage.totals[side]}
            currency={currency}
            cycleLabel={cycleLabel}
            rules={rules}
            rulesLoading={rulesLoading}
            rulesError={rulesError}
            onManageRules={() => setRulesOpen(true)}
            onMerge={mergeHandler(cat)}
          />
        )}
      </div>
      )
    })

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl xl:max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Customize your transaction categories</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRulesOpen(true)}>
            <Zap className="w-3.5 h-3.5" />Auto-categorize
            <Badge variant="secondary" className="text-xs tabular-nums">
              {rulesLoading ? '…' : rulesError ? '—' : rules.length}
            </Badge>
          </Button>
          {categories.length > 1 && (
            <Button variant={rearrangeMode ? 'secondary' : 'outline'} size="sm" className="gap-1.5" aria-pressed={rearrangeMode} onClick={toggleReorder}>
              {rearrangeMode ? <Check className="w-3.5 h-3.5" /> : <GripVertical className="w-3.5 h-3.5" />}
              {rearrangeMode ? 'Done' : 'Reorder'}
            </Button>
          )}
          <div className="sr-only" aria-live="polite">{rearrangeMode ? announcement : ''}</div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="gap-2" size="sm" />}>
              <Plus className="w-4 h-4" />Add Category
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
              <FormError error={formError} />
              <CategoryForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadState === 'stale-error' && (
        <InlineLoadError message="Couldn't refresh your categories. Showing what was last loaded." onRetry={() => void refetch()} />
      )}
      {usageData.error && (
        <InlineLoadError
          message={usageData.usable
            ? "Couldn't refresh usage. The spend and counts shown may be out of date."
            : "Couldn't load usage, so spend, counts and the Unused tab are hidden."}
          onRetry={() => void usageData.refetch()}
        />
      )}
      {rulesError && (
        <InlineLoadError message="Couldn't load your auto-categorization rules." onRetry={() => void refetchRules()} />
      )}
      {loadState === 'error' ? (
        <ErrorState title="Couldn't load your categories" description={error} detail={errorDetail} onRetry={() => void refetch()} />
      ) : loading ? (
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-6" aria-busy="true" aria-label="Loading categories">
          <div>
            <Tabs value="expense">
              <TabsList className="w-full">
                {['Expenses', 'Income', 'Unused'].map((label) => (
                  <TabsTrigger key={label} value={label === 'Expenses' ? 'expense' : label.toLowerCase()} disabled className="flex-1">
                    {label}
                    <Badge variant="secondary" className="ml-2 text-xs">…</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="mt-4 space-y-2">
              {columnHeader}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border bg-card">
                  <div className="flex items-center gap-3 p-3">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium"><SkeletonText className="w-32" /></p>
                      <div className="flex h-5 items-center"><Skeleton className="h-3 w-20 rounded-full" /></div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 text-sm md:flex">
                      {['w-24', 'w-24', 'w-16', 'w-24'].map((w, cell) => (
                        <span key={cell} className={cn('text-right', w)}><SkeletonText className="w-10" /></span>
                      ))}
                    </div>
                    <span className="hidden h-7 shrink-0 md:block md:w-16" />
                  </div>
                </div>
              ))}
              </div>
            </Tabs>
          </div>
          {paneMode && (
            <aside aria-hidden className="sticky top-6 overflow-hidden rounded-lg border bg-card">
              <p className="p-6 text-center text-sm"><SkeletonText className="w-48" /></p>
            </aside>
          )}
        </div>
      ) : (
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'expense' | 'income' | 'unused')}>
          <TabsList className="w-full">
            <TabsTrigger value="expense" className="flex-1">
              Expenses
              <Badge variant="secondary" className="ml-2 text-xs">{expenseCategories.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="income" className="flex-1">
              Income
              <Badge variant="secondary" className="ml-2 text-xs">{incomeCategories.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unused" className="flex-1">
              Unused
              <Badge variant="secondary" className="ml-2 text-xs tabular-nums">
                {unusedIds ? unusedCategories.length : usageData.loading ? '…' : '—'}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="expense" className="mt-4">
            {expenseCategories.length === 0 ? (
              <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">No expense categories</CardContent></Card>
            ) : (
              <div className="space-y-2">{columnHeader}{renderCategories(expenseCategories)}</div>
            )}
          </TabsContent>
          <TabsContent value="income" className="mt-4">
            {incomeCategories.length === 0 ? (
              <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">No income categories</CardContent></Card>
            ) : (
              <div className="space-y-2">{columnHeader}{renderCategories(incomeCategories)}</div>
            )}
          </TabsContent>
          <TabsContent value="unused" className="mt-4">
            {!unusedIds ? (
              usageData.loading ? (
                <div className="overflow-hidden rounded-lg border bg-card" aria-busy="true">
                  <div className="flex items-center gap-3 p-3">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium"><SkeletonText className="w-32" /></p>
                      <div className="flex h-5 items-center"><Skeleton className="h-3 w-20 rounded-full" /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">Usage didn't load, so unused categories can't be listed.</CardContent></Card>
              )
            ) : unusedCategories.length === 0 ? (
              <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">Every category has at least one transaction.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No transaction has ever used these, so deleting them uncategorizes nothing.</p>
                {renderCategories(unusedCategories)}
              </div>
            )}
          </TabsContent>
        </Tabs>
        {paneMode && (
          <aside aria-label="Category detail" className="sticky top-6 rounded-lg border bg-card overflow-hidden">
            {paneCategory ? (
              <CategoryPane
                key={paneCategory.id}
                category={paneCategory}
                row={usageRow(paneCategory.id)}
                side={side}
                total={usage.totals[side]}
                currency={currency}
                cycleLabel={cycleLabel}
                rules={rules}
                rulesLoading={rulesLoading}
                rulesError={rulesError}
                onManageRules={() => setRulesOpen(true)}
                onMerge={mergeHandler(paneCategory)}
                header={
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: ink(paneCategory.color) + '20' }}
                    >
                      {paneCategory.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{paneCategory.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {paneCategory.type === 'both' ? 'Income & Expense' : paneCategory.type === 'expense' ? 'Expense' : 'Income'}
                      </p>
                    </div>
                  </div>
                }
              />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Select a category to see its detail.</p>
            )}
          </aside>
        )}
        </div>
      )}

      {mergeSource && (
        <MergeCategoryDialog
          source={mergeSource}
          targets={mergeTargets(categories, mergeSource)}
          previewMerge={previewMerge}
          onConfirm={(target) => runMerge(mergeSource, target)}
          onClose={() => setMergeSource(null)}
        />
      )}

      <Dialog open={!!editCategory} onOpenChange={(o) => { if (!o) { setEditCategory(null); setFormError(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <FormError error={formError} />
          {editCategory && (
            <CategoryForm
              defaultValues={editCategory as Partial<FormValues>}
              onSubmit={handleEdit}
              onClose={() => { setEditCategory(null); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Auto-Categorization Rules
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {rulesLoading ? (
              <div className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2" aria-busy="true">
                <span className="text-sm"><SkeletonText className="w-40" /></span>
              </div>
            ) : rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rules yet. Add a rule to auto-assign categories when entering transactions.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded border bg-muted/30">
                    <span className="text-sm font-medium">"{rule.keyword}"</span>
                    <div className="flex items-center gap-2 flex-1 mx-2">
                      <span className="text-muted-foreground">-&gt;</span>
                      <span className="text-sm">{rule.category?.name ?? rule.category_id}</span>
                      {rule.type_hint && (
                        <Badge variant="outline" className="text-xs">{rule.type_hint}</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs ml-auto">p{rule.priority}</Badge>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" />}>
                        <Trash2 className="w-3 h-3" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                          <AlertDialogDescription>Remove auto-categorization rule for "{rule.keyword}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRule(rule.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Input
                placeholder="Keyword (e.g. Starbucks)"
                value={ruleKeyword}
                onChange={(e) => setRuleKeyword(e.target.value)}
                className="flex-1 min-w-[140px] h-8 text-sm"
              />
              <Select value={ruleCategoryId} onValueChange={(v) => setRuleCategoryId(v ?? '')}>
                <SelectTrigger className="flex-1 min-w-[140px] h-8 text-sm">
                  <SelectValue>
                    {(value: string | null) => {
                      const chosen = categories.find((category) => category.id === value)
                      return chosen ? `${chosen.icon} ${chosen.name}` : 'Category'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ruleTypeHint} onValueChange={(v) => setRuleTypeHint(v as typeof ruleTypeHint)}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue>{(value: keyof typeof RULE_TYPE_HINT_LABELS) => RULE_TYPE_HINT_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={100}
                value={rulePriority}
                onChange={(e) => setRulePriority(Number(e.target.value))}
                placeholder="Priority"
                className="w-20 h-8 text-sm"
              />
              <Button
                size="sm"
                className="h-8 gap-1"
                disabled={!ruleKeyword.trim() || !ruleCategoryId}
                onClick={async () => {
                  await createRule({
                    keyword: ruleKeyword.trim(),
                    category_id: ruleCategoryId,
                    type_hint: ruleTypeHint === 'any' ? null : ruleTypeHint,
                    priority: rulePriority,
                  })
                  setRuleKeyword('')
                  setRuleCategoryId('')
                  setRuleTypeHint('any')
                  setRulePriority(1)
                }}
              >
                <Plus className="w-3 h-3" />Add Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
