import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { AccountCombobox } from '@/components/transactions/AccountCombobox'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineLoadError } from '@/components/ui/error-state'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences } from '@/hooks/usePreferences'
import { isQuickLogExpenseAccount, isQuickLogReceivingAccount } from '@/lib/quickLog'

const fields = [
  { key: 'quickLogAccountId', label: 'Default expense account', id: 'quick-log-expense-account', eligible: isQuickLogExpenseAccount },
  { key: 'quickLogIncomeAccountId', label: 'Default income account', id: 'quick-log-income-account', eligible: isQuickLogReceivingAccount },
] as const

export function QuickLogSettingsCard() {
  const { accounts, loading, error, refetch } = useAccounts()
  const { prefs, set } = usePreferences()
  const { hash, key } = useLocation()
  const card = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hash !== '#quick-log') return
    const frame = requestAnimationFrame(() => {
      title.current?.focus({ preventScroll: true })
      card.current?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, key])

  return (
    <Card id="quick-log" ref={card} className="scroll-mt-4" role="region" aria-labelledby="quick-log-settings-title">
      <CardHeader>
        <CardTitle id="quick-log-settings-title" ref={title} tabIndex={-1} className="flex items-center gap-2">
          <Zap className="size-4" aria-hidden /> Quick Log
        </CardTitle>
        <CardDescription>Choose which accounts Quick Log uses when your expense or income phrase leaves the account out.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <InlineLoadError message={error} onRetry={() => void refetch()} />}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, id, eligible }) => {
            const options = accounts.filter(eligible)
            return (
              <div key={key} className="min-w-0 space-y-1.5">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label htmlFor={id}>{label}</Label>
                  {prefs[key] && (
                    <Button type="button" variant="ghost" size="sm"
                      aria-label={'Clear ' + label.toLowerCase()} onClick={() => set(key, null)}>
                      Clear
                    </Button>
                  )}
                </div>
                <AccountCombobox
                  id={id}
                  accounts={options}
                  value={prefs[key]}
                  onValueChange={(id) => set(key, id)}
                  placeholder={loading ? 'Loading accounts…' : 'Select account'}
                  disabled={loading || options.length === 0}
                />
                {!loading && !error && options.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add an eligible account to set a default.</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
