import { useState, useMemo } from 'react'
import {
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileBarChart2,
  CalendarDays,
  Store,
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
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EMERALD, CORAL, GOLD } from '@/constants/colors'
import type { Transaction } from '@/types'
import ThirteenthMonthPage from '@/pages/ThirteenthMonthPage'

// ─── date helpers ─────────────────────────────────────────────────────────────

function localDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type Preset = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'this_year' | 'all_time' | 'custom'

function resolvePreset(preset: Preset): { start: string; end: string } {
  const now = new Date()
  const today = localDateStr(now)
  switch (preset) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: localDateStr(start), end: today }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: localDateStr(start), end: localDateStr(end) }
    }
    case 'last_3m': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { start: localDateStr(start), end: today }
    }
    case 'last_6m': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { start: localDateStr(start), end: today }
    }
    case 'this_year': {
      return { start: `${now.getFullYear()}-01-01`, end: today }
    }
    case 'all_time':
    case 'custom':
    default:
      return { start: '', end: '' }
  }
}

// ─── csv export ───────────────────────────────────────────────────────────────

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportToCsv(
  transactions: Transaction[],
  filename: string,
  balanceMap: Map<string, number>,
) {
  const headers = [
    'Date',
    'Type',
    'Description',
    'Category',
    'Account',
    'To Account',
    'Amount',
    'Currency',
    'Exchange Rate',
    'Transfer Fee',
    'Standing Balance',
    'Notes',
  ]

  const rows = transactions.map((t) => [
    t.date,
    t.type,
    t.description,
    t.category?.name ?? '',
    t.account?.name ?? t.account_id,
    t.to_account?.name ?? t.to_account_id ?? '',
    t.amount,
    t.currency,
    t.exchange_rate,
    t.transfer_fee ?? '',
    balanceMap.get(t.id) ?? '',
    t.notes ?? '',
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── pdf export ──────────────────────────────────────────────────────────────

function exportToPdf(
  transactions: Transaction[],
  totalIncome: number,
  totalExpenses: number,
  netChange: number,
  currency: string,
  dateRangeLabel: string,
  categoryBreakdown: { name: string; color: string; amount: number }[],
  merchantBreakdown: { displayName: string; amount: number; count: number }[],
  filenameLabel: string,
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
      body: categoryBreakdown.slice(0, 8).map((cat) => [
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
  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Category', 'Account', 'Amount']],
    body: transactions.map((t) => [
      t.date,
      t.description,
      t.category?.name ?? '—',
      t.account?.name ?? '—',
      `${t.type === 'income' ? '+' : t.type === 'transfer' ? '~' : '-'} ${pdfFmt(t.amount, t.currency)}`,

    ]),
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30 },
      3: { cellWidth: 32 },
      4: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  })

  doc.save(`expense-report_${filenameLabel}.pdf`)
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  loading,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  loading?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 p-5 bg-card">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: color, filter: 'blur(32px)', transform: 'translate(30%, -30%)' }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <p className="text-2xl font-bold tracking-tight truncate" style={{ color }}>
              {value}
            </p>
          )}
          {sub && !loading && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>
          )}
        </div>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ background: `${color.replace(')', ' / 0.12)')}`, boxShadow: `0 0 0 1px ${color.replace(')', ' / 0.20)')}` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'

  const { transactions, loading: txLoading } = useTransactions()
  const { accounts, loading: accLoading } = useAccounts()
  const { categories } = useCategories()

  const loading = txLoading || accLoading

  // Date range state
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start, end } = useMemo(() => {
    if (preset === 'custom') {
      // Guard against inverted ranges which would match nothing (or everything)
      if (customStart && customEnd && customStart > customEnd) {
        return { start: '', end: '' }
      }
      return { start: customStart, end: customEnd }
    }
    if (preset === 'all_time') {
      return { start: '', end: '' }
    }
    return resolvePreset(preset)
  }, [preset, customStart, customEnd])

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (start && t.date < start) return false
      if (end && t.date > end) return false
      return true
    })
  }, [transactions, start, end])

  // Summary stats
  const { totalIncome, totalExpenses, netChange } = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    for (const t of filtered) {
      if (t.type === 'income') totalIncome += t.amount * (t.exchange_rate ?? 1)
      else if (t.type === 'expense') totalExpenses += t.amount * (t.exchange_rate ?? 1)
    }
    return { totalIncome, totalExpenses, netChange: totalIncome - totalExpenses }
  }, [filtered])

  // Category breakdown (expenses only)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; color: string; amount: number }>()
    for (const t of filtered) {
      if (t.type !== 'expense') continue
      const key = t.category_id ?? '__none__'
      const cat = categories.find((c) => c.id === t.category_id)
      const existing = map.get(key)
      if (existing) {
        existing.amount += t.amount * (t.exchange_rate ?? 1)
      } else {
        map.set(key, {
          name: cat?.name ?? 'Uncategorized',
          color: cat?.color ?? '#888',
          amount: t.amount * (t.exchange_rate ?? 1),
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [filtered, categories])

  const maxCategoryAmount = categoryBreakdown[0]?.amount ?? 1

  // Date range label for filename
  const filenameLabel = useMemo(() => {
    if (preset === 'all_time') return 'all-time'
    if (start && end) return `${start}_to_${end}`
    if (start) return `from_${start}`
    return 'report'
  }, [preset, start, end])

  const handleExport = () => {
    exportToCsv(sortedTransactions, `ledger-report_${filenameLabel}.csv`, txBalanceMap)
  }

  const handleExportPdf = () => {
    exportToPdf(
      sortedTransactions,
      totalIncome,
      totalExpenses,
      netChange,
      currency,
      presetLabel,
      categoryBreakdown,
      merchantBreakdown,
      filenameLabel,
    )
  }

  // ── Net Worth Over Time (last 13 months) ──
  const netWorthData = useMemo(() => {
    const now = new Date()
    const currentNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0)
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
    const allSorted = [...transactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
    )
    let netWorth = currentNetWorth
    let txIdx = 0
    const data: { month: string; netWorth: number }[] = []
    for (let i = 12; i >= 0; i--) {
      const boundary = boundaries[i].date
      while (txIdx < allSorted.length && allSorted[txIdx].date > boundary) {
        const tx = allSorted[txIdx]
        if (tx.type === 'income') netWorth -= tx.amount
        else if (tx.type === 'expense') netWorth += tx.amount
        else if (tx.type === 'transfer') netWorth += (tx.transfer_fee ?? 0)
        txIdx++
      }
      data.unshift({ month: boundaries[i].label, netWorth: Math.round(netWorth * 100) / 100 })
    }
    return data
  }, [accounts, transactions])

  // ── Monthly Income vs Expenses (last 12 months) ──
  const monthlyData = useMemo(() => {
    const now = new Date()
    const result: { month: string; income: number; expenses: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = i === 0
        ? now
        : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const startStr = localDateStr(monthStart)
      const endStr = localDateStr(monthEnd)
      const label = monthStart.getFullYear() !== now.getFullYear()
        ? monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : monthStart.toLocaleDateString('en-US', { month: 'short' })
      let income = 0
      let expenses = 0
      for (const t of transactions) {
        if (t.date < startStr || t.date > endStr) continue
        if (t.type === 'income') income += t.amount * (t.exchange_rate ?? 1)
        else if (t.type === 'expense') expenses += t.amount * (t.exchange_rate ?? 1)
      }
      result.push({
        month: label,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
      })
    }
    return result
  }, [transactions])

  // ── Spending by Merchant (top 10 from filtered period) ──
  const merchantBreakdown = useMemo(() => {
    const map = new Map<string, { displayName: string; amount: number; count: number }>()
    for (const t of filtered) {
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
  }, [filtered])

  const activeAccounts = accounts.filter((a) => a.is_active)
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)

  const presetLabel = {
    this_month: 'This Month',
    last_month: 'Last Month',
    last_3m: 'Last 3 Months',
    last_6m: 'Last 6 Months',
    this_year: 'This Year',
    all_time: 'All Time',
    custom: 'Custom Range',
  }[preset]

  // Sorted transactions for table (newest first)
  const sortedTransactions = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [filtered]
  )

  // Running balance per account, derived by unwinding all transactions newest→oldest
  // starting from each account's current live balance.
  const txBalanceMap = useMemo(() => {
    // Build a mutable balance register from current account balances
    const register = new Map<string, number>()
    for (const acc of accounts) register.set(acc.id, acc.balance)

    // Sort ALL transactions newest first to unwind correctly
    const allSorted = [...transactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
    )

    const map = new Map<string, number>()
    for (const tx of allSorted) {
      // Record the account balance *after* this transaction
      if (register.has(tx.account_id)) {
        map.set(tx.id, register.get(tx.account_id)!)
      }
      // Undo the effect of this transaction to step backwards in time
      if (tx.type === 'income') {
        register.set(tx.account_id, (register.get(tx.account_id) ?? 0) - tx.amount)
      } else if (tx.type === 'expense') {
        register.set(tx.account_id, (register.get(tx.account_id) ?? 0) + tx.amount)
      } else if (tx.type === 'transfer') {
        register.set(tx.account_id, (register.get(tx.account_id) ?? 0) + tx.amount + (tx.transfer_fee ?? 0))
        if (tx.to_account_id) {
          register.set(tx.to_account_id, (register.get(tx.to_account_id) ?? 0) - tx.amount)
        }
      }
    }
    return map
  }, [transactions, accounts])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
      <Tabs defaultValue="overview">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
              style={{
                background: `${GOLD.replace(')', ' / 0.12)')}`,
                boxShadow: `0 0 0 1px ${GOLD.replace(')', ' / 0.20)')}`,
              }}
            >
              <FileBarChart2 className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
              <p className="text-[12px] text-muted-foreground">{presetLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-[12px] h-7 px-3">Overview</TabsTrigger>
              <TabsTrigger value="analytics" className="text-[12px] h-7 px-3">Analytics</TabsTrigger>
              <TabsTrigger value="thirteenth" className="text-[12px] h-7 px-3">13th Month</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExport}
                disabled={loading || filtered.length === 0}
                size="sm"
                className="gap-2 text-[12px] font-medium shrink-0"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.700 0.115 72 / 0.15), oklch(0.700 0.115 72 / 0.08))',
                  border: '1px solid oklch(0.700 0.115 72 / 0.30)',
                  color: GOLD,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={loading || filtered.length === 0}
                size="sm"
                className="gap-2 text-[12px] font-medium shrink-0"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.620 0.160 18 / 0.15), oklch(0.620 0.160 18 / 0.08))',
                  border: '1px solid oklch(0.620 0.160 18 / 0.30)',
                  color: CORAL,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
      {/* Date controls */}
      <div
        className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Date Range</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['this_month', 'This Month'],
            ['last_month', 'Last Month'],
            ['last_3m', 'Last 3 Months'],
            ['last_6m', 'Last 6 Months'],
            ['this_year', 'This Year'],
            ['all_time', 'All Time'],
            ['custom', 'Custom'],
          ] as [Preset, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide border transition-all duration-150',
                preset === p
                  ? 'border-transparent'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
              )}
              style={preset === p ? { background: GOLD, color: 'oklch(0.15 0 0)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] text-muted-foreground">From</Label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-40 text-[13px] h-8"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] text-muted-foreground">To</Label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-40 text-[13px] h-8"
              />
            </div>
            {customStart && customEnd && customStart > customEnd && (
              <p className="self-end pb-1 text-xs text-destructive">
                Start date must be on or before end date.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome, currency)}
          icon={TrendingUp}
          color={EMERALD}
          loading={loading}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses, currency)}
          icon={TrendingDown}
          color={CORAL}
          loading={loading}
        />
        <StatCard
          title="Net Change"
          value={formatCurrency(netChange, currency)}
          sub={netChange >= 0 ? 'Surplus' : 'Deficit'}
          icon={netChange >= 0 ? TrendingUp : TrendingDown}
          color={netChange >= 0 ? EMERALD : CORAL}
          loading={loading}
        />
        <StatCard
          title="Total Balance"
          value={formatCurrency(totalBalance, currency)}
          sub={`${activeAccounts.length} account${activeAccounts.length !== 1 ? 's' : ''}`}
          icon={Wallet}
          color={GOLD}
          loading={loading}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Account balances */}
        <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Account Balances</p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : activeAccounts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No accounts</p>
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
                      style={{ background: acc.color }}
                    />
                    <span className="text-[13px] font-medium truncate">{acc.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 px-1.5 py-0">
                      {acc.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span
                    className="text-[13px] font-semibold tabular-nums shrink-0"
                    style={{ color: acc.balance < 0 ? CORAL : 'inherit' }}
                  >
                    {formatCurrency(acc.balance, acc.currency)}
                  </span>
                </div>
              ))}
              <Separator className="my-1" />
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Total</span>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: GOLD }}>
                  {formatCurrency(totalBalance, currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Expenses by Category
          </p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : categoryBreakdown.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No expenses in this period</p>
          ) : (
            <ScrollArea className="max-h-56">
              <div className="flex flex-col gap-2 pr-3">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                        <span className="text-[12px] font-medium truncate">{cat.name}</span>
                      </div>
                      <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">
                        {formatCurrency(cat.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(cat.amount / maxCategoryAmount) * 100}%`,
                          background: cat.color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Transactions table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Transactions
          </p>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : sortedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FileBarChart2 className="w-8 h-8 opacity-30" />
            <p className="text-[13px]">No transactions in this period</p>
          </div>
        ) : (
          <ScrollArea className="max-h-120">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Date</th>
                  <th className="text-left px-2 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Description</th>
                  <th className="hidden sm:table-cell text-left px-2 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Category</th>
                  <th className="hidden md:table-cell text-left px-2 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Account</th>
                  <th className="text-right px-2 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Amount</th>
                  <th className="hidden lg:table-cell text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((t, i) => {
                  const isIncome = t.type === 'income'
                  const isTransfer = t.type === 'transfer'
                  const amountColor = isIncome ? EMERALD : isTransfer ? GOLD : CORAL
                  const sign = isIncome ? '+' : isTransfer ? '↔' : '−'
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        'border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors',
                        i % 2 === 0 ? '' : 'bg-muted/10'
                      )}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-2 py-3 max-w-40">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium truncate">{t.description}</span>
                          <span className="text-[11px] text-muted-foreground sm:hidden">
                            {t.category?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">
                        {t.category ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                              style={{ background: t.category.color }}
                            />
                            {t.category.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="hidden md:table-cell px-2 py-3 text-muted-foreground">
                        {t.account?.name ?? '—'}
                        {t.type === 'transfer' && t.to_account && (
                          <span className="text-[11px]"> → {t.to_account.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: amountColor }}>
                        {sign} {formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                        {txBalanceMap.has(t.id)
                          ? formatCurrency(txBalanceMap.get(t.id)!, t.account?.currency ?? t.currency)
                          : '—'}
                      </td>
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
          <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: EMERALD }} />
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Net Worth Over Time</p>
            </div>
            {loading ? (
              <div className="h-52"><div className="h-full w-full rounded-lg bg-muted animate-pulse" /></div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={netWorthData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
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
                      tickFormatter={(v: number) => formatCurrency(v, currency)}
                      width={72}
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
                      stroke={EMERALD}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: EMERALD, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Monthly Income vs Expenses */}
          <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileBarChart2 className="w-3.5 h-3.5" style={{ color: GOLD }} />
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Monthly Income vs. Expenses — Last 12 Months</p>
            </div>
            {loading ? (
              <div className="h-52"><div className="h-full w-full rounded-lg bg-muted animate-pulse" /></div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
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
                      tickFormatter={(v: number) => formatCurrency(v, currency)}
                      width={72}
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
                    <Bar dataKey="income" name="Income" fill={EMERALD} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill={CORAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Spending by Merchant */}
          <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5" style={{ color: CORAL }} />
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Spending by Merchant</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{presetLabel}</span>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : merchantBreakdown.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-6">No expense transactions in this period</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {merchantBreakdown.map((merchant, i) => (
                  <div key={merchant.displayName + i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] tabular-nums text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                        <span className="text-[12px] font-medium truncate">{merchant.displayName}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-0.5">{merchant.count}×</span>
                      </div>
                      <span className="text-[12px] tabular-nums shrink-0" style={{ color: CORAL }}>
                        {formatCurrency(merchant.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(merchant.amount / merchantBreakdown[0].amount) * 100}%`,
                          background: CORAL,
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

        <TabsContent value="thirteenth" className="mt-0 -mx-4 md:-mx-6">
          <ThirteenthMonthPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
