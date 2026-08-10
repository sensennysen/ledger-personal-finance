import { startTransition, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Tag, X } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import { useReceiptAttachment } from '@/hooks/useReceiptAttachment'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import { useSubcategories } from '@/hooks/useSubcategories'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import {
  transactionSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from '@/components/transactions/transactionFormSchema'
import { TransactionDescriptionField } from '@/components/transactions/TransactionDescriptionField'
import { TransactionTagsField } from '@/components/transactions/TransactionTagsField'
import { TransactionGoalField } from '@/components/transactions/TransactionGoalField'
import { TransactionRecurringFields } from '@/components/transactions/TransactionRecurringFields'
import { TransactionReceiptField } from '@/components/transactions/TransactionReceiptField'
import { DEFAULT_CURRENCY, UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { CURRENCIES } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { getLocalDateString } from '@/lib/utils'
import { getLoanAmountOwed } from '@/lib/loans'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export type { TransactionFormValues } from '@/components/transactions/transactionFormSchema'

interface TransactionFormProps {
  defaultValues?: Partial<TransactionFormInput>
  onSubmit: (values: TransactionFormValues) => Promise<void>
  onClose: () => void
  lockedAccountId?: string
}

export function TransactionForm({ defaultValues, onSubmit, onClose, lockedAccountId }: TransactionFormProps) {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { goals } = useSavingsGoals()
  const { matchRule } = useTransactionRules()
  const descriptionSuggestions = useDescriptionSuggestions()
  const today = getLocalDateString()

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [autoCatCategoryId, setAutoCatCategoryId] = useState<string | null>(null)
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      account_id: lockedAccountId ?? accounts[0]?.id ?? '',
      to_account_id: null,
      category_id: null,
      subcategory_id: null,
      amount: 0,
      currency:
        accounts.find((account) => account.id === lockedAccountId)?.currency ??
        accounts[0]?.currency ??
        DEFAULT_CURRENCY,
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

  const receiptReference = useWatch({ control: form.control, name: 'receipt_url' })
  const type = useWatch({ control: form.control, name: 'type' })
  const isRecurring = useWatch({ control: form.control, name: 'is_recurring' })
  const selectedAccount = useWatch({ control: form.control, name: 'account_id' })
  const selectedCategoryId = useWatch({ control: form.control, name: 'category_id' })
  const description = useWatch({ control: form.control, name: 'description' })
  const tags = useWatch({ control: form.control, name: 'tags' }) ?? []
  const notes = useWatch({ control: form.control, name: 'notes' })
  const goalId = useWatch({ control: form.control, name: 'goal_id' })
  const loanAccounts = accounts.filter((account) => account.type === 'loan')

  const { subcategories } = useSubcategories(selectedCategoryId)
  const filteredCategories = categories.filter((category) => category.type === type || category.type === 'both')

  const {
    fileInputRef,
    previewUrl,
    uploading,
    uploadError,
    hasReceipt,
    handleFileChange,
    clearReceipt,
    prepareReceiptForSubmit,
  } = useReceiptAttachment({
    initialReceiptUrl: defaultValues?.receipt_url,
    userId: user?.id,
  })

  useEffect(() => {
    if (!description) return

    const rule = matchRule(description)
    if (!rule?.category_id) return

    const currentCategoryId = form.getValues('category_id')
    if (!currentCategoryId || currentCategoryId === autoCatCategoryId) {
      form.setValue('category_id', rule.category_id)
      startTransition(() => {
        setAutoCatCategoryId(rule.category_id)
      })

      if (rule.type_hint && form.getValues('type') !== rule.type_hint) {
        form.setValue('type', rule.type_hint)
      }
    }
  }, [autoCatCategoryId, description, form, matchRule])

  const addTag = () => {
    const normalizedTag = tagInput.trim().toLowerCase().replace(/,/g, '')

    if (!normalizedTag || tags.includes(normalizedTag)) {
      setTagInput('')
      return
    }

    form.setValue('tags', [...tags, normalizedTag])
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    form.setValue('tags', tags.filter((currentTag) => currentTag !== tag))
  }

  const handleAccountChange = (accountId: string | null) => {
    if (!accountId) return

    const selectedAccountRecord = accounts.find((account) => account.id === accountId)
    if (selectedAccountRecord) {
      form.setValue('currency', selectedAccountRecord.currency)
      const repaymentLoan = accounts.find((account) => account.id === form.getValues('to_account_id'))
      if (repaymentLoan && repaymentLoan.currency !== selectedAccountRecord.currency) {
        form.setValue('to_account_id', null)
      }
    }

    form.setValue('account_id', accountId)
  }

  const handleSubmitWithUpload = async (values: TransactionFormValues) => {
    const repaymentLoan = loanAccounts.find((account) => account.id === values.to_account_id)
    if (repaymentLoan) {
      if (values.account_id === repaymentLoan.id) {
        form.setError('account_id', { message: 'Choose a different account to repay this loan' })
        return
      }
      if (values.amount > getLoanAmountOwed(repaymentLoan)) {
        form.setError('amount', { message: 'Payment cannot exceed the outstanding loan amount' })
        return
      }
    }
    const receipt_url = await prepareReceiptForSubmit(values.receipt_url)
    await onSubmit({ ...values, receipt_url })
  }

  const hasExtraDetails =
    Boolean(notes?.trim()) ||
    tags.length > 0 ||
    Boolean(goalId) ||
    isRecurring ||
    hasReceipt(receiptReference)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitWithUpload)} className="space-y-3 sm:space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Tabs
                value={field.value}
                onValueChange={(value) => {
                  if (value !== field.value) {
                    form.setValue('to_account_id', null)
                  }
                  field.onChange(value)
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => {
              const selectedAccountRecord = accounts.find((account) => account.id === field.value)

              return (
                <FormItem>
                  <FormLabel>{type === 'transfer' ? 'From Account' : 'Account'}</FormLabel>
                  <Select
                    onValueChange={handleAccountChange}
                    value={field.value}
                    disabled={Boolean(lockedAccountId) && type !== 'transfer'}
                    modal={false}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account">
                          {selectedAccountRecord ? selectedAccountRecord.name : 'Select account'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
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
                const selectedToAccount = accounts.find((account) => account.id === field.value)

                return (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''} modal={false}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account">
                            {selectedToAccount ? selectedToAccount.name : 'Select account'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        {accounts
                          .filter((account) => account.id !== selectedAccount)
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
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
                const selectedCategory = categories.find((category) => category.id === field.value)
                const isAutoCategory = Boolean(autoCatCategoryId) && field.value === autoCatCategoryId

                return (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Category
                      {isAutoCategory && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-primary/80">
                          <Tag className="h-2.5 w-2.5" />
                          Auto
                          <button
                            type="button"
                            className="ml-0.5 hover:text-destructive"
                            onClick={() => {
                              setAutoCatCategoryId(null)
                              field.onChange(null)
                            }}
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </span>
                      )}
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        setAutoCatCategoryId(null)
                        field.onChange(value === UNCATEGORIZED_VALUE ? null : value)
                        form.setValue('subcategory_id', null)
                      }}
                      value={field.value ?? UNCATEGORIZED_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category">
                            {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : 'Uncategorized'}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
                        {filteredCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.icon} {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          )}
        </div>

        {type === 'expense' && loanAccounts.length > 0 && (
          <FormField
            control={form.control}
            name="to_account_id"
            render={({ field }) => {
              const selectedLoan = loanAccounts.find((account) => account.id === field.value)
              return (
                <FormItem>
                  <FormLabel>
                    Repay Loan <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const loanId = value === UNCATEGORIZED_VALUE ? null : value
                      field.onChange(loanId)
                      const loan = loanAccounts.find((account) => account.id === loanId)
                      if (loan && !form.getValues('description').trim()) {
                        form.setValue('description', `Loan payment - ${loan.name}`)
                      }
                    }}
                    value={field.value ?? UNCATEGORIZED_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Not a loan repayment">
                          {selectedLoan ? selectedLoan.name : 'Not a loan repayment'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_VALUE}>Not a loan repayment</SelectItem>
                      {loanAccounts
                        .filter((loan) => {
                          const source = accounts.find((account) => account.id === selectedAccount)
                          return loan.id !== selectedAccount && (!source || loan.currency === source.currency)
                        })
                        .map((loan) => <SelectItem key={loan.id} value={loan.id}>{loan.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The payment reduces this expense account and the outstanding loan balance.
                  </p>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        )}

        {type !== 'transfer' && subcategories.length > 0 && (
          <FormField
            control={form.control}
            name="subcategory_id"
            render={({ field }) => {
              const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === field.value)

              return (
                <FormItem>
                  <FormLabel>
                    Subcategory <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === UNCATEGORIZED_VALUE ? null : value)}
                    value={field.value ?? UNCATEGORIZED_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory">
                          {selectedSubcategory ? selectedSubcategory.name : 'None'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_VALUE}>None</SelectItem>
                      {subcategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )
            }}
          />
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
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
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code}
                      </SelectItem>
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
                    value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? null : event.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10.5rem] sm:items-start sm:gap-4">
          <TransactionDescriptionField
            control={form.control}
            isOptional={type === 'transfer'}
            descriptionSuggestions={descriptionSuggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
            onClick={() => setShowMoreDetails((value) => !value)}
            aria-expanded={showMoreDetails}
          >
            <div>
              <p className="text-sm font-medium leading-none">More details</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Notes, tags, goals, recurring settings, and receipt
                {hasExtraDetails ? ' included' : ' optional'}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {showMoreDetails ? 'Hide' : hasExtraDetails ? 'Review' : 'Add'}
            </span>
          </button>

          {showMoreDetails && (
            <div className="space-y-3 border-t border-border/70 px-3 py-3 sm:space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        rows={2}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <TransactionTagsField
                tags={tags}
                tagInput={tagInput}
                setTagInput={setTagInput}
                addTag={addTag}
                removeTag={removeTag}
              />

              {type !== 'transfer' && goals.length > 0 && (
                <TransactionGoalField control={form.control} goals={goals} />
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

              {isRecurring && <TransactionRecurringFields control={form.control} />}

              <TransactionReceiptField
                fileInputRef={fileInputRef}
                previewUrl={previewUrl}
                uploadError={uploadError}
                receiptReference={receiptReference}
                hasReceipt={hasReceipt}
                handleFileChange={handleFileChange}
                clearReceipt={clearReceipt}
                onReceiptRemove={() => form.setValue('receipt_url', null)}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-popover/95 px-0 py-3 backdrop-blur supports-backdrop-filter:bg-popover/80 sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
              </>
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
