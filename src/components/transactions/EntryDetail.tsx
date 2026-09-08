import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Transaction } from '@/types'

export function EntryDetail({
  transaction,
  onEdit,
}: {
  transaction: Transaction
  onEdit?: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="text-center rounded-[20px] bg-card p-5">
        <p className="text-lg font-medium">{transaction.description}</p>
        <p
          className="money text-3xl mt-3 break-words"
          style={{ color: `var(--${transaction.type})` }}
        >
          {transaction.type === 'income'
            ? '+'
            : transaction.type === 'expense'
              ? '−'
              : ''}
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
      </div>
      <dl className="divide-y divide-border">
        {[
          ['Date', transaction.date],
          ['Category', transaction.category?.name ?? 'Uncategorized'],
          ['Account', transaction.account?.name ?? 'Account'],
          ...(transaction.to_account
            ? [['To account', transaction.to_account.name]]
            : []),
          ['Note', transaction.notes ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-4 justify-between py-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right break-words min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
      {onEdit && (
        <Button className="w-full" onClick={onEdit}>
          Edit entry
        </Button>
      )}
    </div>
  )
}
