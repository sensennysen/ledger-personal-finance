import { useState } from 'react'
import { ArrowLeftRight, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineLoadError } from '@/components/ui/error-state'
import { FormError } from '@/components/ui/form-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TechnicalDetail } from '@/components/ui/technical-detail'
import { useExchangeRates } from '@/contexts/exchangeRatesState'
import { withDetail, type FormErrorValue } from '@/lib/dataErrors'
import {
  REFRESH_FREQUENCIES,
  displayRate,
  isRefreshFrequency,
  ratesAsOfLabel,
  type RateTable,
} from '@/lib/exchangeRates'

function formatRate(rate: number): string {
  return rate >= 100 ? rate.toFixed(2) : Number(rate.toPrecision(6)).toString()
}

function fetchedLabel(table: RateTable | null): string | null {
  if (!table?.fetchedAt) return null
  const at = new Date(table.fetchedAt)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Settings: how Ledger gets exchange rates, how often it refreshes them, and rates the user types. */
export function ExchangeRatesCard() {
  const rates = useExchangeRates()
  const { table, base, needed, missing, frequency } = rates
  const [frequencyError, setFrequencyError] = useState<FormErrorValue>(null)
  const [refreshResult, setRefreshResult] = useState<FormErrorValue>(null)
  const asOf = ratesAsOfLabel(table)
  const fetched = fetchedLabel(table)
  const current = REFRESH_FREQUENCIES.find((option) => option.value === frequency)

  const onFrequency = async (value: string | null) => {
    if (!isRefreshFrequency(value) || value === frequency) return
    setFrequencyError(null)
    const result = await rates.setFrequency(value)
    if (result.error) setFrequencyError(withDetail(result))
  }

  const onRefresh = async () => {
    setRefreshResult(null)
    const result = await rates.refresh()
    if (result.error) setRefreshResult(withDetail(result))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4" /> Exchange rates
        </CardTitle>
        <CardDescription>
          Accounts in another currency are converted into {base} using rates from a public feed (frankfurter.dev, from central-bank data).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rates.error && <InlineLoadError message={rates.error} onRetry={() => void rates.reload()} />}

        <div className="space-y-1.5">
          <Label htmlFor="exchange-rate-refresh">Refresh rates</Label>
          <Select value={frequency} onValueChange={onFrequency}>
            <SelectTrigger id="exchange-rate-refresh">
              <SelectValue>{(value: string | null) => REFRESH_FREQUENCIES.find((option) => option.value === value)?.label ?? 'Choose how often'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REFRESH_FREQUENCIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && <p className="text-xs text-muted-foreground">{current.hint}</p>}
          <FormError error={frequencyError} className="mt-1 px-0" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {table?.fetchedAt
              ? `Rates${asOf ? ` as of ${asOf}` : ''} · fetched ${fetched ?? 'earlier'}`
              : needed.length === 0
                ? 'No rates needed.'
                : 'No rates fetched yet.'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()} disabled={rates.refreshing}>
            {rates.refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {rates.refreshing ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
        {rates.refreshError && (
          <div role="alert" className="text-sm text-destructive space-y-1">
            <p>{rates.refreshError}</p>
            {rates.refreshErrorDetail && <TechnicalDetail detail={rates.refreshErrorDetail} />}
          </div>
        )}
        <FormError error={refreshResult && !rates.refreshError ? refreshResult : null} className="mt-0 px-0" />

        {table && table.base !== base && (
          <p className="text-xs text-muted-foreground">
            These rates were fetched against {table.base}. Refresh to get them against {base}.
          </p>
        )}

        {needed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every account is in {base}, so no rates are needed.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Rates in use">
            {needed.map((code) => (
              <RateRow
                key={code}
                code={code}
                base={base}
                table={table}
                missing={missing.includes(code)}
                onSet={(rate) => rates.setOverride(code, rate)}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          A rate you type is kept until you clear it; a refresh never replaces it. Totals leave out a currency that has no rate.
        </p>
      </CardContent>
    </Card>
  )
}

function RateRow({
  code,
  base,
  table,
  missing,
  onSet,
}: {
  code: string
  base: string
  table: RateTable | null
  missing: boolean
  onSet: (rate: number | null) => Promise<{ error: string | null; errorDetail?: string | null }>
}) {
  const shown = table ? displayRate(table, code) : null
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<FormErrorValue>(null)
  const [saving, setSaving] = useState(false)
  const inputId = `exchange-rate-${code}`

  const save = async (rate: number | null) => {
    setSaving(true)
    const result = await onSet(rate)
    setSaving(false)
    if (result.error) {
      setError(withDetail(result))
      return
    }
    setError(null)
    setDraft('')
  }

  const submit = () => {
    const rate = Number(draft.replace(/,/g, '').trim())
    if (!draft.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError('Enter a rate greater than zero.')
      return
    }
    void save(rate)
  }

  return (
    <li className="space-y-2 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium">{code}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {shown
            ? `1 ${base} = ${formatRate(shown.rate)} ${code}${shown.source === 'override' ? ' · your rate' : ''}`
            : missing
              ? 'No rate: left out of totals'
              : '…'}
        </span>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Label htmlFor={inputId} className="sr-only">
          Your rate: {code} per 1 {base}
        </Label>
        <Input
          id={inputId}
          inputMode="decimal"
          placeholder={`Your rate: ${code} per 1 ${base}`}
          value={draft}
          className="min-w-0 flex-1"
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={saving || !draft.trim()}>
          Use my rate
        </Button>
        {shown?.source === 'override' && (
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save(null)}>
            Clear
          </Button>
        )}
      </form>
      <FormError error={error} className="mt-0 px-0" />
    </li>
  )
}
