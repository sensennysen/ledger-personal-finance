import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, X, Loader2, Tag } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useSubcategories } from '@/hooks/useSubcategories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { storePendingReceipt, PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'
import { buildReceiptObjectPath, isPendingReceiptReference, resolveReceiptUrl } from '@/lib/receiptUrls'
import { CURRENCIES } from '@/types'
import { DEFAULT_CURRENCY, UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  to_account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  subcategory_id: z.string().nullable(),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  exchange_rate: z.coerce.number().default(1),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().nullable(),
  date: z.string().min(1),
  transfer_fee: z.coerce.number().min(0).nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_interval: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).nullable(),
  recurrence_end_date: z.string().nullable(),
  receipt_url: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  goal_id: z.string().nullable().default(null),
}).superRefine((data, ctx) => {
  if (data.type === 'transfer' && !data.to_account_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Destination account is required for transfers',
      path: ['to_account_id'],
    })
  }
})

export type TransactionFormValues = z.infer<typeof transactionSchema>

interface TransactionFormProps {
  defaultValues?: Partial<TransactionFormValues>
  onSubmit: (values: TransactionFormValues) => Promise<void>
  onClose: () => void
  /** When set, the account selector is locked to this account id for non-transfer types */
  lockedAccountId?: string
}

export function TransactionForm({ defaultValues, onSubmit, onClose, lockedAccountId }: TransactionFormProps) {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const descriptionSuggestions = useDescriptionSuggestions()
  const { matchRule } = useTransactionRules()
  const { goals } = useSavingsGoals()
  const today = new Date().toISOString().split('T')[0]

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.receipt_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [autoCatCategoryId, setAutoCatCategoryId] = useState<string | null>(null)

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setUploadError('File too large. Maximum size is 5 MB.')
      return
    }
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadError(null)
  }

  const removeReceipt = () => {
    setPendingFile(null)
    setPreviewUrl(null)
    form.setValue('receipt_url', null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const form = useForm<TransactionFormValues, any, TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: 'expense',
      account_id: lockedAccountId ?? accounts[0]?.id ?? '',
      to_account_id: null,
      category_id: null,
      subcategory_id: null,
      amount: 0,
      currency:
        accounts.find((a) => a.id === lockedAccountId)?.currency ?? accounts[0]?.currency ?? DEFAULT_CURRENCY,
      exchange_rate: 1,
      description: '',
      notes: null,
      date: today,
      transfer_fee: null,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      receipt_url: null,
      tags: [],
      goal_id: null,
      ...defaultValues,
    },
  })

  const receiptReference = form.watch('receipt_url')
  const hasReceipt = !!pendingFile || !!receiptReference || !!previewUrl

  useEffect(() => {
    if (pendingFile) return

    let cancelled = false
    const reference = defaultValues?.receipt_url ?? null

    if (!reference || isPendingReceiptReference(reference)) {
      setPreviewUrl(null)
      return
    }

    resolveReceiptUrl(reference).then((url) => {
      if (!cancelled) setPreviewUrl(url)
    })

    return () => {
      cancelled = true
    }
  }, [defaultValues?.receipt_url, pendingFile])

  const handleSubmitWithUpload = async (values: TransactionFormValues) => {
    if (pendingFile && user) {
      if (!navigator.onLine) {
        // Definitely offline — store the file locally and let the sync queue upload it later
        try {
          const tempId = crypto.randomUUID()
          await storePendingReceipt(tempId, pendingFile)
          values.receipt_url = `${PENDING_RECEIPT_PREFIX}${tempId}`
        } catch {
          setUploadError('Could not save receipt locally. It will not be attached.')
        }
      } else {
        // Try to upload; if it fails for any reason (network hiccup, captive portal, etc.)
        // fall back to the same offline path so the transaction still saves with the image.
        setUploading(true)
        const path = buildReceiptObjectPath(user.id, pendingFile.name)
        const { error } = await supabase.storage
          .from('receipts')
          .upload(path, pendingFile)
        setUploading(false)
        if (error) {
          try {
            const tempId = crypto.randomUUID()
            await storePendingReceipt(tempId, pendingFile)
            values.receipt_url = `${PENDING_RECEIPT_PREFIX}${tempId}`
          } catch {
            setUploadError('Upload failed and receipt could not be saved locally.')
          }
        } else {
          values.receipt_url = path
        }
      }
    }
    await onSubmit(values)
  }

  const type = form.watch('type')
  const isRecurring = form.watch('is_recurring')
  const selectedAccount = form.watch('account_id')
  const selectedCategoryId = form.watch('category_id')
  const description = form.watch('description')
  const tags = form.watch('tags') ?? []

  const { subcategories } = useSubcategories(selectedCategoryId)

  // Auto-categorization rule matching
  useEffect(() => {
    if (!description) return
    const rule = matchRule(description)
    if (!rule?.category_id) return
    const currentCat = form.getValues('category_id')
    // Only auto-fill if category is empty or was last set by auto-cat
    if (!currentCat || currentCat === autoCatCategoryId) {
      form.setValue('category_id', rule.category_id)
      setAutoCatCategoryId(rule.category_id)
      if (rule.type_hint && form.getValues('type') !== rule.type_hint) {
        form.setValue('type', rule.type_hint)
      }
    }
  }, [description, matchRule, autoCatCategoryId, form])

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/,/g, '')
    if (!t || tags.includes(t)) { setTagInput(''); return }
    form.setValue('tags', [...tags, t])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    form.setValue('tags', tags.filter((t) => t !== tag))
  }

  const onAccountChange = (id: string | null) => {
    if (!id) return
    const acc = accounts.find((a) => a.id === id)
    if (acc) form.setValue('currency', acc.currency)
    form.setValue('account_id', id)
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitWithUpload)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Tabs
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  if (v !== 'transfer') form.setValue('to_account_id', null)
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="expense" className="flex-1">Expense</TabsTrigger>
                  <TabsTrigger value="income" className="flex-1">Income</TabsTrigger>
                  <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
                </TabsList>
              </Tabs>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => {
              const selectedAcc = accounts.find((a) => a.id === field.value)
              return (
                <FormItem>
                  <FormLabel>{type === 'transfer' ? 'From Account' : 'Account'}</FormLabel>
                  <Select
                    onValueChange={onAccountChange}
                    value={field.value}
                    disabled={!!lockedAccountId && type !== 'transfer'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account">
                          {selectedAcc ? selectedAcc.name : 'Select account'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          {type === 'transfer' ? (
            <FormField
              control={form.control}
              name="to_account_id"
              render={({ field }) => {
                const selectedToAcc = accounts.find((a) => a.id === field.value)
                return (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account">
                            {selectedToAcc ? selectedToAcc.name : 'Select account'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts
                          .filter((a) => a.id !== selectedAccount)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ) : (
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => {
                const selectedCat = categories.find((c) => c.id === field.value)
                const isAutoCat = !!autoCatCategoryId && field.value === autoCatCategoryId
                return (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Category
                      {isAutoCat && (
                        <span className="inline-flex items-center gap-0.5 text-[0.625rem] font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Tag className="w-2.5 h-2.5" />Auto
                          <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => { setAutoCatCategoryId(null); field.onChange(null) }}><X className="w-2 h-2" /></button>
                        </span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => {
                        setAutoCatCategoryId(null)
                        field.onChange(v === UNCATEGORIZED_VALUE ? null : v)
                        form.setValue('subcategory_id', null)
                      }}
                      value={field.value ?? UNCATEGORIZED_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category">
                            {selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : 'Uncategorized'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )
              }}
            />
          )}
        </div>

        {type !== 'transfer' && subcategories.length > 0 && (
          <FormField
            control={form.control}
            name="subcategory_id"
            render={({ field }) => {
              const selectedSub = subcategories.find((s) => s.id === field.value)
              return (
                <FormItem>
                  <FormLabel>Subcategory <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === UNCATEGORIZED_VALUE ? null : v)}
                    value={field.value ?? UNCATEGORIZED_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory">
                          {selectedSub ? selectedSub.name : 'None'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_VALUE}>None</SelectItem>
                      {subcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )
            }}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {type === 'transfer' && (
          <FormField
            control={form.control}
            name="transfer_fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer Fee (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => {
            const inputVal = field.value ?? ''
            const filtered = inputVal.length > 0
              ? descriptionSuggestions
                  .filter((s) => s.toLowerCase().includes(inputVal.toLowerCase()) && s.toLowerCase() !== inputVal.toLowerCase())
                  .slice(0, 8)
              : []
            return (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="e.g. Grocery run"
                      autoComplete="off"
                      {...field}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    />
                    {showSuggestions && filtered.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
                        {filtered.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors first:rounded-t-lg last:rounded-b-lg truncate"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              field.onChange(s)
                              setShowSuggestions(false)
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Tags</label>
          <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border bg-background px-2 py-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Tag className="w-2.5 h-2.5" />
                {tag}
                <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => removeTag(tag)}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              onBlur={addTag}
              placeholder={tags.length === 0 ? 'Add tags…  Enter or comma to confirm' : ''}
              className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Link to savings goal */}
        {type !== 'transfer' && goals.length > 0 && (
          <FormField
            control={form.control}
            name="goal_id"
            render={({ field }) => {
              const selectedGoal = goals.find((g) => g.id === field.value)
              return (
                <FormItem>
                  <FormLabel>Link to Savings Goal <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    value={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {selectedGoal ? `${selectedGoal.icon ?? '🎯'} ${selectedGoal.name}` : 'No goal'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No goal</SelectItem>
                      {goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.icon ?? '🎯'} {g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )
            }}
          />
        )}

        <FormField
          control={form.control}
          name="is_recurring"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel className="text-sm font-medium">Recurring transaction</FormLabel>
                <p className="text-xs text-muted-foreground">Repeat this transaction automatically</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {isRecurring && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="recurrence_interval"
              render={({ field }) => {
                const intervalLabels: Record<string, string> = {
                  daily: 'Daily',
                  weekly: 'Weekly',
                  biweekly: 'Bi-weekly',
                  monthly: 'Monthly',
                  quarterly: 'Quarterly',
                  yearly: 'Yearly',
                }
                return (
                  <FormItem>
                    <FormLabel>Interval</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === UNCATEGORIZED_VALUE ? null : v)}
                      value={field.value ?? UNCATEGORIZED_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval">
                            {field.value ? intervalLabels[field.value] : 'Select interval'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="recurrence_end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Receipt Attachment */}
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Receipt / Proof</p>
          <input
            id="receipt-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Attach receipt image"
            className="sr-only"
            onChange={handleFileChange}
          />
          {hasReceipt ? (
            <div className="relative w-full rounded-lg overflow-hidden border bg-muted">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full max-h-48 object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
                  <ImagePlus className="w-4 h-4 shrink-0" />
                  {receiptReference?.startsWith(PENDING_RECEIPT_PREFIX)
                    ? 'Receipt saved for sync.'
                    : 'Receipt attached.'}
                </div>
              )}
              <button
                type="button"
                onClick={removeReceipt}
                className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-background rounded-full p-1 shadow"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="receipt-file-input"
              className="flex items-center gap-2 w-full rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              Attach receipt image (JPEG, PNG, WebP — max 5 MB)
            </label>
          )}
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
            ) : form.formState.isSubmitting ? (
              'Saving...'
            ) : (
              'Save Transaction'
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
