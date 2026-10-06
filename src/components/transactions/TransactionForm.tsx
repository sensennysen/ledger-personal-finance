import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  buildTransactionSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from '@/components/transactions/transactionFormSchema'
import { TransactionDescriptionField } from '@/components/transactions/TransactionDescriptionField'
import { AccountCombobox } from '@/components/transactions/AccountCombobox'
import { LoanPicker } from '@/components/transactions/LoanPicker'
import { RepaymentAssist } from '@/components/transactions/RepaymentAssist'
import { StatsBand } from '@/components/transactions/StatsBand'
import { TRANSACTION_KIND_LABELS, type TransactionKind } from '@/components/transactions/transactionKinds'
import { TransactionTagsField } from '@/components/transactions/TransactionTagsField'
import { TransactionGoalField } from '@/components/transactions/TransactionGoalField'
import { TransactionRecurringFields } from '@/components/transactions/TransactionRecurringFields'
import { TransactionReceiptField } from '@/components/transactions/TransactionReceiptField'
import { DEFAULT_CURRENCY, UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { ACCOUNT_TYPE_LABELS, CURRENCIES, type Account, type AccountType } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { readCache } from '@/lib/dataCache'
import { pickerGroupOrder, pickOfflineDefaultAccount } from '@/lib/accountDefault'
import { formatCurrency, getLocalDateString } from '@/lib/utils'
import { destinationAmountFor, needsAmountReceived } from '@/lib/transferCredit'
import { amountInCurrency, ratesAsOfLabel } from '@/lib/exchangeRates'
import { useOptionalExchangeRates } from '@/contexts/exchangeRatesState'
import { getLoanAmountOwed, loansOwed } from '@/lib/loans'
import { canChangeSavedKind, resolveEditTarget } from '@/lib/editTarget'
import { applyKindChange } from '@/lib/transactionKindChange'
import { hasLoanPickerStep, resolveInitialLoanId } from '@/lib/loanPicker'
import { exceedsOutstanding } from '@/lib/loanRepayment'
import {
  cardPaymentTransfer,
  defaultCardPaymentDescription,
  defaultPaymentSource,
  getCardDateInfo,
  getCardPaymentPresets,
  getCardPaymentSummary,
  isAutoCardPaymentDescription,
  resolveInitialCardId,
} from '@/lib/cardPayment'
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
  lockedCardAccountId?: string
  submitLabel?: string
  entryKind?: TransactionKind
  /** True when editing a saved transaction rather than creating one. */
  isEditing?: boolean
}

