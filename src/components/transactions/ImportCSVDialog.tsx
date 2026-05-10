import { useState, useCallback, useRef } from 'react'
import { Upload, X, AlertCircle, Loader2, FileText } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { formatCurrency } from '@/lib/utils'
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

type BankFormat = 'BDO' | 'BPI' | 'Metrobank' | 'Generic'

interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 5000
const PREVIEW_ROW_COUNT = 8

function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    const next = normalized[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if (ch === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += ch
  }

  if (inQuotes) {
    throw new Error('The CSV file has an unmatched quote. Please export the file again and retry.')
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

function findHeaderRowIndex(rows: string[][]): number {
  const keywords = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'remarks', 'particulars']
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i].map((cell) => cell.toLowerCase())
    const matches = keywords.filter((keyword) => row.some((cell) => cell.includes(keyword))).length
    if (matches >= 2) return i
  }
  return -1
}

function detectFormat(headers: string[]): BankFormat {
  const normalized = headers.map((cell) => cell.toLowerCase().trim())
  const has = (term: string) => normalized.some((cell) => cell.includes(term))
  if (has('post date') || has('ref. no') || has('reference no')) return 'Metrobank'
  if (has('transaction date') || (has('date') && has('debit') && has('credit'))) return 'BDO'
  if (has('date') && has('amount') && !has('debit') && !has('credit')) return 'BPI'
  return 'Generic'
}

function normalizeDate(value: string): string | null {
  if (!value) return null
  const clean = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean

  const monthDayYear = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (monthDayYear) return `${monthDayYear[3]}-${monthDayYear[1].padStart(2, '0')}-${monthDayYear[2].padStart(2, '0')}`

  const shortMonthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }

  const dayMonYear = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (dayMonYear) {
    const month = shortMonthMap[dayMonYear[2].toLowerCase()]
    if (month) return `${dayMonYear[3]}-${month}-${dayMonYear[1].padStart(2, '0')}`
  }

  const monDayYear = clean.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s*(\d{4})$/)
  if (monDayYear) {
    const month = shortMonthMap[monDayYear[1].toLowerCase()]
    if (month) return `${monDayYear[3]}-${month}-${monDayYear[2].padStart(2, '0')}`
  }

  return null
}

function parseAmt(value: string): number {
  const cleaned = value.replace(/[,₱$\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  return parseFloat(cleaned) || 0
}

function parseRows(rows: string[][], headerIdx: number, format: BankFormat): ParsedRow[] {
  const headers = rows[headerIdx].map((cell) => cell.toLowerCase().trim())
  const col = (terms: string[]) => headers.findIndex((header) => terms.some((term) => header.includes(term)))

  const dateIdx = col(['transaction date', 'post date', 'date'])
  const descIdx = col(['description', 'remarks', 'particulars', 'details', 'memo', 'narration'])
  const amountIdx = col(['amount'])
  const debitIdx = col(['debit amount', 'debit'])
  const creditIdx = col(['credit amount', 'credit'])

  const result: ParsedRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.length || row.every((cell) => !cell)) continue

    const dateStr = dateIdx >= 0 ? (row[dateIdx] ?? '') : ''
    const date = normalizeDate(dateStr)
    if (!date) continue

    const rawDesc = descIdx >= 0 ? (row[descIdx] ?? '') : (row[1] ?? '')
    const description = rawDesc.replace(/^"|"$/g, '').trim()
    if (!description) continue

    const lowerDescription = description.toLowerCase()
    if (
      lowerDescription.includes('beg balance') ||
      lowerDescription.includes('beginning balance') ||
      lowerDescription.includes('end balance') ||
      lowerDescription.includes('opening balance')
    ) {
      continue
    }

    let parsedRow: ParsedRow | null = null

    if (format === 'BPI' || (format === 'Generic' && amountIdx >= 0)) {
      const rawAmount = parseAmt(row[amountIdx] ?? '')
      if (rawAmount === 0) continue
      parsedRow = rawAmount < 0
        ? { date, description, amount: Math.abs(rawAmount), type: 'expense' }
        : { date, description, amount: rawAmount, type: 'income' }
    } else {
      const debit = debitIdx >= 0 ? parseAmt(row[debitIdx] ?? '') : 0
      const credit = creditIdx >= 0 ? parseAmt(row[creditIdx] ?? '') : 0
      if (debit > 0) {
        parsedRow = { date, description, amount: debit, type: 'expense' }
      } else if (credit > 0) {
        parsedRow = { date, description, amount: credit, type: 'income' }
      }
    }

    if (parsedRow) {
      result.push(parsedRow)
    }
  }

  return result
}

