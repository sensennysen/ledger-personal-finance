import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CheckSquare, SquareMinus, Square, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/contexts/AuthContext'
import { useNotify } from '@/contexts/notificationState'
import { useThirteenthMonthPicks } from '@/hooks/useThirteenthMonthPicks'
import { formatCurrency, formatDate, getLocalDateString, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineLoadError } from '@/components/ui/error-state'
import { SkeletonText } from '@/components/ui/skeleton'
import { RefreshingRegion } from '@/components/ui/refreshing-region'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INCOME } from '@/constants/colors'
import { excludedByCategory, groupByMonth, monthCoverage, monthKey, pd851Checklist, salaryOnlySelection } from '@/lib/thirteenthMonth'
import { CoverageStrip } from '@/components/thirteenth-month/CoverageStrip'
import { Pd851Checklist } from '@/components/thirteenth-month/Pd851Checklist'
import type { Transaction } from '@/types'

// --- constants ---

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

// --- helpers ---

function txAmt(tx: Transaction) {
  return tx.amount * (tx.exchange_rate ?? 1)
}

// --- page ---

export default function ThirteenthMonthPage() {
  const { profile } = useAuth()
  const notify = useNotify()
  const currency = profile?.default_currency ?? 'PHP'

  const [year, setYear] = useState(CURRENT_YEAR)
  const picks = useThirteenthMonthPicks(year)
  // Months start open (LED-97): the include checkbox shouldn't sit on a closed row.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const { transactions: fetched, loading, error, refetch } = useTransactions({ startDate, endDate, type: 'income' })
  // Switching year keeps the last year's records on screen until the new ones arrive (LED-150,
  // keep-previous-data-with-its-key). The hook does not tag its rows, but every row carries its
  // date, so the year the rows belong to is read from them. If the new year's read fails, the old
  // rows are dropped and the error shows, never passed off as the new year.
  const dataYear = fetched.length > 0 ? Number(fetched[0].date.slice(0, 4)) : null
  const mismatch = dataYear !== null && dataYear !== year
  const failed = mismatch && !loading && !!error
  const refreshing = mismatch && !failed
  const transactions = useMemo(() => (failed ? [] : fetched), [failed, fetched])
  const shownYear = refreshing ? dataYear : year
  const { transactions: anyIncomeEver, loading: anyIncomeLoading } = useTransactions({ type: 'income', limit: 1 })
  // The categories the user marked as salary (LED-236), by id.
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories()
  // Without the categories the flag can't be read; say so rather than auto-select nothing.
  const salaryFlagsUnavailable = categoriesLoading || (!!categoriesError && categories.length === 0)
  const salaryCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.counts_as_salary).map((category) => category.id)),
    [categories]
  )

  const handleYearChange = (v: string) => {
    if (!v) return
    const y = Number(v)
    setYear(y)
  }

  // While the old year is still showing, its own saved picks apply, not the new year's. Picks that
  // could not be read are never passed off as "every record counts": the estimate waits for them.
  const shownPicks = picks.forYear(shownYear!)
  const picksUnavailable = shownPicks.picks === null && (shownPicks.loading || shownPicks.error !== null)
  const effectiveIncluded = useMemo(
    () => shownPicks.picks ?? new Set(picksUnavailable ? [] : transactions.map((transaction) => transaction.id)),
    [shownPicks.picks, picksUnavailable, transactions]
  )
  const showSkeleton = (loading && !refreshing) || (shownPicks.loading && shownPicks.picks === null)

  const updateIncluded = async (next: Set<string>) => {
    // Editing on top of picks that failed to load would replace them with a guess.
    if (picksUnavailable) return
    const forYear = shownYear!
    const { error } = await picks.save(forYear, next)
    if (!error) return
    notify({
      severity: 'failure',
      title: `Couldn't save your ${forYear} picks`,
      body: error,
      action: { label: 'Retry', run: () => void updateIncluded(next) },
    })
  }

  const byMonth = useMemo(() => groupByMonth(transactions), [transactions])

  const { totalIncluded, monthsWithIncome } = useMemo(() => {
    let totalIncluded = 0
    const monthsSet = new Set<string>()
    for (const tx of transactions) {
      if (!effectiveIncluded.has(tx.id)) continue
      totalIncluded += txAmt(tx)
      monthsSet.add(monthKey(tx.date))
    }
    return { totalIncluded, monthsWithIncome: monthsSet.size }
  }, [transactions, effectiveIncluded])

  const thirteenthMonthPay = totalIncluded / 12

  const currentMonth = new Date().getMonth()
  const isCurrentYear = shownYear === CURRENT_YEAR
  const monthsElapsed = isCurrentYear ? currentMonth + 1 : 12

  const monthIncludedTotal = (txs: Transaction[]) =>
    txs.filter((t) => effectiveIncluded.has(t.id)).reduce((s, t) => s + txAmt(t), 0)
  const monthAllChecked = (txs: Transaction[]) => txs.every((t) => effectiveIncluded.has(t.id))
  const monthSomeChecked = (txs: Transaction[]) => txs.some((t) => effectiveIncluded.has(t.id))

  const toggleMonth = (txs: Transaction[]) => {
    const allOn = monthAllChecked(txs)
    const next = new Set(effectiveIncluded)
    for (const t of txs) {
      if (allOn) next.delete(t.id)
      else next.add(t.id)
    }
    updateIncluded(next)
  }

  const toggleTx = (id: string) => {
    const next = new Set(effectiveIncluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateIncluded(next)
  }

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const coverage = useMemo(
    () => monthCoverage(transactions, effectiveIncluded, shownYear!, getLocalDateString()),
    [transactions, effectiveIncluded, shownYear]
  )
  const checklist = useMemo(
    () => pd851Checklist(transactions, effectiveIncluded, salaryCategoryIds),
    [transactions, effectiveIncluded, salaryCategoryIds]
  )

  const includedCount = transactions.filter((t) => effectiveIncluded.has(t.id)).length
  const excluded = useMemo(
    () => excludedByCategory(transactions, effectiveIncluded),
    [transactions, effectiveIncluded]
  )

  return (
    <div className="p-4 md:p-6 lg:px-8 space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/reports" className="rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring">Reports</Link>
        <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        <span aria-current="page" className="truncate text-foreground">13th Month Pay</span>
      </nav>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground max-w-prose">
          Computed under PD 851 – Select which income records count as basic salary
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Year</span>
        <Select value={String(year)} onValueChange={(v) => v && handleYearChange(v)}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && !loading && transactions.length === 0 && (
        <InlineLoadError
          message="Couldn't load your income records, so this estimate is not final."
          onRetry={() => void refetch()}
        />
      )}

      {shownPicks.error && !shownPicks.loading && (
        <InlineLoadError
          message={shownPicks.picks === null
            ? `Couldn't load your saved picks for ${shownYear}, so there is no estimate yet.`
            : shownPicks.error.message}
          onRetry={() => void picks.reload(shownYear!)}
        />
      )}

      <RefreshingRegion refreshing={refreshing} label={`Loading ${year}…`}>
      <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-6 xl:space-y-0">
      <div className="space-y-6 xl:order-2 xl:sticky xl:top-6">
      <section className="rounded-3xl bg-accent text-accent-foreground p-6">
        <p className="text-xs uppercase tracking-[.14em]">Estimated 13th month pay</p>
        {showSkeleton
          ? <p className="text-[40px] leading-tight mt-3"><SkeletonText className="w-40" /></p>
          : <p className="money text-[40px] leading-tight mt-3">{formatCurrency(thirteenthMonthPay, currency)}</p>
        }
        <p className="text-sm mt-3">{formatCurrency(totalIncluded, currency)} basic salary ÷ 12</p>
        {showSkeleton ? (
          <p className="text-xs mt-1"><SkeletonText className="w-48" /></p>
        ) : (
          <p className="text-xs mt-1 opacity-80">
            Across {monthsWithIncome} of {monthsElapsed} month{monthsElapsed !== 1 ? 's' : ''} {isCurrentYear ? 'so far this year' : `of ${shownYear}`}
          </p>
        )}
      </section>

      <CoverageStrip coverage={coverage} loading={showSkeleton} />
      <Pd851Checklist rows={checklist} />
      </div>

      <Card className="xl:order-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" style={{ color: INCOME }} />
                Income Records – {shownYear}
              </CardTitle>
              <CardDescription>
                {showSkeleton || transactions.length === 0
                  ? 'Select the records that count as basic salary'
                  : `${includedCount} of ${transactions.length} counted as basic salary`}
              </CardDescription>
            </div>
          </div>
          {!showSkeleton && transactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={salaryFlagsUnavailable}
                onClick={() => updateIncluded(salaryOnlySelection(transactions, salaryCategoryIds))}
              >
                Auto-select salary only
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateIncluded(new Set(transactions.map((t) => t.id)))}
              >
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => updateIncluded(new Set())}>
                Clear
              </Button>
            </div>
          )}
          {!showSkeleton && transactions.length > 0 && categoriesError && categories.length === 0 && (
            <InlineLoadError
              message="Couldn't load your categories, so Auto-select salary only can't tell which count as salary."
              onRetry={() => void refetchCategories()}
            />
          )}
          {!showSkeleton && transactions.length > 0 && !salaryFlagsUnavailable && salaryCategoryIds.size === 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              No category counts as salary yet. Tick "Counts as salary" on one in{' '}
              <Link to="/categories" className="underline underline-offset-2">Categories</Link>.
            </p>
          )}
          {!showSkeleton && excluded.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>Excluded by category:</span>
              {excluded.map(({ name, count }) => (
                <Badge key={name} variant="outline" className="font-normal">
                  {name} · {count}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {showSkeleton ? (
            <div className="divide-y divide-border/50" aria-busy="true" aria-label="Loading income records">
              <div className="flex items-center gap-3 bg-muted/30 px-5 py-3">
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                <Square className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                <span className="flex-1 text-sm"><SkeletonText className="w-24" /></span>
                <span className="text-sm"><SkeletonText className="w-20" /></span>
              </div>
              <div className="divide-y divide-border/30">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <Square className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><SkeletonText className="w-40 max-w-full" /></p>
                      <p className="text-xs"><SkeletonText className="w-20" /></p>
                    </div>
                    <span className="text-sm"><SkeletonText className="w-16" /></span>
                  </div>
                ))}
              </div>
            </div>
          ) : transactions.length === 0 && !anyIncomeLoading && anyIncomeEver.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Nothing recorded yet" bare />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title={`No income transactions found for ${year}`}
              bare
              action={
                year > CURRENT_YEAR - YEAR_OPTIONS.length + 1 ? (
                  <Button variant="outline" size="sm" onClick={() => handleYearChange(String(year - 1))}>
                    Try {year - 1}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-border/50">
              {byMonth.map(([key, txs]) => {
                const monthIdx = Number(key.slice(5, 7)) - 1
                const monthName = MONTH_NAMES[monthIdx]
                const allOn = monthAllChecked(txs)
                const someOn = monthSomeChecked(txs)
                const inclTotal = monthIncludedTotal(txs)
                const total = txs.reduce((s, t) => s + txAmt(t), 0)
                const isOpen = !collapsed.has(key)

                return (
                  <div key={key}>
                    <div
                      className="flex items-center gap-3 px-5 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                      onClick={() => toggleCollapsed(key)}
                    >
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      }
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleMonth(txs) }}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title={allOn ? 'Deselect all in month' : 'Select all in month'}
                      >
                        {allOn
                          ? <CheckSquare className="w-4 h-4" style={{ color: INCOME }} />
                          : someOn
                            ? <SquareMinus className="w-4 h-4" style={{ color: INCOME }} aria-label="Some selected" />
                            : <Square className="w-4 h-4" />
                        }
                      </button>
                      <span className="font-semibold text-sm flex-1">{monthName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[0.625rem] h-4 px-1.5 py-0">
                          {txs.length} record{txs.length !== 1 ? 's' : ''}
                        </Badge>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: inclTotal > 0 ? INCOME : undefined }}
                        >
                          {inclTotal > 0
                            ? formatCurrency(inclTotal, currency)
                            : <span className="text-muted-foreground">-</span>
                          }
                        </span>
                        {inclTotal !== total && inclTotal > 0 && (
                          <span className="text-[0.6875rem] text-muted-foreground tabular-nums hidden sm:block">
                            of {formatCurrency(total, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="divide-y divide-border/30">
                        {txs.map((tx) => {
                          const isOn = effectiveIncluded.has(tx.id)
                          return (
                            <label
                              key={tx.id}
                              className={cn(
                                'flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors',
                              )}
                            >
                              <input
                                type="checkbox"
                              checked={isOn}
                                onChange={() => toggleTx(tx.id)}
                                className="w-4 h-4 accent-primary rounded shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', !isOn && 'line-through text-muted-foreground')}>
                                  {tx.description || '(no description)'}
                                </p>
                                <p className="text-[0.6875rem] text-muted-foreground flex items-center gap-1.5">
                                  <span>{formatDate(tx.date)}</span>
                                  {!isOn && <span className="font-medium">Not counted</span>}
                                  {tx.category && (
                                    <>
                                      <span className="text-muted-foreground">–</span>
                                      <span>{tx.category.icon} {tx.category.name}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <span className={cn(
                                'text-sm font-semibold tabular-nums shrink-0',
                                isOn ? 'text-foreground' : 'line-through text-muted-foreground',
                              )}>
                                {formatCurrency(txAmt(tx), currency)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </CardContent>
      </Card>
      </div>
      </RefreshingRegion>
    </div>
  )
}
