import { useMemo, useState } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { CURRENCIES } from '@/types'
import { RATES_BASE, convertAmount } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const CODES = CURRENCIES.map((c) => c.code).filter((c) => c !== RATES_BASE)

export function ExchangeRatesSettings() {
  const { profile } = useAuth()
  const displayCurrency = profile?.default_currency ?? 'USD'
  const { rates, overrides, asOf, loading, error, refresh, setOverride } = useExchangeRates()

  const [refreshing, setRefreshing] = useState(false)
  // Per-field editing buffer. `undefined` means "not being edited" — show the
  // current override value (or blank) instead.
  const [drafts, setDrafts] = useState<Record<string, string | undefined>>({})

  const valueFor = (code: string) => {
    const draft = drafts[code]
    if (draft !== undefined) return draft
    return overrides[code] != null ? String(overrides[code]) : ''
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const commit = (code: string) => {
    const raw = (drafts[code] ?? '').trim()
    setDrafts((prev) => ({ ...prev, [code]: undefined }))
    if (raw === '') {
      void setOverride(code, null)
      return
    }
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) void setOverride(code, value)
  }

  const rows = useMemo(
    () =>
      CODES.map((code) => {
        const usdRate = rates[code] ?? null
        const overridden = overrides[code] != null
        const inDisplay =
          usdRate != null ? convertAmount(1, code, displayCurrency, rates) : null
        return { code, usdRate, overridden, inDisplay }
      }),
    [rates, overrides, displayCurrency],
  )

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {loading
              ? 'Loading rates…'
              : asOf
                ? `ECB reference rates as of ${asOf}. Base ${RATES_BASE}.`
                : 'No rates yet — refresh to fetch them.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && <p className="text-xs text-expense">{error}</p>}

        <div className="space-y-2">
          {rows.map(({ code, usdRate, overridden, inDisplay }) => (
            <div key={code} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 font-semibold">{code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">1 {code} =</span>
                  <Input
                    inputMode="decimal"
                    className="h-8 w-28"
                    placeholder={usdRate != null ? usdRate.toPrecision(6) : '—'}
                    value={valueFor(code)}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [code]: e.target.value }))
                    }
                    onBlur={() => commit(code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{RATES_BASE}</span>
                  {overridden && (
                    <button
                      type="button"
                      aria-label={`Reset ${code} to the fetched rate`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setDrafts((prev) => ({ ...prev, [code]: undefined }))
                        void setOverride(code, null)
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                </div>
                {inDisplay != null && displayCurrency !== code && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    ≈ {formatCurrency(inDisplay, displayCurrency)}
                    {overridden ? ' · manual' : ''}
                  </p>
                )}
                {usdRate == null && (
                  <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-500">
                    No rate — amounts in {code} are excluded from totals.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Rates refresh automatically about twice a day. Enter a value to override one.
        </p>
      </CardContent>
    </Card>
  )
}