export function TransactionForm({
  defaultValues,
  onSubmit,
  onClose,
  lockedAccountId,
  lockedLoanAccountId,
  lockedCardAccountId,
  submitLabel = 'Save Transaction',
  entryKind,
  isEditing = false,
}: TransactionFormProps) {
  const { user, profile } = useAuth()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { goals } = useSavingsGoals()
  const { matchRule } = useTransactionRules()
  const rateTable = useOptionalExchangeRates()?.table ?? null
  const descriptionSuggestions = useDescriptionSuggestions()
  const today = getLocalDateString()

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [autoCatCategoryId, setAutoCatCategoryId] = useState<string | null>(null)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  // With 2+ loans the repayment form opens on the loan picker; a loan already supplied by the caller skips it.
  const [loanChosen, setLoanChosen] = useState(Boolean(defaultValues?.to_account_id))
  const [returnedToPicker, setReturnedToPicker] = useState(false)

  // An edited expense with a target is a payment against a liability; the target's type says which.
  // If the target is not in the loaded list (still loading, archived, filtered out) we do not
  // guess: the form falls back to a plain expense and keeps to_account_id untouched.
  const editTarget = resolveEditTarget(
    isEditing && defaultValues?.type === 'expense' ? defaultValues.to_account_id : null,
    accounts,
  )
  const isCardPayment = entryKind === 'card-payment' || Boolean(lockedCardAccountId) || editTarget === 'card'

  // Offline, the hook's own list fills a tick after the first render, so the form would open on
  // "Select account". Read the cached list once instead and open on the first account the picker
  // shows (LED-197). Online is untouched: the account stays for the user to choose.
  const [offlineDefault] = useState<Account | null>(() => {
    if (navigator.onLine || !user) return null
    return pickOfflineDefaultAccount(
      readCache<Account[]>(`${user.id}:accounts`),
      pickerGroupOrder(profile?.account_group_order, Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]),
    )
  })

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    // A card payment has no category (LED-146); every other kind keeps the full rules.
    // A transfer into an account in another currency must say what arrived (LED-185).
    resolver: (values, context, options) =>
      zodResolver(
        buildTransactionSchema({
          destinationNeedsCategory: !isCardPayment,
          accountCurrency: (id) => accounts.find((account) => account.id === id)?.currency,
        }),
      )(values, context, options),
    defaultValues: {
      type: entryKind && entryKind !== 'loan-repayment' && entryKind !== 'card-payment' ? entryKind : 'expense',
      account_id: lockedAccountId ?? offlineDefault?.id ?? accounts[0]?.id ?? '',
      to_account_id: lockedLoanAccountId ?? lockedCardAccountId ?? null,
      category_id: null,
      subcategory_id: null,
      amount: 0,
      currency:
        accounts.find((account) => account.id === lockedAccountId)?.currency ??
        offlineDefault?.currency ??
        accounts[0]?.currency ??
        DEFAULT_CURRENCY,
      exchange_rate: 1,
      destination_amount: null,
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

  // Change kind swaps entryKind while the dialog stays open (LED-111). The step
  // state below belongs to the old kind, so it resets during render; the values
  // keep what every kind shares and lose what no longer applies.
  const [seenEntryKind, setSeenEntryKind] = useState(entryKind)
  if (seenEntryKind !== entryKind) {
    setSeenEntryKind(entryKind)
    setLoanChosen(false)
    setReturnedToPicker(false)
    setAutoCatCategoryId(null)
  }
  const previousEntryKind = useRef(entryKind)
  useEffect(() => {
    if (previousEntryKind.current === entryKind) return
    previousEntryKind.current = entryKind
    if (!entryKind || isEditing) return
    form.reset(applyKindChange(form.getValues(), entryKind))
  }, [entryKind, form, isEditing])

  const receiptReference = useWatch({ control: form.control, name: 'receipt_url' })
  const type = useWatch({ control: form.control, name: 'type' })
  const isRecurring = useWatch({ control: form.control, name: 'is_recurring' })
  const selectedAccount = useWatch({ control: form.control, name: 'account_id' })
  const selectedLoanId = useWatch({ control: form.control, name: 'to_account_id' })
  const selectedCategoryId = useWatch({ control: form.control, name: 'category_id' })
  const description = useWatch({ control: form.control, name: 'description' })
  const tags = useWatch({ control: form.control, name: 'tags' }) ?? []
  const notes = useWatch({ control: form.control, name: 'notes' })
  const goalId = useWatch({ control: form.control, name: 'goal_id' })
  const amountValue = useWatch({ control: form.control, name: 'amount' })
  const currencyValue = useWatch({ control: form.control, name: 'currency' })
  const destinationValue = useWatch({ control: form.control, name: 'destination_amount' })
  // A transfer, card payment or loan repayment into an account in another currency carries the amount
  // that arrived (LED-185, LED-269).
  const toAccountCurrency = accounts.find((account) => account.id === selectedLoanId)?.currency
  const crossCurrency = needsAmountReceived({ type, currency: currencyValue, to_account_id: selectedLoanId }, toAccountCurrency)
  const suggestedDestination = useMemo(() => {
    if (!crossCurrency || !toAccountCurrency) return null
    const amount = Number(amountValue)
    if (!Number.isFinite(amount) || amount <= 0) return null
    const converted = amountInCurrency({ amount, currency: currencyValue, exchange_rate: null }, toAccountCurrency, rateTable)
    return converted === null ? null : Math.round(converted * 100) / 100
  }, [amountValue, crossCurrency, currencyValue, rateTable, toAccountCurrency])
  // The suggestion follows the amount until the user types their own figure; a saved one is theirs already.
  const [destinationTyped, setDestinationTyped] = useState(Boolean(defaultValues?.destination_amount))
  useEffect(() => {
    if (destinationTyped) return
    form.setValue('destination_amount', suggestedDestination)
  }, [destinationTyped, form, suggestedDestination])
  // A card or loan preset is in the target's currency: between two currencies it fills the amount
  // received, and the amount sent follows from the rate feed while it is still empty (LED-269).
  const setReceived = (value: number) => {
    setDestinationTyped(true)
    form.setValue('destination_amount', value, { shouldValidate: true })
    if (Number(form.getValues('amount')) > 0 || !toAccountCurrency) return
    const sent = amountInCurrency({ amount: value, currency: toAccountCurrency, exchange_rate: null }, currencyValue, rateTable)
    if (sent !== null) form.setValue('amount', Math.round(sent * 100) / 100, { shouldValidate: true })
  }
  const loanAccounts = useMemo(() => accounts.filter((account) => account.type === 'loan'), [accounts])
  // Only loans that still owe something are offered when picking a new repayment (LED-181 item, OD-8);
  // `loanAccounts` stays the full list so editing an old repayment against a now-repaid loan still resolves it.
  const loanAccountsOwed = useMemo(() => loansOwed(accounts), [accounts])
  const cardAccounts = useMemo(() => accounts.filter((account) => account.type === 'credit_card'), [accounts])
  const editTargetMissing = editTarget === 'missing'
  const canEditKind = isEditing && canChangeSavedKind(editTarget)
  const isLoanRepayment =
    !isCardPayment &&
    (entryKind === 'loan-repayment' || Boolean(lockedLoanAccountId) || editTarget === 'loan')
  const isLiabilityPayment = isLoanRepayment || isCardPayment
  const selectedLoan = loanAccounts.find((account) => account.id === selectedLoanId)
  const selectedCard = cardAccounts.find((account) => account.id === selectedLoanId)
  const paymentTarget = selectedLoan ?? selectedCard
  const paymentSourceAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.type !== 'loan' &&
          account.type !== 'credit_card' &&
          account.id !== selectedLoan?.id
      ),
    [accounts, selectedLoan?.id]
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

  const handleAccountChange = (accountId: string | null) => {
    if (!accountId) return

    const selectedAccountRecord = accounts.find((account) => account.id === accountId)
    if (selectedAccountRecord) {
      // A loan or card in another currency stays chosen; the form asks for the amount received (LED-269).
      form.setValue('currency', selectedAccountRecord.currency)
    }

    form.setValue('account_id', accountId)
  }

  // Pay from: the current account when it is in the target's currency, else defaultPaymentSource, which
  // falls back to another currency when none matches (LED-269). The amount is in the source's currency.
  const setPaymentSource = useCallback((target: Account) => {
    const current = accounts.find((account) => account.id === form.getValues('account_id'))
    const keep =
      current && current.type !== 'loan' && current.type !== 'credit_card' && current.currency === target.currency
    const sourceId = keep ? current.id : (defaultPaymentSource(accounts, target) ?? '')
    form.setValue('account_id', sourceId)
    form.setValue('currency', accounts.find((account) => account.id === sourceId)?.currency ?? target.currency)
  }, [accounts, form])

  const handleLoanChange = useCallback((loanId: string) => {
    const loan = loanAccounts.find((account) => account.id === loanId)
    if (!loan) return

    const currentDescription = form.getValues('description').trim()
    form.setValue('type', 'expense')
    form.setValue('to_account_id', loan.id)
    setPaymentSource(loan)
    if (!currentDescription || currentDescription.startsWith('Loan payment - ')) {
      form.setValue('description', `Loan payment - ${loan.name}`)
    }
    form.clearErrors(['account_id', 'to_account_id', 'amount'])
  }, [form, loanAccounts, setPaymentSource])

  const handleCardChange = useCallback((cardId: string) => {
    const card = cardAccounts.find((account) => account.id === cardId)
    if (!card) return

    const currentDescription = form.getValues('description').trim()
    const previousCard = cardAccounts.find((account) => account.id === form.getValues('to_account_id'))
    form.setValue('type', 'expense')
    form.setValue('to_account_id', card.id)
    setPaymentSource(card)
    if (isAutoCardPaymentDescription(currentDescription, previousCard?.name)) {
      form.setValue('description', defaultCardPaymentDescription(card.name))
    }
    form.clearErrors(['account_id', 'to_account_id', 'amount'])
  }, [cardAccounts, form, setPaymentSource])

  useEffect(() => {
    if (!isCardPayment || selectedLoanId) return
    // Only a locked card or the one card that owes is picked; with two or more owing the user chooses (LED-113).
    const initialCardId = resolveInitialCardId(cardAccounts, lockedCardAccountId)
    if (initialCardId) handleCardChange(initialCardId)
  }, [cardAccounts, handleCardChange, isCardPayment, lockedCardAccountId, selectedLoanId])

  // A locked card or loan already has its target, so the effects above never run for it; Pay from and
  // the description still need filling, or the submit fails with "Account is required" (LED-146).
  useEffect(() => {
    if (!isLiabilityPayment || isEditing || !paymentTarget) return
    if (!form.getValues('description').trim()) {
      form.setValue(
        'description',
        selectedCard ? defaultCardPaymentDescription(selectedCard.name) : `Loan payment - ${paymentTarget.name}`,
      )
    }
    if (paymentSourceAccounts.some((account) => account.id === selectedAccount)) return
    const source = defaultPaymentSource(accounts, paymentTarget) ?? ''
    if (source === selectedAccount) return
    form.setValue('account_id', source)
    form.setValue('currency', accounts.find((account) => account.id === source)?.currency ?? paymentTarget.currency)
    form.clearErrors('account_id')
  }, [accounts, form, isEditing, isLiabilityPayment, paymentSourceAccounts, paymentTarget, selectedAccount, selectedCard])

  useEffect(() => {
    if (!isLoanRepayment || selectedLoanId) return
    const initialLoanId = resolveInitialLoanId(loanAccounts, lockedLoanAccountId, editTarget)
    if (initialLoanId) handleLoanChange(initialLoanId)
  }, [editTarget, handleLoanChange, isLoanRepayment, loanAccounts, lockedLoanAccountId, selectedLoanId])

  const hasPickerStep =
    isLoanRepayment &&
    hasLoanPickerStep({ loanCount: loanAccountsOwed.length, lockedLoanAccountId, isEditing })

  const handleSubmitWithUpload = async (values: TransactionFormValues) => {
    const repaymentLoan = loanAccounts.find((account) => account.id === values.to_account_id)
    if (isLoanRepayment && !repaymentLoan) {
      form.setError('to_account_id', { message: 'Choose the loan you are repaying' })
      return
    }
    if (isCardPayment && !cardAccounts.some((account) => account.id === values.to_account_id)) {
      form.setError('to_account_id', { message: 'Choose the card you are paying' })
      return
    }
    if (repaymentLoan) {
      if (values.account_id === repaymentLoan.id) {
        form.setError('account_id', { message: 'Choose a different account to repay this loan' })
        return
      }
      // What the loan receives: the amount received when it holds another currency (LED-269).
      const received = destinationAmountFor(values, repaymentLoan.currency) ?? values.amount
      if (exceedsOutstanding(received, getLoanAmountOwed(repaymentLoan))) {
        form.setError('amount', { message: 'Payment cannot exceed the outstanding loan amount' })
        return
      }
    }
    const receipt_url = await prepareReceiptForSubmit(values.receipt_url)
    // A new card payment is saved as a transfer into the card; see cardPaymentTransfer.
    const submitted = {
      ...values,
      receipt_url,
      destination_amount: destinationAmountFor(
        values,
        accounts.find((account) => account.id === values.to_account_id)?.currency,
      ),
    }
    await onSubmit(isCardPayment && !isEditing ? cardPaymentTransfer(submitted) : submitted)
  }

  const cardSummary =
    isCardPayment && selectedCard && !isEditing
      ? getCardPaymentSummary(selectedCard.balance, selectedCard.credit_limit, Number(crossCurrency ? destinationValue : amountValue))
      : null
  const cardPresets = cardSummary && selectedCard ? getCardPaymentPresets(selectedCard) : null
  const cardStatementDate = getCardDateInfo(selectedCard?.statement_day)
  const cardDueDate = getCardDateInfo(selectedCard?.due_day)
  const cardCurrency = selectedCard?.currency ?? DEFAULT_CURRENCY
  const setCardAmount = (value: number) =>
    crossCurrency ? setReceived(value) : form.setValue('amount', value, { shouldValidate: true })

  const hasExtraDetails =
    Boolean(notes?.trim()) ||
    tags.length > 0 ||
    Boolean(goalId) ||
    isRecurring ||
    hasReceipt(receiptReference)
  const effectiveSubmitLabel = isLiabilityPayment && submitLabel === 'Save Transaction' ? 'Record Payment' : submitLabel

  // Amount, currency and the card presets. A card payment reads them right after the band (12a);
  // every other kind keeps them below account and category.
  const amountFields = (
    <>
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
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                // A new entry starts at 0, which no save accepts (amount > 0). Show it empty, so typing
                // 12.50 reads 12.50 rather than 012.50.
                value={field.value === 0 ? '' : typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
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
            <Select modal={false} onValueChange={field.onChange} value={field.value} disabled={isLiabilityPayment}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent alignItemWithTrigger={false} align="start">
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

    {crossCurrency && toAccountCurrency && (
      <FormField
        control={form.control}
        name="destination_amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount received ({toAccountCurrency})</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                onChange={(event) => {
                  setDestinationTyped(true)
                  field.onChange(event.target.value === '' ? null : event.target.value)
                }}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              {destinationTyped
                ? `What arrived in the ${toAccountCurrency} account.`
                : suggestedDestination !== null
                  ? `Filled in from the exchange-rate feed${ratesAsOfLabel(rateTable) ? `, as of ${ratesAsOfLabel(rateTable)}` : ''}. Change it to what the account received.`
                  : `No exchange rate for ${currencyValue} to ${toAccountCurrency}. Enter what the account received.`}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    )}

    {cardSummary && cardPresets && (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cardPresets.full <= 0}
            onClick={() => setCardAmount(cardPresets.full)}
          >
            <span className="hidden sm:max-lg:inline">Full</span>
            <span className="sm:max-lg:hidden">Full balance</span>
          </Button>
          {cardPresets.statement != null && cardPresets.statement > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setCardAmount(cardPresets.statement ?? 0)}>
              Statement balance
            </Button>
          )}
          <span className="text-xs text-muted-foreground">or type a custom amount</span>
        </div>
        {selectedCard?.credit_limit ? (
          <p className="text-xs text-muted-foreground">
            Utilisation{' '}
            <span className="sm:hidden">
              {cardSummary.utilisationBefore.toFixed(0)}% → {cardSummary.utilisationAfter.toFixed(0)}%
            </span>
            <span className="hidden sm:inline">
              {cardSummary.utilisationBefore.toFixed(1)}% → {cardSummary.utilisationAfter.toFixed(1)}%
            </span>
          </p>
        ) : null}
        {cardSummary.overpayment > 0 && (
          <div
            role="status"
            className="rounded-lg border border-warning/40 bg-warning-container p-3 text-xs leading-snug"
          >
            This is {formatCurrency(cardSummary.overpayment, cardCurrency)} more than the card owes. The extra
            becomes a statement credit and the card&apos;s balance goes positive, which is allowed but shows as an
            asset on the Accounts page.{' '}
            {cardSummary.owed > 0 && (
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => setCardAmount(cardSummary.owed)}
              >
                Pay {formatCurrency(cardSummary.owed, cardCurrency)} instead
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Ledger tracks one running balance per card, not a statement balance. Full balance clears everything owed
          today, including purchases made after the statement closed.
        </p>
      </div>
    )}
    </>
  )

  if (hasPickerStep && !loanChosen) {
    return (
      <div className="space-y-4">
        <LoanPicker
          loans={loanAccountsOwed}
          selectedLoanId={selectedLoanId}
          restoreFocus={returnedToPicker}
          onChoose={(loanId) => {
            handleLoanChange(loanId)
            setLoanChosen(true)
          }}
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitWithUpload)} className="space-y-3 sm:space-y-4">
        {canEditKind && (
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kind</FormLabel>
                <Select
                  modal={false}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value === field.value) return
                    // Keep the shared fields and clear those the new kind does not use, so the
                    // schema never rejects something the user cannot see.
                    form.reset(applyKindChange(form.getValues(), value as TransactionKind))
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>{TRANSACTION_KIND_LABELS[field.value]}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false} align="start">
                    {(['expense', 'income', 'transfer'] as const).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {TRANSACTION_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}

        {editTargetMissing && (
          <p className="text-xs text-muted-foreground" role="status">
            The account this payment went to is not available, so it is shown as a plain expense. Its target is kept when you save.
          </p>
        )}

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

        {isLoanRepayment && selectedLoan && !isEditing && (
          <RepaymentAssist
            key={selectedLoan.id}
            loan={selectedLoan}
            form={form}
            received={crossCurrency ? { name: 'destination_amount', set: setReceived } : undefined}
          />
        )}

        {isCardPayment && (
          <FormField
            control={form.control}
            name="to_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Card to pay</FormLabel>
                <FormControl>
                  <AccountCombobox
                    accounts={cardAccounts}
                    value={field.value}
                    onValueChange={handleCardChange}
                    placeholder="Choose a card"
                    searchPlaceholder="Search cards…"
                    emptyMessage="No credit cards found."
                    disabled={Boolean(lockedCardAccountId)}
                  />
                </FormControl>
                {selectedCard && (cardStatementDate || cardDueDate) && (
                  <p className="text-xs text-muted-foreground">
                    {cardStatementDate ? `Statement closes ${cardStatementDate.label}` : ''}
                    {cardStatementDate && cardDueDate ? ' · ' : ''}
                    {cardDueDate ? `payment due ${cardDueDate.label}` : ''}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {cardSummary && (
          <>
            {/* Phone (12a): two cells, the balance and the due date. */}
            <div className="sm:hidden">
              <StatsBand
                items={[
                  { label: 'Owed now', value: formatCurrency(cardSummary.owed, cardCurrency) },
                  cardDueDate
                    ? { label: `Due ${cardDueDate.label}`, value: `in ${cardDueDate.daysUntil}d` }
                    : {
                        label: 'Available',
                        value: cardSummary.available == null ? '—' : formatCurrency(cardSummary.available, cardCurrency),
                      },
                ]}
              />
            </div>
            <div className="hidden sm:block">
              <StatsBand
                items={[
                  { label: 'Current balance', value: formatCurrency(cardSummary.owed, cardCurrency) },
                  {
                    label: 'Available credit',
                    shortLabel: 'Available',
                    value: cardSummary.available == null ? '—' : formatCurrency(cardSummary.available, cardCurrency),
                    note:
                      selectedCard?.credit_limit
                        ? <span className="max-lg:hidden">of {formatCurrency(selectedCard.credit_limit, cardCurrency)} limit</span>
                        : undefined,
                  },
                  {
                    label: 'After this payment',
                    shortLabel: 'After payment',
                    value:
                      cardSummary.afterBalance > 0
                        ? `+${formatCurrency(cardSummary.afterBalance, cardCurrency)}`
                        : formatCurrency(Math.abs(cardSummary.afterBalance), cardCurrency),
                    note:
                      cardSummary.afterBalance > 0
                        ? 'statement credit'
                        : cardSummary.afterBalance === 0
                          ? 'paid in full'
                          : undefined,
                  },
                ]}
              />
            </div>
          </>
        )}

        {isCardPayment && amountFields}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>{type === 'transfer' ? 'From account' : isLiabilityPayment ? 'Pay from' : 'Account'}</FormLabel>
                  <FormControl>
                    <AccountCombobox
                      accounts={isLiabilityPayment ? paymentSourceAccounts : accounts}
                      value={field.value}
                      onValueChange={handleAccountChange}
                      placeholder={isLiabilityPayment ? 'Choose payment account' : 'Select account'}
                      searchPlaceholder="Search accounts…"
                      emptyMessage={isLiabilityPayment ? 'No compatible accounts found.' : 'No accounts found.'}
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

                return (
                  <FormItem>
                    <FormLabel>To account</FormLabel>
                    <FormControl>
                      <AccountCombobox
                        accounts={accounts.filter((account) => account.id !== selectedAccount)}
                        value={selectedToAccount?.id ?? field.value}
                        onValueChange={field.onChange}
                        placeholder="Select account"
                        searchPlaceholder="Search destination accounts…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ) : isCardPayment ? (
            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">Category</p>
              <div className="flex w-full items-center gap-2 rounded-xl border border-input bg-muted/40 py-2 pr-2 pl-2.5 text-sm">
                <span aria-hidden="true">💳</span>
                <span className="font-medium">Card payments</span>
              </div>
              <p className="text-xs text-muted-foreground">Excluded from spending reports</p>
            </div>
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

        {!isCardPayment && amountFields}

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
          {hasPickerStep && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setReturnedToPicker(true)
                setLoanChosen(false)
              }}
            >
              Back
            </Button>
          )}
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
