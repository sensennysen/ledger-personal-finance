import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  TrendingUp,
  TrendingDown,
  TriangleAlert,
  Wallet,
  FileBarChart2,
  Store,
  ArrowUpRight,
  ChevronDown,
  Columns3,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/contexts/AuthContext'
import { useExchangeRates } from '@/contexts/exchangeRatesState'
import { converterTo } from '@/lib/exchangeRates'
import { useCycle } from '@/contexts/cycleState'
import { getReportRange } from '@/lib/reportCycle'
import {
  compareToPrevious,
  comparisonLabel,
  convertedNetWorthEffect,
  formatComparison,
  likeForLikeWindows,
  previousCycleKey,
  summarizeRange,
} from '@/lib/periodCompare'
import {
  DEFAULT_LOOKBACK,
  LOOKBACK_OPTIONS,
  getLookbackBuckets,
  getLookbackSubtitle,
  type Lookback,
} from '@/lib/reportLookback'
import { formatCurrency, formatDate, getLocalDateString, cn } from '@/lib/utils'
import { countedEnd, countsYet, scheduledIn } from '@/lib/countsYet'
import { afterScheduledLabel, scheduledNetWorth } from '@/lib/scheduledBalances'
import { buildReportCsv, downloadCsv } from '@/lib/transactionCsv'
import { buildRunningBalanceMap } from '@/lib/runningBalance'
import { abbreviateTick, thinCategoryTicks } from '@/lib/chartTicks'
import { REPORT_COLUMNS, defaultColumns, exportColumns, toggleColumn, type ReportColumn } from '@/lib/reportColumns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageActions } from '@/components/layout/PageActions'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { InlineLoadError } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { INCOME, EXPENSE, TRANSFER } from '@/constants/colors'
import type { Transaction } from '@/types'
import { OverspendingCard } from '@/components/reports/OverspendingCard'
import { useOverspendingReport } from '@/hooks/useOverspendingReport'
import { useDeficitBehaviour } from '@/hooks/useDeficitBehaviour'
import { summarizeBalances } from '@/lib/accountsOverview'
import { UnratedCurrencyNotice } from '@/components/UnratedCurrencyNotice'
import { buildCategoryBreakdown, rollupBreakdown, type CategorySlice } from '@/lib/categoryBreakdown'
import { CategoryBreakdownCard } from '@/components/reports/CategoryBreakdownCard'
import { useCategoryInk } from '@/hooks/useCategoryInk'

// ─── date helpers ─────────────────────────────────────────────────────────────

function localDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── pdf export ──────────────────────────────────────────────────────────────

/** Same rollup as the on-screen card, so the PDF's shares add up to the whole. */
function pdfCategoryRows(categoryBreakdown: CategorySlice[]) {
  const { top, other } = rollupBreakdown(categoryBreakdown)
  return other ? [...top, { name: `Other - ${other.count} categories`, amount: other.amount }] : top
}

