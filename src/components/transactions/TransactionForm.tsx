import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
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
import { useExchangeRates } from '@/hooks/useExchangeRates'
import {
  transactionSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from '@/components/transactions/transactionFormSchema'
import { TransactionDescriptionField } from '@/components/transactions/TransactionDescriptionField'
import { AccountCombobox } from '@/components/transactions/AccountCombobox'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import { TransactionTagsField } from '@/components/transactions/TransactionTagsField'
import { TransactionGoalField } from '@/components/transactions/TransactionGoalField'
import { TransactionRecurringFields } from '@/components/transactions/TransactionRecurringFields'
import { TransactionReceiptField } from '@/components/transactions/TransactionReceiptField'
import { DEFAULT_CURRENCY, UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { CURRENCIES } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, getLocalDateString } from '@/lib/utils'
import { convertAmount } from '@/lib/currency'
import { getLoanAmountOwed } from '@/lib/loans'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export type { TransactionFormValues } from '@/components/transactions/transactionFormSchema'

interface TransactionFormProps {
  defaultValues?: Partial<TransactionFormInput>
  onSubmit: (values: TransactionFormValues) => Promise<void>
  onClose: () => void
  lockedAccountId?: string
  lockedLoanAccountId?: string
  submitLabel?: string
  entryKind?: TransactionKind
}

export function TransactionForm({
  defaultValues,
  onSubmit,
  onClose,
  lockedAccountId,
  lockedLoanAccountId,
  submitLabel = 'Save Transaction',
  entryKind,
}: TransactionFormProps) {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { goals } = useSavingsGoals()
  const { matchRule } = useTransactionRules()
  const { rates } = useExchangeRates()
  const descriptionSuggestions = useDescriptionSuggestions()
  const today = getLocalDateString()

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [autoCatCategoryId, setAutoCatCategoryId] = useState<string | null>(null)
  const [showMoreDetails, setShowMoreDetails] = useState(false)

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: entryKind && entryKind !== 'loan-repayment' ? entryKind : 'expense',
      account_id: lockedAccountId ?? accounts[0]?.id ?? '',
      to_account_id: lockedLoanAccountId ?? null,
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
  const selectedLoanId = useWatch({ control: form.control, name: 'to_account_id' })
  const selectedCategoryId = useWatch({ control: form.control, name: 'category_id' })
  const currencyValue = useWatch({ control: form.control, name: 'currency' })
  const amountValue = useWatch({ control: form.control, name: 'amount' })
  const exchangeRateValue = useWatch({ control: form.control, name: 'exchange_rate' })
  const description = useWatch({ control: form.control, name: 'description' })
  const tags = useWatch({ control: form.control, name: 'tags' }) ?? []
  const notes = useWatch({ control: form.control, name: 'notes' })
  const goalId = useWatch({ control: form.control, name: 'goal_id' })
  const loanAccounts = useMemo(() => accounts.filter((account) => account.type === 'loan'), [accounts])
  const isLoanRepayment =
    entryKind === 'loan-repayment' ||
    Boolean(lockedLoanAccountId) ||
    (defaultValues?.type === 'expense' && Boolean(defaultValues.to_account_id))
  const selectedLoan = loanAccounts.find((account) => account.id === selectedLoanId)
  const paymentSourceAccounts = accounts.filter(
    (account) =>
      account.type !== 'loan' &&
      account.type !== 'credit_card' &&
      account.id !== selectedLoan?.id &&
      (!selectedLoan || account.currency === selectedLoan.currency)
  )

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

  // Keep `exchange_rate` in step with a cross-currency transfer. The DB trigger
  // credits the destination `amount * exchange_rate`, where `amount` is in the
  // source currency — so the rate is "destination currency per 1 source unit".
  // Same-currency transfers (and non-transfers) stay at 1.
  const applyTransferRate = useCallback(
    (sourceCurrency: string, toAccountId: string | null) => {
      const setRate = (rate: number) => {
        if (form.getValues('exchange_rate') !== rate) form.setValue('exchange_rate', rate)
      }
      if (form.getValues('type') !== 'transfer') return setRate(1)
      const destCurrency = accounts.find((account) => account.id === toAccountId)?.currency
      if (!destCurrency || destCurrency === sourceCurrency) return setRate(1)
      const rate = convertAmount(1, sourceCurrency, destCurrency, rates)
      setRate(rate != null ? Math.round(rate * 1e6) / 1e6 : 1)
    },
    [accounts, form, rates],
  )

  const handleAccountChange = (accountId: string | null) => {
    if (!accountId) return

    const selectedAccountRecord = accounts.find((account) => account.id === accountId)
    if (selectedAccountRecord) {
      form.setValue('currency', selectedAccountRecord.currency)
      const repaymentLoan = accounts.find((account) => account.id === form.getValues('to_account_id'))
      if (repaymentLoan && repaymentLoan.currency !== selectedAccountRecord.currency) {
        form.setValue('to_account_id', null)
      }
      applyTransferRate(selectedAccountRecord.currency, form.getValues('to_account_id'))
    }

    form.setValue('account_id', accountId)
  }

  const handleLoanChange = useCallback((loanId: string) => {
    const loan = loanAccounts.find((account) => account.id === loanId)
    if (!loan) return

    const currentDescription = form.getValues('description').trim()
    const currentAccountId = form.getValues('account_id')
    const compatibleSources = accounts.filter(
      (account) =>
        account.type !== 'loan' &&
        account.type !== 'credit_card' &&
        account.id !== loan.id &&
        account.currency === loan.currency
    )

    form.setValue('type', 'expense')
    form.setValue('to_account_id', loan.id)
    form.setValue('currency', loan.currency)
    if (!compatibleSources.some((account) => account.id === currentAccountId)) {
      form.setValue('account_id', compatibleSources[0]?.id ?? '')
    }
    if (!currentDescription || currentDescription.startsWith('Loan payment - ')) {
      form.setValue('description', `Loan payment - ${loan.name}`)
    }
    form.clearErrors(['account_id', 'to_account_id', 'amount'])
  }, [accounts, form, loanAccounts])

  useEffect(() => {
    if (!isLoanRepayment || selectedLoanId || loanAccounts.length === 0) return
    handleLoanChange(loanAccounts[0].id)
  }, [handleLoanChange, isLoanRepayment, loanAccounts, selectedLoanId])

  // Re-sync the transfer rate when the type flips, or once live rates arrive.
  // Only touches the field while it's still at the default 1 so it never
  // overwrites a rate already resolved for this transfer.
  useEffect(() => {
    if (type !== 'transfer') {
      applyTransferRate(currencyValue ?? '', selectedLoanId)
    } else if (exchangeRateValue === 1) {
      applyTransferRate(currencyValue ?? '', selectedLoanId)
    }
  }, [type, rates, currencyValue, selectedLoanId, exchangeRateValue, applyTransferRate])

  const handleSubmitWithUpload = async (values: TransactionFormValues) => {
    const repaymentLoan = loanAccounts.find((account) => account.id === values.to_account_id)
    if (isLoanRepayment && !repaymentLoan) {
      form.setError('to_account_id', { message: 'Choose the loan you are repaying' })
      return
    }
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

  const amountTone =
    isLoanRepayment || type === 'expense'
      ? 'var(--expense)'
      : type === 'income'
        ? 'var(--income)'
        : 'var(--transfer)'

  const hasExtraDetails =
    Boolean(notes?.trim()) ||
    tags.length > 0 ||
    Boolean(goalId) ||
    isRecurring ||
    hasReceipt(receiptReference)
  const effectiveSubmitLabel = isLoanRepayment && submitLabel === 'Save Transaction' ? 'Record Payment' : submitLabel

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitWithUpload)} className="space-y-3 sm:space-y-4">
        {isLoanRepayment && (
          <FormField
            control={form.control}
            name="to_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loan to repay</FormLabel>
                <FormControl>
                  <AccountCombobox
                    accounts={loanAccounts}
                    value={field.value}
                    onValueChange={handleLoanChange}
                    placeholder="Choose a loan"
                    searchPlaceholder="Search loans…"
                    emptyMessage="No loan accounts found."
                    disabled={Boolean(lockedLoanAccountId)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Amount-first block */}
        <div className="flex items-center justify-between gap-3 rounded-[18px] border-[1.5px] border-input p-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1 space-y-0">
                <FormLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Amount
                </FormLabel>
                <FormControl>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="money text-[15px] text-muted-foreground">
                      $
                    </span>
                    <input
                      inputMode="decimal"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                      value={
                        typeof field.value === 'number' ||
                        typeof field.value === 'string'
                          ? field.value
                          : ''
                      }
                      onChange={(event) => field.onChange(event.target.value)}
                      className="money w-full min-w-0 bg-transparent text-[36px] font-bold leading-none outline-none placeholder:text-muted-foreground/40"
                      style={{ color: amountTone }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem className="shrink-0 space-y-0">
                <Select
                  modal={false}
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isLoanRepayment}
                >
                  <FormControl>
                    <SelectTrigger className="h-9 w-auto gap-1.5 rounded-full border-transparent bg-surface-container px-3.5 text-[13px] font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false} align="end">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{type === 'transfer' ? 'From account' : isLoanRepayment ? 'Pay from' : 'Account'}</FormLabel>
                  <FormControl>
                    <AccountCombobox
                      accounts={isLoanRepayment ? paymentSourceAccounts : accounts}
                      value={field.value}
                      onValueChange={handleAccountChange}
                      placeholder={isLoanRepayment ? 'Choose payment account' : 'Select account'}
                      searchPlaceholder="Search accounts…"
                      emptyMessage={isLoanRepayment ? 'No compatible accounts found.' : 'No accounts found.'}
                      disabled={Boolean(lockedAccountId) && type !== 'transfer'}
                    />
                  </FormControl>
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
                const destCurrency = selectedToAccount?.currency
                const crossCurrency = Boolean(destCurrency) && destCurrency !== currencyValue
                const rate = Number(exchangeRateValue) || 1
                const amountNum = Number(amountValue) || 0
                const rateKnown = crossCurrency && rate !== 1

                return (
                  <FormItem>
                    <FormLabel>To account</FormLabel>
                    <FormControl>
                      <AccountCombobox
                        accounts={accounts.filter((account) => account.id !== selectedAccount)}
                        value={selectedToAccount?.id ?? field.value}
                        onValueChange={(value) => {
                          field.onChange(value)
                          applyTransferRate(form.getValues('currency'), value)
                        }}
                        placeholder="Select account"
                        searchPlaceholder="Search destination accounts…"
                      />
                    </FormControl>
                    {crossCurrency && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {rateKnown ? (
                          <>
                            Rate 1 {currencyValue} = {rate} {destCurrency}
                            {amountNum > 0 && (
                              <> · destination receives{' '}
                                {formatCurrency(amountNum * rate, destCurrency ?? currencyValue)}</>
                            )}
                          </>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-500">
                            No {currencyValue}→{destCurrency} rate — recorded 1:1. Add one in
                            Settings → Exchange Rates.
                          </span>
                        )}
                      </p>
                    )}
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
                      modal={false}
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
                      <SelectContent alignItemWithTrigger={false} align="start">
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
                    modal={false}
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
                    <SelectContent alignItemWithTrigger={false} align="start">
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

        <div className="overflow-hidden rounded-[14px] border border-outline-variant bg-surface-container">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
            onClick={() => setShowMoreDetails((value) => !value)}
            aria-expanded={showMoreDetails}
          >
            <div>
              <p className="text-[13px] font-semibold leading-none text-foreground">
                More details
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Notes, tags, goals, recurring settings, and receipt
                {hasExtraDetails ? ' included' : ' optional'}
              </p>
            </div>
            <span className="text-[12px] font-semibold text-primary">
              {showMoreDetails ? 'Hide' : hasExtraDetails ? 'Review' : 'Add'}
            </span>
          </button>

          {showMoreDetails && (
            <div className="space-y-3 border-t border-outline-variant bg-card px-3.5 py-3.5 sm:space-y-4">
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

        <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-2 bg-elevated px-5 pb-1 pt-2 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
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
              effectiveSubmitLabel
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
