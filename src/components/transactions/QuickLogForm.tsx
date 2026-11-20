import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/contexts/AuthContext'
import { useCategories } from '@/hooks/useCategories'
import { usePreferences } from '@/hooks/usePreferences'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { resolveQuickLog, type QuickLogResolution } from '@/lib/quickLog'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/utils'
import { CURRENCIES } from '@/types'
import {
  QUICK_LOG_PHRASE_LIMIT, type QuickLogCandidate, type QuickLogErrorCode,
} from '../../../supabase/functions/_shared/quickLog'

const errorMessages: Record<QuickLogErrorCode, string> = {
  invalid_input: 'Enter a short phrase with a transaction amount.',
  auth_required: 'Sign in again to use Quick Log.',
  rate_limited: 'Quick Log has reached its request limit. Try again in a minute.',
  unavailable: 'Quick Log is currently unavailable. Try again or enter the transaction manually.',
  timeout: 'Quick Log took too long. Try again or enter the transaction manually.',
  no_extraction: 'Quick Log could not read this entry.',
}

async function extractionErrorCode(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) return undefined
  const body = await (error.context as Response).json().catch(() => null) as { code?: QuickLogErrorCode } | null
  return body?.code
}

export function QuickLogForm({
  online, onManual, onSave, onSaved,
}: {
  online: boolean
  onManual: (phrase: string) => void
  onSave: (draft: QuickLogResolution, phrase: string, id: string) => Promise<string | null>
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories()
  const { matchRule, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useTransactionRules(online)
  const { prefs } = usePreferences()
  const [phrase, setPhrase] = useState('')
  const [status, setStatus] = useState<'reading' | 'saving' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const saveAttempt = useRef<{ draft: QuickLogResolution; id: string } | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const lookupError = accountsError ?? categoriesError ?? rulesError
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (request.current || !phrase.trim() || !online || !navigator.onLine) return
    const controller = new AbortController()
    request.current = controller
    setFailure(null)
    try {
      if (!saveAttempt.current) {
        setStatus('reading')
        const localDate = getLocalDateString()
        const { data, error } = await supabase.functions.invoke<QuickLogCandidate>('quick-log-extract', {
          body: { phrase: phrase.trim(), localDate, includeAccountContext: true }, signal: controller.signal,
        })
        if (controller.signal.aborted) return
        const code = error ? await extractionErrorCode(error) : undefined
        if (controller.signal.aborted) return
        if (error && code !== 'no_extraction') {
          setFailure(code ? errorMessages[code] ?? errorMessages.unavailable : errorMessages.unavailable)
          return
        }
        const draft: QuickLogResolution = data ? resolveQuickLog({
          phrase, candidate: data, today: localDate, accounts,
          expenseAccountId: prefs.quickLogAccountId, incomeAccountId: prefs.quickLogIncomeAccountId,
          currencies: CURRENCIES.map(({ code }) => code), categories, rule: matchRule(data.description ?? ''),
        }) : {
          ready: false, kind: null, values: { description: phrase.trim() }, destinationCurrency: null,
          reason: 'Quick Log couldn’t identify the transaction details from the phrase.',
        }
        saveAttempt.current = { draft, id: crypto.randomUUID() }
      }
      setStatus('saving')
      const { draft, id } = saveAttempt.current
      const error = await onSave(draft, phrase.trim(), id)
      if (controller.signal.aborted) return
      if (error) setFailure(error)
      else onSaved()
    } catch {
      if (!controller.signal.aborted) setFailure(errorMessages.unavailable)
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setStatus(null)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="quick-log-phrase">Transaction phrase</Label>
          <span className="text-xs tabular-nums text-muted-foreground">Default currency · {profile?.default_currency ?? 'USD'}</span>
        </div>
        <Textarea
          id="quick-log-phrase"
          aria-describedby="quick-log-privacy"
          placeholder="Jollibee 189"
          rows={3}
          maxLength={QUICK_LOG_PHRASE_LIMIT}
          value={phrase}
          disabled={status !== null}
          onChange={(event) => {
            saveAttempt.current = null
            setPhrase(event.target.value)
          }}
          className="min-h-24 resize-y text-base"
        />
        <p id="quick-log-privacy" className="text-xs text-muted-foreground">Ledger sends this phrase, active account names, types and currencies, and category and subcategory names to OpenAI to match the transaction.</p>
      </div>
      {!online && <p role="status" className="text-sm text-muted-foreground">Connect to the internet to use Quick Log, or enter the transaction manually.</p>}
      {online && lookupError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <span>{lookupError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([refetchAccounts(), refetchCategories(), refetchRules()])}>Retry</Button>
        </div>
      )}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onManual(phrase)} disabled={status === 'saving'}>Enter manually</Button>
        <Button type="submit" disabled={!phrase.trim() || !online || status !== null || accountsLoading || categoriesLoading || rulesLoading || !!lookupError}>
          {status ? <LoaderCircle className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
          <span aria-live="polite">{status === 'reading' ? 'Reading…' : status === 'saving' ? 'Saving…' : 'Log transaction'}</span>
        </Button>
      </div>
    </form>
  )
}