function exportToPdf(
  transactions: Transaction[],
  totalIncome: number,
  totalExpenses: number,
  netChange: number,
  currency: string,
  dateRangeLabel: string,
  categoryBreakdown: CategorySlice[],
  merchantBreakdown: { displayName: string; amount: number; count: number }[],
  filenameLabel: string,
  columns: ReportColumn[],
  balanceMap: Map<string, number>,
) {
  // jsPDF's built-in Helvetica font only covers Latin-1, so Unicode currency
  // symbols (₱, €, £, ¥, …) render as garbled characters. Use the ISO currency
  // code display ("PHP 1,234.56") which is pure ASCII and always readable.
  const pdfFmt = (amount: number, code: string) =>
    formatCurrency(amount, code, { currencyDisplay: 'code' })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── Header ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Expense Report', margin, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Period: ${dateRangeLabel}`, margin, 28)
  doc.text(`Generated: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, margin, 34)

  // ── Summary boxes ──
  doc.setTextColor(30, 30, 30)
  const boxWidth = (pageWidth - margin * 2 - 8) / 3
  const boxY = 42
  const summaryItems = [
    { label: 'Total Income', value: pdfFmt(totalIncome, currency), r: 34, g: 197, b: 94 },
    { label: 'Total Expenses', value: pdfFmt(totalExpenses, currency), r: 239, g: 68, b: 68 },
    { label: 'Net Change', value: pdfFmt(netChange, currency), r: netChange >= 0 ? 34 : 239, g: netChange >= 0 ? 197 : 68, b: netChange >= 0 ? 94 : 68 },
  ]
  summaryItems.forEach((item, i) => {
    const x = margin + i * (boxWidth + 4)
    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(x, boxY, boxWidth, 18, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(item.label, x + 3, boxY + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(item.r, item.g, item.b)
    doc.text(item.value, x + 3, boxY + 14)
  })

  let currentY = boxY + 26

  // ── Category breakdown ──
  if (categoryBreakdown.length > 0) {
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Expenses by Category', margin, currentY)
    currentY += 4
    autoTable(doc, {
      startY: currentY,
      head: [['Category', 'Amount', '% of Total']],
      body: pdfCategoryRows(categoryBreakdown).map((cat) => [
        cat.name,
        pdfFmt(cat.amount, currency),
        totalExpenses > 0 ? `${((cat.amount / totalExpenses) * 100).toFixed(1)}%` : '-',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: margin, right: margin },
    })
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Merchant breakdown ──
  if (merchantBreakdown.length > 0) {
    if (currentY > 220) { doc.addPage(); currentY = 20 }
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Top Merchants', margin, currentY)
    currentY += 4
    autoTable(doc, {
      startY: currentY,
      head: [['Merchant', 'Amount', 'Transactions']],
      body: merchantBreakdown.slice(0, 10).map((m) => [
        m.displayName,
        pdfFmt(m.amount, currency),
        String(m.count),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: margin, right: margin },
    })
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Transaction table ──
  if (currentY > 210) { doc.addPage(); currentY = 20 }
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Transactions', margin, currentY)
  currentY += 4
  // Same columns, in the same order, as the table on screen (the Columns control).
  const pdfCell = (column: ReportColumn, t: Transaction): string => {
    switch (column) {
      case 'date': return t.date
      case 'description': return t.description
      case 'category': return t.category?.name ?? '—'
      case 'account': return t.account?.name ?? '—'
      case 'type': return t.type.charAt(0).toUpperCase() + t.type.slice(1)
      case 'amount': return `${t.type === 'income' ? '+' : t.type === 'transfer' ? '~' : '-'} ${pdfFmt(t.amount, t.currency)}`
      case 'balance': {
        const balance = balanceMap.get(t.id)
        return balance === undefined ? '—' : pdfFmt(balance, t.account?.currency ?? t.currency)
      }
    }
  }
  const labelOf = new Map(REPORT_COLUMNS.map((c) => [c.key, c.label]))
  const columnStyles: Record<number, { halign?: 'right'; cellWidth: number | 'auto' }> = {}
  columns.forEach((column, index) => {
    if (column === 'date') columnStyles[index] = { cellWidth: 22 }
    else if (column === 'description') columnStyles[index] = { cellWidth: 'auto' }
    else if (column === 'category') columnStyles[index] = { cellWidth: 30 }
    else if (column === 'account') columnStyles[index] = { cellWidth: 32 }
    else if (column === 'type') columnStyles[index] = { cellWidth: 20 }
    else columnStyles[index] = { halign: 'right', cellWidth: 28 }
  })
  autoTable(doc, {
    startY: currentY,
    head: [columns.map((column) => labelOf.get(column) ?? column)],
    body: transactions.map((t) => columns.map((column) => pdfCell(column, t))),
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
    columnStyles,
    margin: { left: margin, right: margin },
  })

  doc.save(`ledger-report_${filenameLabel}.pdf`)
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  comparison,
  loading,
  note,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  comparison?: { text: string; color: string }
  loading?: boolean
  note?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 p-4 sm:p-5 bg-card">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: color, filter: 'blur(32px)', transform: 'translate(30%, -30%)' }}
      />
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <p className="text-lg sm:text-2xl font-bold tracking-tight wrap-break-word" style={{ color }}>
              {value}
            </p>
          )}
          {loading && [sub, comparison].filter(Boolean).map((_, i) => (
            <div key={i} className="flex h-4 items-center mt-1"><Skeleton className="h-3 w-24" /></div>
          ))}
          {sub && !loading && (
            <p className="text-[0.6875rem] text-muted-foreground mt-1 wrap-break-word">{sub}</p>
          )}
          {comparison && !loading && (
            <p className="text-[0.6875rem] font-medium tabular-nums mt-1 wrap-break-word" style={{ color: comparison.color }}>
              {comparison.text}
            </p>
          )}
          {note && !loading && <div className="mt-1.5">{note}</div>}
        </div>
        <div
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0"
          style={{ background: `${color.replace(')', ' / 0.12)')}`, boxShadow: `0 0 0 1px ${color.replace(')', ' / 0.20)')}` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

// ─── income vs expenses trend card ────────────────────────────────────────────

function IncomeExpenseCard({
  data,
  lookback,
  onLookbackChange,
  loading,
  currency,
  excludedCurrencies = [],
}: {
  data: { month: string; income: number; expenses: number }[]
  lookback: Lookback
  onLookbackChange: (value: Lookback) => void
  loading: boolean
  currency: string
  excludedCurrencies?: string[]
}) {
  return (
    <div className="h-full rounded-[20px] border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileBarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">
            Income vs. Expenses — {getLookbackSubtitle(lookback, new Date())}
          </p>
        </div>
        <select
          aria-label="Trend chart lookback"
          value={lookback}
          onChange={(e) => onLookbackChange(e.target.value as Lookback)}
          className="h-7 rounded-md border border-border bg-background px-2 text-xs"
        >
          {LOOKBACK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {!loading && <UnratedCurrencyNotice currencies={excludedCurrencies} subject="income and expenses" />}
  {loading ? (
        <div className="relative flex-1 min-h-60 lg:min-h-72"><Skeleton className="absolute inset-0 rounded-lg" /></div>
      ) : (
        // The chart fills an absolutely placed box: a percentage height has no parent to
        // resolve against in Analytics' flex column, which measured 0px (LED-168).
        <div className="relative flex-1 min-h-60 lg:min-h-72">
          <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={abbreviateTick}
                width={40}
              />
              <Tooltip
                formatter={(v, name) => [formatCurrency(v as number, currency), name as string]}
                contentStyle={{
                  fontSize: 11,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              <Bar dataKey="income" name="Income" fill={INCOME} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={EXPENSE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

const RIGHT_ALIGNED = new Set<ReportColumn>(['amount', 'balance'])

// Text-run widths for the loading table, roughly the width of each column's content.
const SKELETON_WIDTH: Record<ReportColumn, string> = {
  date: 'w-12',
  description: 'w-32',
  category: 'w-20',
  account: 'w-24',
  type: 'w-14',
  amount: 'w-16',
  balance: 'w-16',
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const ink = useCategoryInk()
  const { profile } = useAuth()
  const deficitBehaviour = useDeficitBehaviour()
  const currency = profile?.default_currency ?? 'USD'
  const { table: rateTable } = useExchangeRates()
  const convertToDefault = useMemo(() => converterTo(rateTable, currency), [rateTable, currency])

  const { transactions, loading: txLoading, error: txError, refetch: refetchTransactions } = useTransactions()
  const { accounts, loading: accLoading, error: accError, refetch: refetchAccounts } = useAccounts()
  const { categories } = useCategories()

  const loading = txLoading || accLoading
  const loadFailed = !!(txError || accError)
  const retryFailedSources = () => {
    if (txError) void refetchTransactions()
    if (accError) void refetchAccounts()
  }

  const { startDay, selectedMonth, setSelectedMonth } = useCycle()
  const overspending = useOverspendingReport({ startDay, month: selectedMonth, deficitBehaviour })
  const [activeTab, setActiveTab] = useState('overview')
  const { start, end, label: rangeLabel, filenameLabel } = useMemo(
    () => getReportRange(selectedMonth, startDay),
    [selectedMonth, startDay],
  )

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (start && t.date < start) return false
      if (end && t.date > end) return false
      return true
    })
  }, [transactions, start, end])

  // Rows dated after today are scheduled: listed, but not in the totals until their date (LED-238).
  const today = getLocalDateString()
  const countedTo = countedEnd(end, today)
  const counted = useMemo(() => filtered.filter((t) => countsYet(t.date, today)), [filtered, today])

  const goToPreviousPeriod = () => {
    setSelectedMonth(previousCycleKey(selectedMonth))
  }

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const allTransactionsSorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [transactions]
  )

  // Summary stats
  const { income: totalIncome, expenses: totalExpenses, net: netChange, excludedCurrencies: summaryExcludedCurrencies } = useMemo(
    () => summarizeRange(transactions, start, countedTo, currency, rateTable),
    [transactions, start, countedTo, currency, rateTable]
  )
  const scheduledTotals = useMemo(
    () => summarizeRange(scheduledIn(transactions, start, end, today), start, end, currency, rateTable),
    [transactions, start, end, today, currency, rateTable]
  )
  const scheduledSub = (amount: number) => (amount > 0 ? `+ ${formatCurrency(amount, currency)} scheduled` : undefined)

  // Same figures for the previous cycle, so each stat card has a reference point. While this
  // cycle is open, only its first N days are set against the first N of the last one (LED-237).
  const previousWindows = useMemo(() => {
    const previous = getReportRange(previousCycleKey(selectedMonth), startDay)
    return likeForLikeWindows({ start, end }, { start: previous.start, end: previous.end }, today)
  }, [selectedMonth, startDay, start, end, today])
  const previousLabel = comparisonLabel(previousCycleKey(selectedMonth), previousWindows)
  const previousTotals = useMemo(
    () => summarizeRange(transactions, previousWindows.previous.start, previousWindows.previous.end, currency, rateTable),
    [transactions, previousWindows, currency, rateTable]
  )
  const netWorthChange = useMemo(
    () => counted.reduce((sum, t) => sum + (convertedNetWorthEffect(t, currency, rateTable) ?? 0), 0),
    [counted, currency, rateTable]
  )
  // good: which direction is good news for this figure. Hidden when a read
  // failed, since partial data would produce a false comparison.
  const compare = (current: number, previous: number, good: 'up' | 'down') => {
    if (loadFailed) return undefined
    const cmp = compareToPrevious(current, previous)
    const color = cmp.direction === 'flat' || cmp.pct === null
      ? 'var(--muted-foreground)'
      : cmp.direction === good ? INCOME : EXPENSE
    return { text: formatComparison(cmp, previousLabel), color }
  }

  // Category breakdown (expenses only)
  const { rows: categoryBreakdown, excludedCurrencies: categoryExcludedCurrencies } = useMemo(
    () => buildCategoryBreakdown(counted, categoryById, currency, rateTable),
    [counted, categoryById, currency, rateTable]
  )

  // Over budget stat card: the report's total in the display currency, against last cycle.
  const overspendingReady = overspending.state === 'ready' || overspending.state === 'stale-error'
  // The same converted total the Overspending card prints (LED-185), so the two cannot disagree.
  const overNow = overspending.converted.over
  const overPrevious = overspending.previousConverted.over
  const overCategories = overspending.result.rows.length
  const overspendingSub =
    overspending.state === 'error'
      ? "Couldn't load your budgets"
      : overspending.state === 'empty'
        ? 'No budgets set'
        : `${overCategories} ${overCategories === 1 ? 'category' : 'categories'}`

  const handleExport = () => {
    downloadCsv(buildReportCsv(sortedTransactions, exportColumns(visibleColumns), txBalanceMap), `ledger-report_${filenameLabel}.csv`)
  }

  const handleExportPdf = () => {
    exportToPdf(
      sortedTransactions,
      totalIncome,
      totalExpenses,
      netChange,
      currency,
      rangeLabel,
      categoryBreakdown,
      merchantBreakdown,
      filenameLabel,
      exportColumns(visibleColumns),
      txBalanceMap,
    )
  }

  // ── Net Worth Over Time (last 13 months) ──
  const { netWorthData, netWorthExcludedCurrencies } = useMemo(() => {
    const now = new Date()
    const currentNetWorth = summarizeBalances(accounts, currency, convertToDefault).netWorth
    const boundaries: { date: string; label: string }[] = []
    for (let i = 12; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = i === 0
        ? now
        : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const label = monthStart.getFullYear() !== now.getFullYear()
        ? monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : monthStart.toLocaleDateString('en-US', { month: 'short' })
      boundaries.push({ date: localDateStr(monthEnd), label })
    }
    let netWorth = currentNetWorth
    let txIdx = 0
    const excluded = new Set<string>()
    const data: { month: string; netWorth: number }[] = []
    for (let i = 12; i >= 0; i--) {
      const boundary = boundaries[i].date
      while (txIdx < allTransactionsSorted.length && allTransactionsSorted[txIdx].date > boundary) {
        const tx = allTransactionsSorted[txIdx]
        const effect = convertedNetWorthEffect(tx, currency, rateTable)
        if (effect === null) excluded.add(tx.currency)
        else netWorth -= effect
        txIdx++
      }
      data.unshift({ month: boundaries[i].label, netWorth: Math.round(netWorth * 100) / 100 })
    }
    return { netWorthData: data, netWorthExcludedCurrencies: [...excluded].sort() }
  }, [accounts, allTransactionsSorted, convertToDefault, currency, rateTable])

  // ── Income vs Expenses trend (own lookback, independent of the cycle) ──
  const [lookback, setLookback] = useState<Lookback>(DEFAULT_LOOKBACK)
  const { monthlyData, monthlyExcludedCurrencies } = useMemo(() => {
    const excluded = new Set<string>()
    const monthlyData = getLookbackBuckets(lookback, new Date()).map((bucket) => {
      const { income, expenses, excludedCurrencies } = summarizeRange(transactions, bucket.start, countedEnd(bucket.end, today), currency, rateTable)
      for (const code of excludedCurrencies) excluded.add(code)
      return {
        month: bucket.label,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
      }
    })
    return { monthlyData, monthlyExcludedCurrencies: [...excluded].sort() }
  }, [transactions, lookback, currency, rateTable, today])

  // ── Spending by Merchant (top 10 from filtered period) ──
  const merchantBreakdown = (() => {
    const map = new Map<string, { displayName: string; amount: number; count: number }>()
    for (const t of counted) {
      if (t.type !== 'expense') continue
      const key = t.description.trim().toLowerCase()
      if (!key) continue
      const existing = map.get(key)
      if (existing) {
        existing.amount += t.amount * (t.exchange_rate ?? 1)
        existing.count++
      } else {
        map.set(key, { displayName: t.description.trim(), amount: t.amount * (t.exchange_rate ?? 1), count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 10)
  })()

  const activeAccounts = accounts.filter((a) => a.is_active)

  // Transaction table columns: all seven when there is room, session-only.
  const wide = useMediaQuery('(min-width: 768px)')
  const narrow = useMediaQuery('(max-width: 639px)')
  const [visibleColumns, setVisibleColumns] = useState(() => defaultColumns(wide))
  const columns = REPORT_COLUMNS.filter((c) => visibleColumns.has(c.key))
  const tableHead = (
    <thead className="sticky top-0 bg-card z-10">
      <tr className="border-b border-border/40">
        {columns.map((c) => (
          <th
            key={c.key}
            className={cn(
              'px-2 py-2.5 first:pl-4 last:pr-4 text-[0.6875rem] font-medium text-muted-foreground tracking-wide',
              RIGHT_ALIGNED.has(c.key) ? 'text-right' : 'text-left',
            )}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  )
  const balanceSummary = summarizeBalances(activeAccounts, currency, convertToDefault)
  const totalBalance = balanceSummary.netWorth
  // Stored balances already hold rows dated after today (LED-251). The chart's last point does not.
  const netWorthAfterScheduled = afterScheduledLabel(
    scheduledNetWorth(activeAccounts, transactions, today, currency, convertToDefault),
    currency,
    formatCurrency,
  )
  const netWorthSub = balanceSummary.totalCreditCardDebt > 0
    ? `Assets minus Liabilities`
    : `${activeAccounts.length} account${activeAccounts.length !== 1 ? 's' : ''}`

  // Sorted transactions for table (newest first)
  const sortedTransactions = [...filtered].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  )

  // Running balance per account, unwound from each account's live balance (src/lib/runningBalance.ts).
  const txBalanceMap = buildRunningBalanceMap(accounts, transactions)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:px-8 pb-24 md:pb-6">
      {loadFailed && !loading && (
        <InlineLoadError
          message="Some of your data didn't load, so these reports may be incomplete."
          onRetry={retryFailedSources}
        />
      )}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <PageActions>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap">
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-xs h-7 px-3">Overview</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs h-7 px-3">Analytics</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Link
                to="/thirteenth-month"
                aria-label="13th Month Pay"
                className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {/* 9a draws the short label below lg; the full name stays the accessible name. */}
                <span aria-hidden className="lg:hidden">13th Mo</span>
                <span aria-hidden className="hidden lg:inline">13th Month Pay</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={loading || filtered.length === 0}
                  render={
                    <Button variant="outline" size="sm" className="gap-2 shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      Export
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={handleExport}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPdf}>PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PageActions>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
          <OverspendingCard categories={categories} month={selectedMonth} report={overspending} />
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome, currency)}
          icon={TrendingUp}
          color={INCOME}
          sub={scheduledSub(scheduledTotals.income)}
          comparison={compare(totalIncome, previousTotals.income, 'up')}
          loading={loading}
          note={<UnratedCurrencyNotice currencies={[...new Set([...summaryExcludedCurrencies, ...scheduledTotals.excludedCurrencies])].sort()} subject="income and expenses" />}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses, currency)}
          icon={TrendingDown}
          color={EXPENSE}
          sub={scheduledSub(scheduledTotals.expenses)}
          comparison={compare(totalExpenses, previousTotals.expenses, 'down')}
          loading={loading}
          note={<UnratedCurrencyNotice currencies={[...new Set([...summaryExcludedCurrencies, ...scheduledTotals.excludedCurrencies])].sort()} subject="income and expenses" />}
        />
        <StatCard
          title="Net Change"
          value={formatCurrency(netChange, currency)}
          sub={netChange >= 0 && totalIncome > 0
            ? `Surplus · ${Math.round((netChange / totalIncome) * 100)}% of income kept`
            : netChange >= 0 ? 'Surplus' : 'Deficit'}
          icon={netChange >= 0 ? TrendingUp : TrendingDown}
          color={netChange >= 0 ? INCOME : EXPENSE}
          comparison={compare(netChange, previousTotals.net, 'up')}
          loading={loading}
        />
        <StatCard
          title="Net Worth"
          value={formatCurrency(totalBalance, currency)}
          sub={netWorthAfterScheduled ? `${netWorthSub} · ${netWorthAfterScheduled}` : netWorthSub}
          icon={Wallet}
          color={'var(--foreground)'}
          note={<UnratedCurrencyNotice currencies={balanceSummary.excludedCurrencies} subject="balances" />}
          comparison={loadFailed ? undefined : {
            text: netWorthChange === 0
              ? 'No change this cycle'
              : `${netWorthChange > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(netWorthChange), currency)} this cycle`,
            color: netWorthChange > 0 ? INCOME : netWorthChange < 0 ? EXPENSE : 'var(--muted-foreground)',
          }}
          loading={loading}
        />
        <StatCard
          title="Over budget"
          value={overspendingReady ? formatCurrency(overNow, currency) : '—'}
          sub={overspendingSub}
          icon={TriangleAlert}
          color={overNow > 0 ? 'var(--warning)' : 'var(--foreground)'}
          comparison={overspendingReady ? compare(overNow, overPrevious, 'down') : undefined}
          loading={overspending.state === 'loading'}
          note={<UnratedCurrencyNotice currencies={overspending.converted.excludedCurrencies} subject="overspending" />}
        />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
          {/* Income vs Expenses trend */}
          <IncomeExpenseCard
            data={monthlyData}
            lookback={lookback}
            onLookbackChange={setLookback}
            loading={loading}
            currency={currency}
            excludedCurrencies={monthlyExcludedCurrencies}
          />


        {/* Account balances */}
        <div className="order-3 lg:col-span-2 rounded-[20px] border border-border bg-card p-4 flex flex-col gap-3">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">Account Balances</p>
          {loading ? (
            <div className="flex flex-col gap-1" aria-hidden>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex h-5 items-center gap-2.5 min-w-0">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3.5 w-12" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : activeAccounts.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground text-center py-4">No accounts</p>
          ) : (
            <div className="flex flex-col gap-1">
              {activeAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: ink(acc.color) }}
                    />
                    <span className="text-[0.8125rem] font-medium truncate">{acc.name}</span>
                    <Badge variant="outline" className="text-[0.625rem] capitalize shrink-0 px-1.5 py-0">
                      {acc.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span
                    className="text-[0.8125rem] font-semibold tabular-nums shrink-0"
                    style={{ color: acc.balance < 0 ? EXPENSE : 'inherit' }}
                  >
                    {formatCurrency(acc.balance, acc.currency)}
                  </span>
                </div>
              ))}
              <Separator className="my-1" />
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Net</span>
                <span className="text-[0.8125rem] font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {formatCurrency(totalBalance, currency)}
                </span>
              </div>
              <div className="px-3">
                <UnratedCurrencyNotice currencies={balanceSummary.excludedCurrencies} subject="balances" />
              </div>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <CategoryBreakdownCard rows={categoryBreakdown} loading={loading} currency={currency} />
        {!loading && (
          <div className="px-3">
            <UnratedCurrencyNotice currencies={categoryExcludedCurrencies} />
          </div>
        )}
      </div>

      {/* Transactions table */}
      <div className="rounded-[20px] border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">
            Transactions
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Columns3 className="w-3.5 h-3.5" />
                    Columns
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                {REPORT_COLUMNS.filter((c) => !c.required).map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={visibleColumns.has(c.key)}
                    onCheckedChange={() => setVisibleColumns((prev) => toggleColumn(prev, c.key))}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <table className="w-full text-[0.8125rem]" aria-hidden>
            {tableHead}
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-3 first:pl-4 last:pr-4">
                      <div className={cn('flex h-5 items-center', RIGHT_ALIGNED.has(c.key) && 'justify-end')}>
                        <Skeleton className={cn('h-3', SKELETON_WIDTH[c.key])} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : transactions.length === 0 ? (
          <EmptyState icon={FileBarChart2} title="Nothing recorded yet" bare />
        ) : sortedTransactions.length === 0 ? (
          <EmptyState
            icon={FileBarChart2}
            title={`No transactions in ${rangeLabel}`}
            bare
            action={
              <Button variant="outline" size="sm" onClick={goToPreviousPeriod}>
                Try previous period
              </Button>
            }
          />
        ) : (
          <ScrollArea className="max-h-120" horizontal>
            <table className="w-full min-w-max text-[0.8125rem]">
              {tableHead}
              <tbody>
                {sortedTransactions.map((t, i) => {
                  const isIncome = t.type === 'income'
                  const isTransfer = t.type === 'transfer'
                  const amountColor = isIncome ? INCOME : isTransfer ? TRANSFER : EXPENSE
                  const sign = isIncome ? '+' : isTransfer ? '↔' : '−'
                  const cell = (key: ReportColumn) => {
                    switch (key) {
                      case 'date':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 text-muted-foreground whitespace-nowrap">
                            {formatDate(t.date)}
                            {!countsYet(t.date, today) && <span className="block text-[0.6875rem]">Scheduled</span>}
                          </td>
                        )
                      case 'description':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 max-w-40">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium truncate">{t.description}</span>
                              {!visibleColumns.has('category') && (
                                <span className="text-[0.6875rem] text-muted-foreground">
                                  {t.category?.name ?? '—'}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      case 'category':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 text-muted-foreground">
                            {t.category ? (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                  style={{ background: ink(t.category.color) }}
                                />
                                {t.category.name}
                              </span>
                            ) : '—'}
                          </td>
                        )
                      case 'account':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 text-muted-foreground">
                            {t.account?.name ?? '—'}
                            {t.type === 'transfer' && t.to_account && (
                              <span className="text-[0.6875rem]"> → {t.to_account.name}</span>
                            )}
                          </td>
                        )
                      case 'type':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 capitalize" style={{ color: amountColor }}>
                            {t.type}
                          </td>
                        )
                      case 'amount':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: amountColor }}>
                            {sign} {formatCurrency(t.amount, t.currency)}
                          </td>
                        )
                      case 'balance':
                        return (
                          <td key={key} className="px-2 py-3 first:pl-4 last:pr-4 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                            {txBalanceMap.has(t.id)
                              ? formatCurrency(txBalanceMap.get(t.id)!, t.account?.currency ?? t.currency)
                              : '—'}
                          </td>
                        )
                    }
                  }
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        'border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors',
                        i % 2 === 0 ? '' : 'bg-muted/10'
                      )}
                    >
                      {columns.map((c) => cell(c.key))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6 flex flex-col gap-6">

          {/* Net Worth Over Time */}
          <div className="rounded-[20px] border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: INCOME }} />
              <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">Net Worth Over Time — Last 13 months · monthly</p>
            </div>
            {!loading && <UnratedCurrencyNotice currencies={netWorthExcludedCurrencies} />}
            {loading ? (
              <div className="h-52 md:h-72 xl:h-80"><Skeleton className="h-full w-full rounded-lg" /></div>
            ) : (
              <div className="h-52 md:h-72 xl:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={netWorthData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                      tickLine={false}
                      axisLine={false}
                      // Below sm every other month, newest last, all of them shown (LED-204); from sm up the chart picks.
                      ticks={thinCategoryTicks(netWorthData.map((point) => point.month), narrow)}
                      interval={narrow ? 0 : undefined}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={abbreviateTick}
                      width={40}
                    />
                    <Tooltip
                      formatter={(v) => [formatCurrency(v as number, currency), 'Net Worth']}
                      contentStyle={{
                        fontSize: 11,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--foreground)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      stroke={INCOME}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: INCOME, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Income vs Expenses trend */}
          <IncomeExpenseCard
            data={monthlyData}
            lookback={lookback}
            onLookbackChange={setLookback}
            loading={loading}
            currency={currency}
            excludedCurrencies={monthlyExcludedCurrencies}
          />

          {/* Spending by Merchant */}
          <div className="rounded-[20px] border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5" style={{ color: EXPENSE }} />
                <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">Spending by Merchant</p>
              </div>
              <span className="text-[0.6875rem] text-muted-foreground">{rangeLabel}</span>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex h-4 items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[0.6875rem] tabular-nums text-muted-foreground w-4 text-right shrink-0">{i}</span>
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-3 w-14" />
                    </div>
                    <div className="h-1.5 rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : merchantBreakdown.length === 0 ? (
              <EmptyState icon={Store} title="No expense transactions in this period" bare />
            ) : (
              <div className="flex flex-col gap-2.5">
                {merchantBreakdown.map((merchant, i) => (
                  <div key={merchant.displayName + i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[0.6875rem] tabular-nums text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                        <span className="text-xs font-medium truncate">{merchant.displayName}</span>
                        <span className="text-[0.625rem] text-muted-foreground shrink-0 ml-0.5">{merchant.count}×</span>
                      </div>
                      <span className="text-xs tabular-nums shrink-0" style={{ color: EXPENSE }}>
                        {formatCurrency(merchant.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-(--dur-meter)"
                        style={{
                          width: `${(merchant.amount / merchantBreakdown[0].amount) * 100}%`,
                          background: EXPENSE,
                          opacity: 0.65,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </TabsContent>
      </Tabs>
    </div>
  )
}
