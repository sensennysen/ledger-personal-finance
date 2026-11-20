import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Camera, ImagePlus, LoaderCircle, ScanLine, X } from 'lucide-react'
import { AccountCombobox } from '@/components/transactions/AccountCombobox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { usePreferences } from '@/hooks/usePreferences'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { isQuickLogExpenseAccount, type QuickLogResolution } from '@/lib/quickLog'
import { resolveQuickLogReceipt } from '@/lib/quickLogReceipt'
import { encodeCapturedReceipt, prepareCapturedReceipt, RECEIPT_CAPTURE_ACCEPT } from '@/lib/receiptCaptureImage'
import { CAPTURED_RECEIPTS_FOLDER } from '@/lib/receiptCleanup'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/utils'
import { CURRENCIES } from '@/types'
import type { QuickLogCandidate, QuickLogErrorCode } from '../../../supabase/functions/_shared/quickLog'

const receiptExtensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

interface ReceiptAttempt {
  draft: QuickLogResolution
  id: string
  uploadedPath?: string
}

export function ReceiptCaptureForm({ online, initialAccountId, onSave, onSaved }: {
  online: boolean
  initialAccountId?: string
  onSave: (draft: QuickLogResolution, label: string, id: string) => Promise<string | null>
  onSaved: (draft: QuickLogResolution) => void
}) {
  const { user } = useAuth()
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories()
  const { matchRule, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useTransactionRules(online)
  const { prefs } = usePreferences()
  const accountInputId = useId()
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const attempt = useRef<ReceiptAttempt | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId ?? null)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [status, setStatus] = useState<'preparing' | 'reading' | 'saving' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lookupError = accountsError ?? categoriesError ?? rulesError
  const availableAccounts = accounts.filter(isQuickLogExpenseAccount)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  const changePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || status) return
    attempt.current = null
    setPhoto(null)
    setError(null)
    setStatus('preparing')
    const controller = new AbortController()
    request.current = controller
    try {
      const image = await prepareCapturedReceipt(file)
      if (!controller.signal.aborted) setPhoto({ file: image, url: URL.createObjectURL(image) })
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The photo could not be prepared.')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setStatus(null)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!photo || !user || request.current || !online || !navigator.onLine || lookupError || accountsLoading || categoriesLoading || rulesLoading) return
    const controller = new AbortController()
    request.current = controller
    setError(null)
    try {
      if (!attempt.current) {
        setStatus('reading')
        const localDate = getLocalDateString()
        const receipt = await encodeCapturedReceipt(photo.file)
        if (controller.signal.aborted) return
        const response = await supabase.functions.invoke<QuickLogCandidate>('quick-log-extract', {
          body: { receipt, localDate, includeAccountContext: true }, signal: controller.signal,
        })
        if (controller.signal.aborted) return
        const failure = response.error instanceof FunctionsHttpError
          ? await response.error.context.json().catch(() => null) as { code?: QuickLogErrorCode } | null : null
        if (controller.signal.aborted) return
        if (response.error && failure?.code !== 'no_extraction') {
          const messages: Partial<Record<QuickLogErrorCode, string>> = {
            invalid_input: 'The receipt image could not be read. Choose a JPEG, PNG or WebP photo.',
            auth_required: 'Sign in again to capture a receipt.',
            rate_limited: 'Quick Log has reached its request limit. Try again in a minute.',
            timeout: 'Reading this receipt took too long. Try again.',
          }
          setError((failure?.code && messages[failure.code]) || 'Receipt capture is unavailable. Try again.')
          return
        }
        const draft: QuickLogResolution = response.data ? resolveQuickLogReceipt({
          candidate: response.data, today: localDate, accounts, selectedAccountId,
          expenseAccountId: prefs.quickLogAccountId, incomeAccountId: prefs.quickLogIncomeAccountId,
          currencies: CURRENCIES.map(({ code }) => code), categories, rule: matchRule(response.data.description ?? ''),
        }) : {
          ready: false, kind: null, reason: 'The receipt could not be read.',
          values: { account_id: selectedAccountId ?? '' }, destinationCurrency: null,
        }
        attempt.current = { draft, id: crypto.randomUUID() }
      }
      setStatus('saving')
      const save = attempt.current
      if (!save.uploadedPath) {
        const path = `${user.id}/${CAPTURED_RECEIPTS_FOLDER}/${save.id}.${receiptExtensions[photo.file.type]}`
        const { error: uploadError } = await supabase.storage.from('receipts').upload(path, photo.file, { upsert: true })
        if (uploadError) {
          if (!controller.signal.aborted) setError('Couldn’t attach the receipt photo. Try again.')
          return
        }
        save.uploadedPath = path
      }
      // The same ID and stored photo are reused if a save acknowledgement is lost.
      save.draft.values.receipt_url = save.uploadedPath
      const failure = await onSave(save.draft, save.draft.values.description || 'Captured receipt', save.id)
      if (controller.signal.aborted) return
      if (failure) setError(failure)
      else onSaved(save.draft)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The receipt could not be saved.')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setStatus(null)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Take receipt photo" tabIndex={-1}
        className="sr-only" onChange={(event) => void changePhoto(event)} />
      <input ref={library} type="file" accept={RECEIPT_CAPTURE_ACCEPT} aria-label="Choose receipt image" tabIndex={-1}
        className="sr-only" onChange={(event) => void changePhoto(event)} />
      <div className="overflow-hidden rounded-xl border bg-muted/40">
        {photo ? (
          <div className="relative">
            <img src={photo.url} alt="Receipt preview" className="h-40 w-full object-contain" />
            <Button type="button" size="icon-sm" variant="outline" aria-label="Remove receipt photo"
              className="absolute right-2 top-2 bg-background" disabled={status !== null}
              onClick={() => { attempt.current = null; setPhoto(null); setError(null) }}>
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-dashed px-3 py-3">
            <Button type="button" variant="secondary" className="min-h-11 flex-1 gap-2" disabled={status !== null} onClick={() => camera.current?.click()}>
              <Camera aria-hidden /> Take photo
            </Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1 gap-2" disabled={status !== null} onClick={() => library.current?.click()}>
              <ImagePlus aria-hidden /> Choose photo
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={accountInputId}>Account <span className="font-normal text-muted-foreground">(optional)</span></Label>
          {selectedAccountId && (
            <Button type="button" variant="ghost" size="sm" disabled={status !== null}
              onClick={() => { attempt.current = null; setSelectedAccountId(null); setError(null) }}>Clear</Button>
          )}
        </div>
        <AccountCombobox id={accountInputId} value={selectedAccountId} accounts={availableAccounts} placeholder="Match from receipt"
          onValueChange={(id) => { attempt.current = null; setSelectedAccountId(id); setError(null) }}
          disabled={status !== null || accountsLoading || !!accountsError} />
        <p className="text-xs text-muted-foreground">If Ledger can’t match an account, it tries your saved default and flags the entry for review.</p>
      </div>
      <p className="text-xs text-muted-foreground">Ledger sends the photo, active account names, types and currencies, and category and subcategory names to OpenAI to read the receipt. The photo is attached to the saved entry.</p>
      {!online && <p role="status" className="text-sm text-muted-foreground">Connect to the internet to read the receipt.</p>}
      {lookupError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
          {lookupError}
          <Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([refetchAccounts(), refetchCategories(), refetchRules()])}>Retry</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" className="min-h-11" disabled={!photo || !online || status !== null || accountsLoading || categoriesLoading || rulesLoading || !!lookupError}>
          {status ? <LoaderCircle className="animate-spin" aria-hidden /> : <ScanLine aria-hidden />}
          <span aria-live="polite">{status === 'preparing' ? 'Preparing…' : status === 'reading' ? 'Reading receipt…' : status === 'saving' ? 'Saving…' : 'Read and save receipt'}</span>
        </Button>
      </div>
    </form>
  )
}
