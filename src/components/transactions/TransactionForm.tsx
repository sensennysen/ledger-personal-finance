import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
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
  const today = new Date().toISOString().split('T')[0]

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.receipt_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setUploadError('File too large. Maximum size is 5 MB.')
      return
    }
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
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
      ...defaultValues,
    },
  })

  const handleSubmitWithUpload = async (values: TransactionFormValues) => {
    if (pendingFile && user) {
      setUploading(true)
      const ext = pendingFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, pendingFile, { upsert: true })
      setUploading(false)
      if (error) {
        setUploadError('Failed to upload receipt. Please try again.')
        return
      }
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      values.receipt_url = data.publicUrl
    }
    await onSubmit(values)
  }

  const type = form.watch('type')
  const isRecurring = form.watch('is_recurring')
  const selectedAccount = form.watch('account_id')

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
                return (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === UNCATEGORIZED_VALUE ? null : v)}
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <>
                  <datalist id="description-suggestions">
                    {descriptionSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <Input placeholder="e.g. Grocery run" list="description-suggestions" {...field} />
                </>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interval</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === UNCATEGORIZED_VALUE ? null : v)}
                    value={field.value ?? UNCATEGORIZED_VALUE}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
              )}
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
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewUrl ? (
            <div className="relative w-full rounded-lg overflow-hidden border bg-muted">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full max-h-48 object-contain"
              />
              <button
                type="button"
                onClick={removeReceipt}
                className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-background rounded-full p-1 shadow"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              Attach receipt image (JPEG, PNG, WebP — max 5 MB)
            </button>
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