function processFile(text: string): { format: BankFormat; rows: ParsedRow[] } | { error: string } {
  let rawRows: string[][]
  try {
    rawRows = parseCSVText(text)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not parse this CSV file.' }
  }

  if (rawRows.length < 2) {
    return { error: 'File appears to be empty or has no data rows.' }
  }

  const headerIdx = findHeaderRowIndex(rawRows)
  if (headerIdx < 0) {
    return {
      error:
        'Could not detect a valid header row. Make sure this is a bank CSV export with columns like Date, Description, Debit, or Credit.',
    }
  }

  const format = detectFormat(rawRows[headerIdx])
  const rows = parseRows(rawRows, headerIdx, format)
  if (rows.length === 0) {
    return { error: 'No valid transactions found in the file.' }
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `This file contains ${rows.length} rows. The current import limit is ${MAX_IMPORT_ROWS} rows to keep the app responsive.`,
    }
  }

  return { format, rows }
}

const FORMAT_LABELS: Record<BankFormat, string> = {
  BDO: 'BDO',
  BPI: 'BPI',
  Metrobank: 'Metrobank',
  Generic: 'Generic CSV',
}

export function ImportCSVDialog({ open, onOpenChange, onImport }: Props) {
  const { accounts } = useAccounts()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<{ format: BankFormat; rows: ParsedRow[] } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; account: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const selectedAccount = accounts.find((account) => account.id === accountId)

  const reset = () => {
    setParsed(null)
    setParseError(null)
    setAccountId('')
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = useCallback(
    (file: File) => {
      if (file.size === 0) {
        setParseError('Empty files cannot be imported.')
        return
      }
      if (!file.name.match(/\.(csv|txt)$/i)) {
        setParseError('Please upload a CSV file (.csv or .txt).')
        return
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        setParseError('File too large. Maximum import size is 5 MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = String(event.target?.result ?? '')
        const result = processFile(text)
        if ('error' in result) {
          setParseError(result.error)
          setParsed(null)
          return
        }

        setParsed(result)
        setParseError(null)
        if (!accountId && accounts.length > 0) {
          setAccountId(accounts[0].id)
        }
      }
      reader.readAsText(file)
    },
    [accountId, accounts],
  )

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!parsed || !accountId || !selectedAccount) return
    setImporting(true)
    const txs: ImportTx[] = parsed.rows.map((row) => ({
      ...row,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import from CSV
          </DialogTitle>
        </DialogHeader>

        {importResult ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[oklch(0.660_0.150_155/0.15)] flex items-center justify-center">
              <FileText className="w-7 h-7 text-[oklch(0.660_0.150_155)]" />
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
            {!parsed && (
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

            {parsed && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{FORMAT_LABELS[parsed.format]}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {parsed.rows.length} transactions found
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

                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview - first {Math.min(parsed.rows.length, PREVIEW_ROW_COUNT)} of {parsed.rows.length}
                  </p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Description</th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground">Amount</th>
                          <th className="text-center px-3 py-2 font-medium text-xs text-muted-foreground">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, PREVIEW_ROW_COUNT).map((row, index) => (
                          <tr key={index} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-2 max-w-50 truncate">{row.description}</td>
                            <td
                              className={`px-3 py-2 text-right font-medium tabular-nums ${
                                row.type === 'expense'
                                  ? 'text-[oklch(0.620_0.160_18)]'
                                  : 'text-[oklch(0.660_0.150_155)]'
                              }`}
                            >
                              {row.type === 'expense' ? '-' : '+'}
                              {formatCurrency(row.amount, selectedAccount?.currency ?? 'PHP')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant={row.type === 'expense' ? 'destructive' : 'secondary'}
                                className="text-xs capitalize"
                              >
                                {row.type}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > PREVIEW_ROW_COUNT && (
                    <p className="text-xs text-muted-foreground mt-1.5 text-center">
                      +{parsed.rows.length - PREVIEW_ROW_COUNT} more transactions
                    </p>
                  )}
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
              {parsed && (
                <Button onClick={handleImport} disabled={!accountId || importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${parsed.rows.length} transaction${parsed.rows.length !== 1 ? 's' : ''}`
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
