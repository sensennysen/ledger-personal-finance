import { useState, useCallback, useRef, useMemo } from 'react'
import { Upload, X, AlertCircle, AlertTriangle, Loader2, FileText, Copy, Filter, ArrowLeftRight } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useImportCategoryMemory } from '@/hooks/useImportCategoryMemory'
import { useImportDuplicates } from '@/hooks/useImportDuplicates'
import { useRenderWindow } from '@/hooks/useRenderWindow'
import { duplicateSpan, matchDuplicates, type ExistingTx } from '@/lib/importDuplicates'
import {
  buildRows,
  EMPTY_DESCRIPTION,
  fixableByOtherOrder,
  groupProblems,
  hasError,
  importableRows,
  isProblem,
  isSelectable,
  isSelected,
  isSkipped,
  processFile,
  rowIssues,
  selectAll,
  sortProblemsFirst,
  summarise,
  withCategoryIssues,
  type BankFormat,
  type CauseId,
  type DateOrder,
  type ParsedFile,
  type Severity,
} from '@/lib/csvImport'
import { suggestCategory, type Suggestion } from '@/lib/importCategories'
import { convertAmount, currencyState, effectiveRate } from '@/lib/importCurrency'
import { looksLikeTransfer, transferCandidates, transferLegs } from '@/lib/importTransfer'
import { WINDOW_STEP } from '@/lib/transactionWindow'
import { CURRENCIES } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TechnicalDetail } from '@/components/ui/technical-detail'

export interface ImportTx {
  date: string
  description: string
  /** In the account's currency, converted when the statement's differs. */
  amount: number
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  to_account_id: string | null
  currency: string
  category_id: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (txs: ImportTx[]) => Promise<{ imported: number; error: string | null }>
}

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024

const FORMAT_LABELS: Record<BankFormat, string> = {
  BDO: 'BDO',
  BPI: 'BPI',
  Metrobank: 'Metrobank',
  Generic: 'Generic CSV',
}

const SEVERITY_ICON: Record<Severity, { icon: typeof AlertCircle; className: string }> = {
  error: { icon: AlertCircle, className: 'text-destructive' },
  warning: { icon: AlertTriangle, className: 'text-muted-foreground' },
  duplicate: { icon: Copy, className: 'text-muted-foreground' },
}

const ORDER_LABELS: Record<DateOrder, string> = { DMY: 'D/M/Y', MDY: 'M/D/Y' }

