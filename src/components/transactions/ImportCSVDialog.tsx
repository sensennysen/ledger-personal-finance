import { useState, useCallback, useRef, useMemo } from 'react'
import { Upload, X, AlertCircle, AlertTriangle, Loader2, FileText, Copy, Filter } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useImportDuplicates } from '@/hooks/useImportDuplicates'
import { useRenderWindow } from '@/hooks/useRenderWindow'
import { duplicateSpan, matchDuplicates, type ExistingTx } from '@/lib/importDuplicates'
import {
  buildRows,
  EMPTY_DESCRIPTION,
  fixableByOtherOrder,
  groupProblems,
  importableRows,
  isProblem,
  isSkipped,
  processFile,
  rowIssues,
  sortProblemsFirst,
  summarise,
  type BankFormat,
  type CauseId,
  type DateOrder,
  type ParsedFile,
  type Severity,
} from '@/lib/csvImport'
import { WINDOW_STEP } from '@/lib/transactionWindow'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export interface ImportTx {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  account_id: string
  currency: string
  category_id: null
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

const toggled = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

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
  const [includedDupes, setIncludedDupes] = useState<Set<number>>(new Set())
  const [activeCause, setActiveCause] = useState<CauseId | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)

  const selectedAccount = accounts.find((account) => account.id === accountId)
  const currency = selectedAccount?.currency ?? 'PHP'

  const built = useMemo(
    () => (file ? buildRows(file.raw, file.headerIdx, file.format, dateOrder) : { rows: [], ignored: 0 }),
    [file, dateOrder],
  )
  const rows = built.rows
  const span = useMemo(() => duplicateSpan(rows), [rows])
  const dupeCheck = useImportDuplicates(accountId, span)
  const duplicates = useMemo(() => matchDuplicates(rows, dupeCheck.existing), [rows, dupeCheck.existing])

  const selection = { duplicates, skipped, includedDuplicates: includedDupes }
  const summary = summarise(rows, selection)
  const toImport = importableRows(rows, selection)
  const causes = useMemo(() => groupProblems(rows, duplicates), [rows, duplicates])
  const cause = causes.find((item) => item.id === activeCause) ?? causes[0]

  const listed = useMemo(() => {
    const sorted = sortProblemsFirst(rows, duplicates)
    return onlyProblems ? sorted.filter((row) => isProblem(row, duplicates)) : sorted
  }, [rows, duplicates, onlyProblems])
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
    setIncludedDupes(new Set())
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
        setIncludedDupes(new Set())
        setActiveCause(null)
        setOnlyProblems(false)
        if (!accountId && accounts.length > 0) {
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

  const blocked = summary.errors > 0 || dupeCheck.loading || Boolean(dupeCheck.error)

  const handleImport = async () => {
    if (!file || !accountId || !selectedAccount || blocked || toImport.length === 0) return
    setImporting(true)
    const txs: ImportTx[] = toImport.map((row) => ({
      date: row.date!,
      description: row.description || EMPTY_DESCRIPTION,
      amount: row.amount!,
      type: row.type!,
      account_id: accountId,
      currency: selectedAccount.currency,
      category_id: null,
    }))
    const result = await onImport(txs)
    setImporting(false)
    if (result.error) {
      setParseError(result.error)
    } else {
      setImportResult({ imported: result.imported, account: selectedAccount.name })
    }
  }

  const describeMatch = (match: ExistingTx) =>
    `${match.date} · ${match.description || EMPTY_DESCRIPTION} · ${formatCurrency(Number(match.amount), currency)}`

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
            <div className="w-14 h-14 rounded-full bg-[oklch(0.660_0.150_155/0.15)] flex items-center justify-center">
              <FileText className="w-7 h-7 text-income" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''} imported
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Added to <span className="font-medium">{importResult.account}</span>. You can
                bulk re-categorize them from the transactions list.
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

                <div className="space-y-1.5">
                  <Label>Import to account</Label>
                  <Select value={accountId} onValueChange={(value) => setAccountId(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
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

                {dupeCheck.error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="flex-1">Couldn't check for duplicates: {dupeCheck.error}</span>
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
                          onClick={() => setSkipped((current) => toggled(current, cause.id))}
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
                          <th className="w-8 px-2 py-2"><span className="sr-only">Import</span></th>
                          <th className="text-right px-2 py-2 font-medium text-xs text-muted-foreground">Row</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Description</th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listed.slice(0, rendered).map((row) => {
                          const issues = rowIssues(row, duplicates)
                          const match = duplicates.get(row.line)
                          return (
                            <tr
                              key={row.line}
                              className={cn('border-b last:border-0 hover:bg-muted/30', isSkipped(row, selection) && 'opacity-50')}
                            >
                              <td className="px-2 py-2 text-center">
                                {match && (
                                  <input
                                    type="checkbox"
                                    aria-label={`Import row ${row.line} anyway`}
                                    checked={includedDupes.has(row.line)}
                                    onChange={() => setIncludedDupes((current) => toggled(current, row.line))}
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
                              <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                                {issues.includes('bad-amount') ? (
                                  <span className="inline-flex items-center gap-1 text-destructive">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {row.rawAmount || '(empty)'}
                                  </span>
                                ) : (
                                  <span className={row.type === 'expense' ? 'text-expense' : 'text-income'}>
                                    {row.type === 'expense' ? '-' : '+'}
                                    {formatCurrency(row.amount ?? 0, currency)}
                                  </span>
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
                      {causes.length > 0 ? 'Showing problems first · ' : ''}
                      rows {firstShown}–{rendered.toLocaleString()} of {listed.length.toLocaleString()}
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

                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  Transactions will be imported uncategorized. Use bulk re-categorize after import to assign categories quickly.
                </p>
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
                  ) : summary.errors > 0 ? (
                    `Fix or skip ${plural(summary.errors, 'error row')}`
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
