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

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim().replace(/^"|"$/g, ''))
        cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.trim().replace(/^"|"$/g, ''))
    if (cols.some((c) => c)) rows.push(cols)
  }
  return rows
}

function findHeaderRowIndex(rows: string[][]): number {
  const keywords = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'remarks', 'particulars']
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i].map((c) => c.toLowerCase())
    const matches = keywords.filter((k) => row.some((c) => c.includes(k))).length
    if (matches >= 2) return i
  }
  return -1
}

function detectFormat(headers: string[]): BankFormat {
  const h = headers.map((c) => c.toLowerCase().trim())
  const has = (term: string) => h.some((c) => c.includes(term))
  if (has('post date') || has('ref. no') || has('reference no')) return 'Metrobank'
  if (has('transaction date') || (has('date') && has('debit') && has('credit'))) return 'BDO'
  if (has('date') && has('amount') && !has('debit') && !has('credit')) return 'BPI'
  return 'Generic'
}

function normalizeDate(s: string): string | null {
  if (!s) return null
  const clean = s.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  // MM/DD/YYYY — common PH bank format
  const m1 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[1].padStart(2, '0')}-${m1[2].padStart(2, '0')}`
  // DD-Mon-YYYY (e.g. 15-Jan-2025)
  const m2 = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (m2) {
    const mo: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const month = mo[m2[2].toLowerCase()]
    if (month) return `${m2[3]}-${month}-${m2[1].padStart(2, '0')}`
  }
  // Mon DD, YYYY (e.g. Jan 15, 2025)
  const m3 = clean.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s*(\d{4})$/)
  if (m3) {
    const mo: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const month = mo[m3[1].toLowerCase()]
    if (month) return `${m3[3]}-${month}-${m3[2].padStart(2, '0')}`
  }
  return null
}

function parseAmt(s: string): number {
  // Handle parentheses for negatives: (1,000.00) → -1000
  const cleaned = s.replace(/[,₱$\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  return parseFloat(cleaned) || 0
}

function parseRows(rows: string[][], headerIdx: number, format: BankFormat): ParsedRow[] {
  const headers = rows[headerIdx].map((c) => c.toLowerCase().trim())
  const col = (terms: string[]) => headers.findIndex((h) => terms.some((t) => h.includes(t)))

  const dateIdx = col(['transaction date', 'post date', 'date'])
  const descIdx = col(['description', 'remarks', 'particulars', 'details', 'memo', 'narration'])
  const amtIdx = col(['amount'])
  const debitIdx = col(['debit amount', 'debit'])
  const creditIdx = col(['credit amount', 'credit'])

  const result: ParsedRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.length || row.every((c) => !c)) continue

    const dateStr = dateIdx >= 0 ? (row[dateIdx] ?? '') : ''
    const date = normalizeDate(dateStr)
    if (!date) continue

    const rawDesc = descIdx >= 0 ? (row[descIdx] ?? '') : (row[1] ?? '')
    const description = rawDesc.replace(/^"|"$/g, '').trim()
    if (!description) continue

    const dl = description.toLowerCase()
    if (
      dl.includes('beg balance') ||
      dl.includes('beginning balance') ||
      dl.includes('end balance') ||
      dl.includes('opening balance')
    )
      continue

    let amount = 0
    let type: 'income' | 'expense' = 'expense'

    if (format === 'BPI' || (format === 'Generic' && amtIdx >= 0)) {
      const raw = parseAmt(row[amtIdx] ?? '')
      if (raw === 0) continue
      if (raw < 0) {
        amount = Math.abs(raw)
        type = 'expense'
      } else {
        amount = raw
        type = 'income'
      }
    } else {
      const debit = debitIdx >= 0 ? parseAmt(row[debitIdx] ?? '') : 0
      const credit = creditIdx >= 0 ? parseAmt(row[creditIdx] ?? '') : 0
      if (debit > 0) {
        amount = debit
        type = 'expense'
      } else if (credit > 0) {
        amount = credit
        type = 'income'
      } else {
        continue
      }
    }

    result.push({ date, description, amount, type })
  }

  return result
}

function processFile(text: string): { format: BankFormat; rows: ParsedRow[] } | { error: string } {
  const raw = parseCSVText(text)
  if (raw.length < 2) return { error: 'File appears to be empty or has no data rows.' }
  const headerIdx = findHeaderRowIndex(raw)
  if (headerIdx < 0)
    return {
      error:
        'Could not detect a valid header row. Make sure this is a bank CSV/spreadsheet export with columns like Date, Description, Debit, Credit.',
    }
  const format = detectFormat(raw[headerIdx])
  const rows = parseRows(raw, headerIdx, format)
  if (rows.length === 0) return { error: 'No valid transactions found in the file.' }
  return { format, rows }
}

// ── Component ─────────────────────────────────────────────────────────────────

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

  const selectedAccount = accounts.find((a) => a.id === accountId)

  const reset = () => {
    setParsed(null)
    setParseError(null)
    setAccountId('')
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(csv|txt)$/i)) {
        setParseError('Please upload a CSV file (.csv or .txt).')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const result = processFile(text)
        if ('error' in result) {
          setParseError(result.error)
          setParsed(null)
        } else {
          setParsed(result)
          setParseError(null)
          if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
        }
      }
      reader.readAsText(file)
    },
    [accountId, accounts]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!parsed || !accountId || !selectedAccount) return
    setImporting(true)
    const txs: ImportTx[] = parsed.rows.map((r) => ({
      ...r,
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import from CSV
          </DialogTitle>
        </DialogHeader>

        {importResult ? (
          /* ── Success state ── */
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
            <Button onClick={() => { reset(); onOpenChange(false) }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File drop zone */}
            {!parsed && (
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
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

            {/* Parse error */}
            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Parsed results */}
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

                {/* Account selector */}
                <div className="space-y-1.5">
                  <Label>Import to account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview table */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview — first {Math.min(parsed.rows.length, 8)} of {parsed.rows.length}
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
                        {parsed.rows.slice(0, 8).map((row, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
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
                  {parsed.rows.length > 8 && (
                    <p className="text-xs text-muted-foreground mt-1.5 text-center">
                      +{parsed.rows.length - 8} more transactions
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  Transactions will be imported uncategorized. Use bulk re-categorize after import to assign categories quickly.
                </p>
              </>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
                Cancel
              </Button>
              {parsed && (
                <Button onClick={handleImport} disabled={!accountId || importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Importing…
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