const flip = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// The row's Category control holds a category or a transfer: `cat:<id>`,
// `to:<account id>`, or NO_CATEGORY.
const NO_CATEGORY = 'none'

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count !== 1 ? 's' : ''}`

export function ImportCSVDialog({ open, onOpenChange, onImport }: Props) {
  const { accounts } = useAccounts()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [dateOrder, setDateOrder] = useState<DateOrder>('MDY')
  const [parseError, setParseError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; account: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [skipped, setSkipped] = useState<Set<CauseId>>(new Set())
  const [toggled, setToggled] = useState<Set<number>>(new Set())
  const [transfers, setTransfers] = useState<Map<number, string>>(new Map())
  /** Categories the user chose; '' means they chose none. */
  const [picks, setPicks] = useState<Map<number, string>>(new Map())
  const [pickedCurrency, setPickedCurrency] = useState('')
  const [rateInput, setRateInput] = useState('')
  const [activeCause, setActiveCause] = useState<CauseId | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)

  const { categories } = useCategories()
  const categoryMemory = useImportCategoryMemory(file ? fileKey : null)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const selectedAccount = accounts.find((account) => account.id === accountId)
  const accountCurrency = selectedAccount?.currency ?? ''
  const statementCurrency = pickedCurrency || accountCurrency
  const conversion = currencyState(statementCurrency, accountCurrency, rateInput)
  const rate = effectiveRate(conversion)
  const candidates = selectedAccount ? transferCandidates(accounts, selectedAccount) : []

  const built = useMemo(
    () => (file ? buildRows(file.raw, file.headerIdx, file.format, dateOrder) : { rows: [], ignored: 0 }),
    [file, dateOrder],
  )
  const span = useMemo(() => duplicateSpan(built.rows), [built.rows])
  const dupeCheck = useImportDuplicates(accountId, span)
  // Compare in the account's currency: that's what the existing rows are in.
  const duplicates = matchDuplicates(
    built.rows.map((row) => (row.amount === null ? row : { ...row, amount: convertAmount(row.amount, rate) })),
    dupeCheck.existing,
    accountId,
  )
  const suggestions = new Map<number, Suggestion>()
  const uncategorised = new Set<number>()
  for (const row of built.rows) {
    if (row.type === null || transfers.has(row.line)) continue
    // Rows that stay out anyway (an error, or already in Ledger) aren't flagged.
    const leftOut = hasError(row.issues) || (duplicates.has(row.line) && !toggled.has(row.line))
    const suggestion = suggestCategory(row, categoryMemory.rules, categoryMemory.memory, categoryById)
    if (suggestion) suggestions.set(row.line, suggestion)
    else if (!leftOut && !picks.has(row.line) && !categoryMemory.loading) uncategorised.add(row.line)
  }
  const rows = withCategoryIssues(built.rows, uncategorised)
  const categoryOf = (line: number): string | null => {
    const pick = picks.get(line)
    return pick !== undefined ? pick || null : (suggestions.get(line)?.categoryId ?? null)
  }

  const selection = { duplicates, skipped, toggled }
  const summary = summarise(rows, selection)
  const toImport = importableRows(rows, selection)
  const causes = groupProblems(rows, duplicates)
  const cause = causes.find((item) => item.id === activeCause) ?? causes[0]

  const sorted = sortProblemsFirst(rows, duplicates)
  const listed = onlyProblems ? sorted.filter((row) => isProblem(row, duplicates)) : sorted
  const { rendered, sentinelRef } = useRenderWindow(listed.length, {
    step: WINDOW_STEP.desktop,
    resetKey: `${fileKey}|${onlyProblems}|${dateOrder}`,
  })

  const reset = () => {
    setFile(null)
    setParseError(null)
    setAccountId('')
    setImportResult(null)
    setSkipped(new Set())
    setToggled(new Set())
    setTransfers(new Map())
    setPicks(new Map())
    setPickedCurrency('')
    setRateInput('')
    setActiveCause(null)
    setOnlyProblems(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = useCallback(
    (picked: File) => {
      if (picked.size === 0) {
        setParseError('Empty files cannot be imported.')
        return
      }
      if (!picked.name.match(/\.(csv|txt)$/i)) {
        setParseError('Please upload a CSV file (.csv or .txt).')
        return
      }
      if (picked.size > MAX_IMPORT_FILE_SIZE) {
        setParseError('File too large. Maximum import size is 5 MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = String(event.target?.result ?? '')
        const result = processFile(text)
        if ('error' in result) {
          setParseError(result.error)
          setFile(null)
          return
        }

        setFile(result)
        setFileKey((key) => key + 1)
        setDateOrder(result.dateOrder)
        setParseError(null)
        setSkipped(new Set())
        setToggled(new Set())
        setTransfers(new Map())
        setPicks(new Map())
        setActiveCause(null)
        setOnlyProblems(false)
        // Only an unambiguous target is picked for the user (LED-75).
        if (!accountId && accounts.length === 1) {
          setAccountId(accounts[0].id)
        }
      }
      reader.readAsText(picked)
    },
    [accountId, accounts],
  )

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (picked) handleFile(picked)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const picked = event.dataTransfer.files[0]
    if (picked) handleFile(picked)
  }

  const changeAccount = (id: string) => {
    setAccountId(id)
    // Transfer counterparts depend on the account; its own rows can't be one.
    setTransfers(new Map())
  }

  const setKind = (line: number, value: string) => {
    const transferTo = value.startsWith('to:') ? value.slice(3) : null
    setTransfers((current) => {
      const next = new Map(current)
      if (transferTo) next.set(line, transferTo)
      else next.delete(line)
      return next
    })
    if (!transferTo) {
      setPicks((current) => new Map(current).set(line, value.startsWith('cat:') ? value.slice(4) : ''))
    }
  }

  const needsRate = conversion.kind === 'needs-rate'
  const blocked =
    summary.errors > 0 || dupeCheck.loading || Boolean(dupeCheck.error) || needsRate || categoryMemory.loading
  const selectableRows = rows.filter((row) => isSelectable(row, selection))
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => isSelected(row, selection))

  const handleImport = async () => {
    if (!file || !accountId || !selectedAccount || blocked || toImport.length === 0) return
    setImporting(true)
    const txs: ImportTx[] = toImport.map((row) => {
      const base = {
        date: row.date!,
        description: row.description || EMPTY_DESCRIPTION,
        amount: convertAmount(row.amount!, rate),
        currency: selectedAccount.currency,
      }
      const other = transfers.get(row.line)
      return other
        ? { ...base, type: 'transfer', category_id: null, ...transferLegs(row.type!, accountId, other) }
        : { ...base, type: row.type!, account_id: accountId, to_account_id: null, category_id: categoryOf(row.line) }
    })
    const result = await onImport(txs)
    setImporting(false)
    if (result.error) {
      setParseError(result.error)
    } else {
      setImportResult({ imported: result.imported, account: selectedAccount.name })
    }
  }

  const accountName = (id: string | null) => accounts.find((account) => account.id === id)?.name ?? 'another account'

  const describeMatch = (match: ExistingTx) => {
    if (match.type === 'transfer') {
      const inbound = match.account_id !== accountId
      const amount = Number(match.amount) * (inbound ? Number(match.exchange_rate ?? 1) : 1)
      return `${match.date} · transfer ${inbound ? `from ${accountName(match.account_id)}` : `to ${accountName(match.to_account_id)}`} · ${formatCurrency(amount, accountCurrency)}`
    }
    return `${match.date} · ${match.description || EMPTY_DESCRIPTION} · ${formatCurrency(Number(match.amount), accountCurrency)}`
  }

  const firstShown = listed.length > 0 ? 1 : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import from CSV
          </DialogTitle>
        </DialogHeader>

        {importResult ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-income-container flex items-center justify-center">
              <FileText className="w-7 h-7 text-income" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''} imported
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Added to <span className="font-medium">{importResult.account}</span>.
              </p>
            </div>
            <Button
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!file && (
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Drop your CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports BDO, BPI, Metrobank, and standard CSV exports
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {file && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{FORMAT_LABELS[file.format]}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {plural(rows.length, 'row')} parsed
                      {built.ignored > 0 && ` · ${plural(built.ignored, 'balance or zero line')} ignored`}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 h-7">
                    <X className="w-3.5 h-3.5" />
                    Change file
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <div className="space-y-1.5">
                    <Label htmlFor="import-account">Import to</Label>
                    <Select value={accountId} onValueChange={(value) => changeAccount(value ?? '')}>
                      <SelectTrigger id="import-account" className="w-full">
                        <SelectValue placeholder="Choose an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-currency">Statement currency</Label>
                    <Select
                      value={statementCurrency}
                      onValueChange={(value) => setPickedCurrency(value ?? '')}
                      disabled={!selectedAccount}
                    >
                      <SelectTrigger id="import-currency" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((item) => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!selectedAccount && (
                  <p className="text-xs text-muted-foreground">
                    Choose the account this statement belongs to. Nothing is imported until you do.
                  </p>
                )}

                {conversion.kind !== 'same' && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-container px-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-warning" />
                    <span className="flex-1 min-w-48">
                      Statement is in {statementCurrency}; {selectedAccount?.name} is in {accountCurrency}. Amounts
                      convert at the rate you enter.
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      1 {statementCurrency} =
                      <Input
                        inputMode="decimal"
                        value={rateInput}
                        onChange={(event) => setRateInput(event.target.value)}
                        aria-label={`${accountCurrency} per ${statementCurrency}`}
                        aria-invalid={needsRate && rateInput !== ''}
                        placeholder="Rate"
                        className="h-7 w-24 text-right tabular-nums"
                      />
                      {accountCurrency}
                    </label>
                  </div>
                )}

                {categoryMemory.error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p>
                        Couldn't load category suggestions. {categoryMemory.error} Rows import uncategorized unless you
                        choose one.
                      </p>
                      {categoryMemory.errorDetail && <TechnicalDetail detail={categoryMemory.errorDetail} className="mt-1" />}
                    </div>
                    <Button variant="outline" size="sm" className="h-7" onClick={categoryMemory.retry}>
                      Retry
                    </Button>
                  </div>
                )}

                {dupeCheck.error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p>Couldn't check for duplicates. {dupeCheck.error}</p>
                      {dupeCheck.errorDetail && <TechnicalDetail detail={dupeCheck.errorDetail} className="mt-1" />}
                    </div>
                    <Button variant="outline" size="sm" className="h-7" onClick={dupeCheck.retry}>
                      Retry
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg border bg-border overflow-hidden">
                  {[
                    { label: 'Ready', value: summary.ready.toLocaleString(), tone: '' },
                    { label: 'Errors · blocks import', value: summary.errors.toLocaleString(), tone: summary.errors > 0 ? 'text-destructive' : '' },
                    { label: 'Warnings · imports anyway', value: summary.warnings.toLocaleString(), tone: '' },
                    { label: 'Likely duplicates', value: dupeCheck.loading ? '…' : dupeCheck.error ? '—' : summary.duplicates.toLocaleString(), tone: '' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-popover px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                      <p className={cn('text-xl font-semibold tabular-nums mt-0.5', stat.tone)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {cause && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_1fr] rounded-lg border p-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Problems by cause</p>
                      {causes.map((item) => {
                        const { icon: Icon, className } = SEVERITY_ICON[item.severity]
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={item.id === cause.id}
                            onClick={() => setActiveCause(item.id)}
                            className={cn(
                              'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
                              item.id === cause.id ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                            )}
                          >
                            <Icon className={cn('w-3.5 h-3.5 shrink-0', className)} />
                            <span className={cn('flex-1 truncate', skipped.has(item.id) && 'line-through text-muted-foreground')}>
                              {item.label}
                            </span>
                            <span className="tabular-nums text-muted-foreground">{item.lines.length.toLocaleString()}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="space-y-2 text-sm sm:border-l sm:pl-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {cause.severity === 'duplicate'
                          ? `${plural(cause.lines.length, 'row')} already in Ledger`
                          : `Fix all ${cause.lines.length.toLocaleString()} at once`}
                      </p>

                      {cause.id === 'bad-date' && (
                        <>
                          <p className="text-muted-foreground">
                            Dates in these rows read <code className="text-foreground">{cause.sample || '(empty)'}</code>.
                            {' '}Parse every slash date in the file as
                          </p>
                          <div className="inline-flex rounded-full border p-0.5">
                            {(['DMY', 'MDY'] as DateOrder[]).map((order) => (
                              <button
                                key={order}
                                type="button"
                                aria-pressed={dateOrder === order}
                                onClick={() => setDateOrder(order)}
                                className={cn(
                                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                                  dateOrder === order ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {ORDER_LABELS[order]}
                              </button>
                            ))}
                          </div>
                          {fixableByOtherOrder(rows, dateOrder) === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Switching the order won't fix these. Correct the dates in the file, or skip these rows.
                            </p>
                          )}
                        </>
                      )}

                      {cause.id === 'bad-amount' && (
                        <p className="text-muted-foreground">
                          Amounts in these rows read <code className="text-foreground">{cause.sample || '(empty)'}</code>.
                          Correct them in the file, or skip these rows.
                        </p>
                      )}

                      {cause.id === 'no-category' && (
                        <p className="text-muted-foreground">
                          No rule or past transaction matches these payees. Choose a category in the table, or they
                          import uncategorized.
                        </p>
                      )}

                      {cause.id === 'empty-description' && (
                        <p className="text-muted-foreground">These rows import as “{EMPTY_DESCRIPTION}”.</p>
                      )}

                      {cause.id === 'duplicate' ? (
                        <p className="text-muted-foreground">
                          Skipped unless you tick a row below to import it anyway.
                        </p>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setSkipped((current) => flip(current, cause.id))}
                        >
                          {skipped.has(cause.id) ? 'Import these rows again' : 'Skip these rows'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="w-8 px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              aria-label="Select every row that can be imported"
                              checked={allSelected}
                              disabled={selectableRows.length === 0}
                              onChange={() => setToggled(selectAll(rows, selection, !allSelected))}
                            />
                          </th>
                          <th className="text-right px-2 py-2 font-medium text-xs text-muted-foreground">Row</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Description</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Category</th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listed.slice(0, rendered).map((row) => {
                          const issues = rowIssues(row, duplicates)
                          const match = duplicates.get(row.line)
                          const selectable = isSelectable(row, selection)
                          const selected = isSelected(row, selection)
                          const transferTo = transfers.get(row.line)
                          const suggestTransfer = !transferTo && looksLikeTransfer(row.description, categoryMemory.rules)
                          const categoryId = categoryOf(row.line)
                          const category = categoryId ? categoryById.get(categoryId) : undefined
                          const auto = Boolean(category) && !picks.has(row.line)
                          const fitting = categories.filter((item) => item.type === row.type || item.type === 'both')
                          return (
                            <tr
                              key={row.line}
                              className={cn(
                                'border-b last:border-0 hover:bg-muted/30',
                                (isSkipped(row, selection) || (selectable && !selected)) && 'opacity-50',
                              )}
                            >
                              <td className="px-2 py-2 text-center">
                                {selectable && (
                                  <input
                                    type="checkbox"
                                    aria-label={match ? `Import row ${row.line} anyway` : `Import row ${row.line}`}
                                    checked={selected}
                                    onChange={() => setToggled((current) => flip(current, row.line))}
                                  />
                                )}
                              </td>
                              <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{row.line}</td>
                              <td className="px-3 py-2 text-xs whitespace-nowrap">
                                {issues.includes('bad-date') ? (
                                  <span className="flex items-center gap-1 text-destructive">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {row.rawDate || '(empty)'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{row.date}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 max-w-72">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {match && <Copy className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                                  {issues.includes('empty-description') ? (
                                    <span className="flex items-center gap-1 italic text-muted-foreground">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                      {EMPTY_DESCRIPTION}
                                    </span>
                                  ) : (
                                    <span className="truncate">{row.description}</span>
                                  )}
                                  {match && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">already in Ledger</Badge>
                                  )}
                                </span>
                                {match && (
                                  <span className="block text-xs text-muted-foreground truncate">
                                    Matches {describeMatch(match)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.type !== null ? (
                                  <Select
                                    value={transferTo ? `to:${transferTo}` : categoryId ? `cat:${categoryId}` : NO_CATEGORY}
                                    onValueChange={(value) => setKind(row.line, value ?? NO_CATEGORY)}
                                  >
                                    <SelectTrigger
                                      size="sm"
                                      aria-label={`Row ${row.line} category`}
                                      className={cn(
                                        'h-7 w-auto max-w-48 text-xs',
                                        !transferTo && !category && 'border-dashed text-muted-foreground',
                                      )}
                                    >
                                      <SelectValue>
                                        {() =>
                                          transferTo ? (
                                            <span className="inline-flex items-center gap-1">
                                              <ArrowLeftRight className="w-3 h-3" />
                                              {row.type === 'expense' ? 'To' : 'From'} {accountName(transferTo)}
                                            </span>
                                          ) : category ? (
                                            <span className="inline-flex items-center gap-1.5 min-w-0">
                                              <span className="truncate">{category.name}</span>
                                              {auto && <span className="text-[10px] text-muted-foreground">auto</span>}
                                            </span>
                                          ) : suggestTransfer && candidates.length > 0 ? (
                                            'Make a transfer?'
                                          ) : (
                                            'Choose…'
                                          )
                                        }
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                                      {fitting.length > 0 && (
                                        <SelectGroup>
                                          <SelectLabel>Categories</SelectLabel>
                                          {fitting.map((item) => (
                                            <SelectItem key={item.id} value={`cat:${item.id}`}>
                                              {item.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      )}
                                      {candidates.length > 0 && (
                                        <>
                                          <SelectSeparator />
                                          <SelectGroup>
                                            <SelectLabel>Transfer</SelectLabel>
                                            {candidates.map((account) => (
                                              <SelectItem key={account.id} value={`to:${account.id}`}>
                                                {row.type === 'expense' ? 'Transfer to' : 'Transfer from'} {account.name}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                                {issues.includes('bad-amount') ? (
                                  <span className="inline-flex items-center gap-1 text-destructive">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {row.rawAmount || '(empty)'}
                                  </span>
                                ) : (
                                  <>
                                    <span className={cn('block', transferTo ? 'text-foreground' : row.type === 'expense' ? 'text-expense' : 'text-income')}>
                                      {row.type === 'expense' ? '-' : '+'}
                                      {statementCurrency
                                        ? formatCurrency(row.amount ?? 0, statementCurrency)
                                        : (row.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {conversion.kind === 'ok' && (
                                      <span className="block text-xs font-normal text-muted-foreground">
                                        {formatCurrency(convertAmount(row.amount ?? 0, rate), accountCurrency)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div ref={sentinelRef} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {summary.ready.toLocaleString()} of {rows.length.toLocaleString()} selected
                      </span>
                      {summary.excludedDuplicates > 0 && ` · ${plural(summary.excludedDuplicates, 'duplicate')} skipped`}
                      {' · '}
                      {causes.length > 0 ? 'problems first · ' : ''}
                      showing {firstShown}–{rendered.toLocaleString()} of {listed.length.toLocaleString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('gap-1.5 h-7', onlyProblems && 'text-foreground bg-muted')}
                      aria-pressed={onlyProblems}
                      disabled={causes.length === 0}
                      onClick={() => setOnlyProblems((value) => !value)}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Only problems
                    </Button>
                  </div>
                </div>

              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Cancel
              </Button>
              {file && (
                <Button onClick={handleImport} disabled={!accountId || importing || blocked || toImport.length === 0}>
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Importing...
                    </>
                  ) : dupeCheck.loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Checking for duplicates...
                    </>
                  ) : categoryMemory.loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Matching categories...
                    </>
                  ) : summary.errors > 0 ? (
                    `Fix or skip ${plural(summary.errors, 'error row')}`
                  ) : !selectedAccount ? (
                    'Choose an account'
                  ) : needsRate ? (
                    'Enter an exchange rate'
                  ) : (
                    `Import ${plural(toImport.length, 'row')}`
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
