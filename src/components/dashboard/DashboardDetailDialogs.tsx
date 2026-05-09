import { CORAL, EMERALD } from '@/constants/colors'
import { getAccountNetWorthContribution } from '@/lib/creditCards'
import { formatCurrency } from '@/lib/utils'
import type { DashboardExpenseCategoryBreakdown, DashboardStatsSummary } from '@/hooks/useDashboardData'
import type { Account, Category, Transaction } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DashboardSummaryValueRow } from '@/components/dashboard/DashboardSummaryValueRow'
import { DashboardTransactionRow } from '@/components/dashboard/DashboardTransactionRow'

export type DashboardDetailView = 'balance' | 'income' | 'expenses' | 'categories' | null

interface DashboardDetailDialogsProps {
  detailView: DashboardDetailView
  setDetailView: (view: DashboardDetailView) => void
  accounts: Account[]
  categories: Category[]
  monthLabel: string
  monthIncomeTx: Transaction[]
  monthExpenseTx: Transaction[]
  expensesByCategory: DashboardExpenseCategoryBreakdown[]
  stats: DashboardStatsSummary
  currency: string
}

function TransactionListDialog({
  open,
  onOpenChange,
  title,
  emptyMessage,
  totalLabel,
  totalValue,
  totalColor,
  transactions,
  prefix,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  emptyMessage: string
  totalLabel: string
  totalValue: number
  totalColor: string
  transactions: Transaction[]
  prefix: '+' | '-'
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1 pr-2">
            {transactions.map((tx) => (
              <DashboardTransactionRow
                key={tx.id}
                icon={tx.category?.icon ?? (prefix === '+' ? 'In' : 'Out')}
                iconBackgroundColor={`${tx.category?.color ?? '#6b7280'}22`}
                title={tx.description}
                subtitle={`${tx.category?.name ?? 'Uncategorized'} - ${tx.date}`}
                amount={
                  <span style={{ color: totalColor }}>
                    {prefix}
                    {formatCurrency(tx.amount, tx.currency)}
                  </span>
                }
              />
            ))}
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
            )}
          </div>
        </ScrollArea>
        {transactions.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <DashboardSummaryValueRow
              label={totalLabel}
              value={
                <span className="money text-base font-bold" style={{ color: totalColor }}>
                  {formatCurrency(totalValue, transactions[0]?.currency ?? 'USD')}
                </span>
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function DashboardDetailDialogs({
  detailView,
  setDetailView,
  accounts,
  categories,
  monthLabel,
  monthIncomeTx,
  monthExpenseTx,
  expensesByCategory,
  stats,
  currency,
}: DashboardDetailDialogsProps) {
  return (
    <>
      <Dialog open={detailView === 'balance'} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Net Balance</DialogTitle>
            <p className="text-xs text-muted-foreground">Assets minus liabilities</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-2">
              {accounts.map((account) => {
                const contribution = getAccountNetWorthContribution(account)
                return (
                  <div key={account.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 bg-muted/30">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border border-border/50"
                      style={{ backgroundColor: account.color + '22' }}
                    >
                      {account.icon ?? 'Bank'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] font-medium truncate">{account.name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground capitalize">{account.type.replace('_', ' ')}</p>
                    </div>
                    <p className="money text-sm font-semibold shrink-0" style={{ color: contribution >= 0 ? EMERALD : CORAL }}>
                      {formatCurrency(contribution, account.currency)}
                    </p>
                  </div>
                )
              })}
              {accounts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No accounts yet</p>}
            </div>
          </ScrollArea>
          {accounts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <DashboardSummaryValueRow
                label="Assets"
                value={<span className="money text-sm font-semibold">{formatCurrency(stats.totalAssets, currency)}</span>}
              />
              {stats.totalCreditCardDebt > 0 && (
                <DashboardSummaryValueRow
                  label="Credit card debt"
                  value={
                    <span className="money text-sm font-semibold" style={{ color: CORAL }}>
                      -{formatCurrency(stats.totalCreditCardDebt, currency)}
                    </span>
                  }
                />
              )}
              <DashboardSummaryValueRow
                label="Net"
                value={<span className="money text-base font-bold balance-gradient">{formatCurrency(stats.totalBalance, currency)}</span>}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransactionListDialog
        open={detailView === 'income'}
        onOpenChange={(open) => !open && setDetailView(null)}
        title={`Income - ${monthLabel}`}
        emptyMessage="No income this month"
        totalLabel="Total Income"
        totalValue={stats.income}
        totalColor={EMERALD}
        transactions={monthIncomeTx}
        prefix="+"
      />

      <TransactionListDialog
        open={detailView === 'expenses'}
        onOpenChange={(open) => !open && setDetailView(null)}
        title={`Expenses - ${monthLabel}`}
        emptyMessage="No expenses this month"
        totalLabel="Total Expenses"
        totalValue={stats.expenses}
        totalColor={CORAL}
        transactions={monthExpenseTx}
        prefix="-"
      />

      <Dialog open={detailView === 'categories'} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expenses by Category</DialogTitle>
            <p className="text-xs text-muted-foreground">{monthLabel} spending breakdown</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-2">
              {expensesByCategory.map((categoryBreakdown, index) => {
                const pct = stats.expenses > 0 ? (categoryBreakdown.amount / stats.expenses) * 100 : 0
                const categoryMatch = categories.find((category) => category.name === categoryBreakdown.name)
                const categoryTransactions = monthExpenseTx.filter((tx) => {
                  return categoryMatch ? tx.category_id === categoryMatch.id : false
                })

                return (
                  <div key={index} className="rounded-lg border border-border/50 px-3 py-3 bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryBreakdown.icon}</span>
                      <span className="flex-1 text-[0.8125rem] font-medium">{categoryBreakdown.name}</span>
                      <span className="money text-[0.8125rem] font-semibold shrink-0" style={{ color: categoryBreakdown.color }}>
                        {formatCurrency(categoryBreakdown.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: categoryBreakdown.color }}
                      />
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {pct.toFixed(1)}% of total - {categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}
                    </p>
                    {categoryTransactions.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        {categoryTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between gap-2 py-1">
                            <p className="text-xs text-muted-foreground truncate flex-1">{tx.description}</p>
                            <p className="text-xs money font-medium shrink-0" style={{ color: CORAL }}>
                              -{formatCurrency(tx.amount, tx.currency)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {expensesByCategory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses this month</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
