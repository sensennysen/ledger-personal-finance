import { useMemo, useState, useEffect } from 'react'
import { CalendarCheck, Calculator, Info, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { EMERALD, CORAL, GOLD } from '@/constants/colors'
import type { Transaction } from '@/types'

// --- constants ---

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

// --- localStorage helpers ---

function selectionKey(userId: string, year: number) {
  return `13th-month-selection:${userId}:${year}`
}

function loadSelection(userId: string, year: number): Set<string> {
  try {
    const raw = localStorage.getItem(selectionKey(userId, year))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function persistSelection(userId: string, year: number, ids: Set<string>) {
  localStorage.setItem(selectionKey(userId, year), JSON.stringify([...ids]))
}

// --- helpers ---

function monthKey(date: string) {
  return date.slice(0, 7)
}

function txAmt(tx: Transaction) {
  return tx.amount * (tx.exchange_rate ?? 1)
}

// --- SummaryCard ---

function SummaryCard({
  label, value, sub, color, loading,
}: {
  label: string
  value: string
  sub?: string
  color: string
  loading?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 p-5 bg-card">
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 pointer-events-none"
        style={{ background: color, filter: 'blur(28px)', transform: 'translate(30%, -30%)' }}
      />
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      {loading
        ? <Skeleton className="h-7 w-28 mt-1" />
        : <p className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
      }
      {sub && !loading && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

// --- page ---

export default function ThirteenthMonthPage() {
  const { profile, user } = useAuth()
  const currency = profile?.default_currency ?? 'PHP'
  const userId = user?.id ?? ''

  const [year, setYear] = useState(CURRENT_YEAR)
  const [included, setIncluded] = useState<Set<string>>(() => loadSelection(userId, CURRENT_YEAR))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const { transactions, loading } = useTransactions({ startDate, endDate, type: 'income' })

  const handleYearChange = (v: string) => {
    if (!v) return
    const y = Number(v)
    setYear(y)
    setIncluded(loadSelection(userId, y))
  }

  // Auto-include all transactions when loading a year with no saved selection
  useEffect(() => {
    if (loading || transactions.length === 0) return
    const saved = loadSelection(userId, year)
    if (saved.size === 0) {
      const all = new Set(transactions.map((t) => t.id))
      setIncluded(all)
      persistSelection(userId, year, all)
    } else {
      setIncluded(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, year])

  const updateIncluded = (next: Set<string>) => {
    setIncluded(next)
    persistSelection(userId, year, next)
  }

  // Group by month, sorted asc
  const byMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const key = monthKey(tx.date)
      const arr = map.get(key)
      if (arr) arr.push(tx)
      else map.set(key, [tx])
    }
    for (const arr of map.values()) arr.sort((a, b) => b.date.localeCompare(a.date))
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [transactions])

  const { totalIncluded, monthsWithIncome } = useMemo(() => {
    let totalIncluded = 0
    const monthsSet = new Set<string>()
    for (const tx of transactions) {
      if (!included.has(tx.id)) continue
      totalIncluded += txAmt(tx)
      monthsSet.add(monthKey(tx.date))
    }
    return { totalIncluded, monthsWithIncome: monthsSet.size }
  }, [transactions, included])

  const thirteenthMonthPay = totalIncluded / 12

  const currentMonth = new Date().getMonth()
  const isCurrentYear = year === CURRENT_YEAR
  const monthsElapsed = isCurrentYear ? currentMonth + 1 : 12

  const monthIncludedTotal = (txs: Transaction[]) =>
    txs.filter((t) => included.has(t.id)).reduce((s, t) => s + txAmt(t), 0)
  const monthAllChecked = (txs: Transaction[]) => txs.every((t) => included.has(t.id))
  const monthSomeChecked = (txs: Transaction[]) => txs.some((t) => included.has(t.id))

  const toggleMonth = (txs: Transaction[]) => {
    const allOn = monthAllChecked(txs)
    const next = new Set(included)
    for (const t of txs) {
      if (allOn) next.delete(t.id)
      else next.add(t.id)
    }
    updateIncluded(next)
  }

  const toggleTx = (id: string) => {
    const next = new Set(included)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateIncluded(next)
  }

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allChecked = transactions.length > 0 && transactions.every((t) => included.has(t.id))

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6" style={{ color: GOLD }} />
          13th Month Pay Estimator
        </h1>
        <p className="text-sm text-muted-foreground">
          Computed under PD 851 — Select which income records count as basic salary
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Total Basic Salary"
          value={formatCurrency(totalIncluded, currency)}
          sub={`${monthsWithIncome} of ${monthsElapsed} month${monthsElapsed !== 1 ? 's' : ''} covered`}
          color={EMERALD}
          loading={loading}
        />
        <SummaryCard
          label="Estimated 13th Month Pay"
          value={formatCurrency(thirteenthMonthPay, currency)}
          sub="Total / 12 (PD 851)"
          color={GOLD}
          loading={loading}
        />
        <SummaryCard
          label="Records Included"
          value={loading ? '-' : `${included.size} / ${transactions.length}`}
          sub="Tap rows below to toggle"
          color={CORAL}
          loading={loading}
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          All income transactions for the year are shown below. Check only the records that qualify
          as <strong className="text-foreground">basic salary</strong> under PD 851 — exclude bonuses,
          allowances, overtime, and non-covered sources. Your selection is saved locally and never
          affects your account balances.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" style={{ color: EMERALD }} />
                Income Records — {year}
              </CardTitle>
              <CardDescription>Select the records that count as basic salary</CardDescription>
            </div>
            {!loading && transactions.length > 0 && (
              <button
                type="button"
                onClick={() => allChecked
                  ? updateIncluded(new Set())
                  : updateIncluded(new Set(transactions.map((t) => t.id)))
                }
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 shrink-0"
              >
                {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No income transactions found for {year}.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {byMonth.map(([key, txs]) => {
                const monthIdx = Number(key.slice(5, 7)) - 1
                const monthName = MONTH_NAMES[monthIdx]
                const allOn = monthAllChecked(txs)
                const someOn = monthSomeChecked(txs)
                const inclTotal = monthIncludedTotal(txs)
                const total = txs.reduce((s, t) => s + txAmt(t), 0)
                const isOpen = expanded.has(key)

                return (
                  <div key={key}>
                    <div
                      className="flex items-center gap-3 px-5 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                      onClick={() => toggleExpand(key)}
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
                          ? <CheckSquare className="w-4 h-4" style={{ color: EMERALD }} />
                          : someOn
                            ? <CheckSquare className="w-4 h-4 opacity-50" style={{ color: EMERALD }} />
                            : <Square className="w-4 h-4" />
                        }
                      </button>
                      <span className="font-semibold text-sm flex-1">{monthName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                          {txs.length} record{txs.length !== 1 ? 's' : ''}
                        </Badge>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: inclTotal > 0 ? EMERALD : undefined }}
                        >
                          {inclTotal > 0
                            ? formatCurrency(inclTotal, currency)
                            : <span className="text-muted-foreground">-</span>
                          }
                        </span>
                        {inclTotal !== total && inclTotal > 0 && (
                          <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:block">
                            of {formatCurrency(total, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="divide-y divide-border/30">
                        {txs.map((tx) => {
                          const isOn = included.has(tx.id)
                          return (
                            <label
                              key={tx.id}
                              className={cn(
                                'flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors',
                                !isOn && 'opacity-50',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isOn}
                                onChange={() => toggleTx(tx.id)}
                                className="w-4 h-4 accent-primary rounded shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {tx.description || '(no description)'}
                                </p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                  <span>{formatDate(tx.date)}</span>
                                  {tx.category && (
                                    <>
                                      <span className="text-border">·</span>
                                      <span>{tx.category.icon} {tx.category.name}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <span className={cn(
                                'text-sm font-semibold tabular-nums shrink-0',
                                isOn ? 'text-foreground' : 'text-muted-foreground',
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

          {!loading && transactions.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-5 py-4 bg-muted/30">
                <div>
                  <p className="text-sm font-semibold">Estimated 13th Month Pay</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(totalIncluded, currency)} total / 12
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums" style={{ color: GOLD }}>
                  {formatCurrency(thirteenthMonthPay, currency)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
