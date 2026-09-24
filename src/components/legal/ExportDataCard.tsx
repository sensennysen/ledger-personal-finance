import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTransactions } from '@/hooks/useTransactions'
import { buildTransactionsCsv, downloadCsv } from '@/lib/transactionCsv'
import { resolveLoadState } from '@/lib/loadState'
import { getLocalDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { InlineLoadError } from '@/components/ui/error-state'

// "Rather export first?" beside the deletion instructions (LED-89). The page is
// public, so a signed-out visitor is sent to sign in; a signed-in one gets every
// transaction (useTransactions pages past 1,000 rows) through the Reports
// exporter. A failed read never downloads an empty or stale file.

export function ExportDataCard() {
  const { user, loading } = useAuth()

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Rather export first?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Download your transactions as CSV before deleting — they can't be recovered afterwards.
      </p>
      <div className="mt-3">
        {loading ? (
          <Button size="sm" variant="outline" disabled>
            <Download className="h-4 w-4" />
            Export my data
          </Button>
        ) : user ? (
          <SignedInExport />
        ) : (
          <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Sign in to export
          </Link>
        )}
      </div>
    </div>
  )
}

function SignedInExport() {
  const { transactions, loading, error, refetch } = useTransactions()
  const state = resolveLoadState({ loading, error, hasData: transactions.length > 0 })

  if (state === 'error' || state === 'stale-error') {
    return (
      <InlineLoadError
        message="Couldn't load your transactions, so there's nothing safe to export yet."
        onRetry={() => void refetch()}
      />
    )
  }

  if (state === 'empty') {
    return <p className="text-sm text-muted-foreground">No transactions to export.</p>
  }

  const handleExport = () => {
    // Local date: toISOString() is UTC and names the file after yesterday before 8am in Manila.
    downloadCsv(buildTransactionsCsv(transactions), `ledger-export_${getLocalDateString()}.csv`)
  }

  return (
    // Disabled while loading, including a cached copy still being refreshed.
    <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="h-4 w-4" />
      {loading ? 'Loading your transactions…' : `Export my data (${transactions.length})`}
    </Button>
  )
}
