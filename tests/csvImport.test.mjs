import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRows,
  dateOrderIsAmbiguous,
  detectDateOrder,
  detectFormat,
  fileCurrency,
  fixableByOtherOrder,
  groupProblems,
  importableRows,
  isAmbiguousSlashDate,
  isSelectable,
  isSelected,
  parseAmount,
  parseDate,
  processFile,
  skipReason,
  selectAll,
  sortProblemsFirst,
  summarise,
  withAmbiguousDateIssues,
  withCategoryIssues,
  withCurrencyIssues,
} from '../src/lib/csvImport.ts'
import { buildReportCsv, buildTransactionsCsv } from '../src/lib/transactionCsv.ts'

const rowsOf = (text, order) => {
  const file = processFile(text)
  assert.ok(!('error' in file), file.error)
  return buildRows(file.raw, file.headerIdx, file.format, order ?? file.dateOrder)
}

const none = { duplicates: new Set(), skipped: new Set(), toggled: new Set() }

const BDO = [
  'Transaction Date,Description,Debit,Credit,Balance',
  '09/14/2026,GRABFOOD TOYO EATERY,32.80,,1000.00',
  '09/15/2026,PAYROLL,,"1,500.00",2500.00',
  '09/15/2026,Beginning Balance,,,2500.00',
].join('\n')

const BPI = [
  'Date,Description,Amount',
  '2026-09-13,SHELL KALAYAAN,-52.00',
  '2026-09-14,INTEREST,(0.00)',
  'Sep 14 2026,REFUND,14.00',
].join('\n')

const METROBANK = [
  'Post Date,Ref. No,Particulars,Debit,Credit',
  '14-Sep-2026,A1,NETFLIX.COM,14.00,',
].join('\n')

test('valid statements parse as before for each bank format', () => {
  const bdo = processFile(BDO)
  assert.equal(bdo.format, 'BDO')
  assert.deepEqual(
    rowsOf(BDO).rows.map(({ date, description, amount, type, issues }) => ({ date, description, amount, type, issues })),
    [
      { date: '2026-09-14', description: 'GRABFOOD TOYO EATERY', amount: 32.8, type: 'expense', issues: [] },
      { date: '2026-09-15', description: 'PAYROLL', amount: 1500, type: 'income', issues: [] },
    ],
  )
  assert.equal(rowsOf(BDO).ignored, 1)

  assert.equal(processFile(BPI).format, 'BPI')
  const bpi = rowsOf(BPI)
  assert.deepEqual(bpi.rows.map((row) => [row.date, row.amount, row.type]), [
    ['2026-09-13', 52, 'expense'],
    ['2026-09-14', 14, 'income'],
  ])
  assert.equal(bpi.ignored, 1, 'the zero-amount line is ignored, not flagged')

  assert.equal(processFile(METROBANK).format, 'Metrobank')
  assert.deepEqual(rowsOf(METROBANK).rows.map((row) => [row.date, row.description, row.amount]), [
    ['2026-09-14', 'NETFLIX.COM', 14],
  ])
})

test('structural failures are still reported as errors', () => {
  assert.match(processFile('Date,Description\n"unterminated').error, /unmatched quote/)
  assert.match(processFile('just one line').error, /empty/)
  assert.match(processFile('foo,bar\n1,2').error, /header row/)
})

test('parseDate range-checks instead of writing month 17', () => {
  assert.equal(parseDate('17/09/2026', 'MDY'), null)
  assert.equal(parseDate('17/09/2026', 'DMY'), '2026-09-17')
  assert.equal(parseDate('09/17/2026', 'MDY'), '2026-09-17')
  assert.equal(parseDate('05/09/2026', 'DMY'), '2026-09-05')
  assert.equal(parseDate('05/09/2026', 'MDY'), '2026-05-09')
  assert.equal(parseDate('31/02/2026', 'DMY'), null)
  assert.equal(parseDate('2026-13-01', 'MDY'), null)
  assert.equal(parseDate('yesterday', 'MDY'), null)
  assert.equal(parseDate('', 'MDY'), null)
})

test('detectDateOrder reads the order off unambiguous dates', () => {
  assert.equal(detectDateOrder(['05/09/2026', '17/09/2026']), 'DMY')
  assert.equal(detectDateOrder(['09/17/2026', '09/05/2026']), 'MDY')
  assert.equal(detectDateOrder(['05/09/2026', '2026-09-01']), 'either')
  assert.equal(detectDateOrder(['17/09/2026', '09/17/2026']), 'either')
})

test('a D/M/Y file is detected as such on upload', () => {
  const file = processFile('Date,Description,Amount\n17/09/2026,A,-1\n05/09/2026,B,-2')
  assert.equal(file.dateOrder, 'DMY')
  assert.deepEqual(rowsOf('Date,Description,Amount\n17/09/2026,A,-1\n05/09/2026,B,-2').rows.map((row) => row.date), [
    '2026-09-17',
    '2026-09-05',
  ])
})

test('parseAmount flags non-numbers instead of treating them as zero', () => {
  assert.equal(parseAmount('1,234.50'), 1234.5)
  assert.equal(parseAmount('₱ 86.40'), 86.4)
  assert.equal(parseAmount('(52.00)'), -52)
  assert.equal(parseAmount(''), 0)
  assert.equal(parseAmount('-'), 0)
  assert.equal(parseAmount('12abc'), null)
  assert.equal(parseAmount('n/a'), null)
})

const MESSY = [
  'Date,Description,Amount',
  '17/09/2026,SM SUPERMARKET PODIUM 4471,-86.40', // bad date under M/D/Y
  '16/09/2026,MERALCO ONLINE PAYMENT,-184.20', // bad date under M/D/Y
  '09/15/2026,GRAB *TRIP 8842,-14.00',
  '09/15/2026,,-250.00', // empty description
  '09/14/2026,NETFLIX.COM,abc', // bad amount
  '09/14/2026,GRABFOOD TOYO EATERY,-32.80', // duplicate (see below)
  'not a date,SHELL KALAYAAN,-52.00', // unfixable date
].join('\n')

test('problems group by cause, errors first', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const causes = groupProblems(rows, new Set([6]))
  assert.deepEqual(
    causes.map(({ id, severity, lines, sample }) => ({ id, severity, lines, sample })),
    [
      { id: 'bad-date', severity: 'error', lines: [1, 2, 7], sample: '17/09/2026' },
      { id: 'bad-amount', severity: 'error', lines: [5], sample: 'abc' },
      { id: 'empty-description', severity: 'warning', lines: [4], sample: '' },
      { id: 'duplicate', severity: 'duplicate', lines: [6], sample: 'GRABFOOD TOYO EATERY' },
    ],
  )
})

test('switching the date order clears every row under that cause it can fix', () => {
  const mdy = rowsOf(MESSY, 'MDY').rows
  assert.equal(fixableByOtherOrder(mdy, 'MDY'), 2)
  const dmy = rowsOf(MESSY, 'DMY').rows
  // Rows 1 and 2 now parse; the M/D/Y-looking rows become invalid under D/M/Y.
  const badDates = groupProblems(dmy, new Set()).find((cause) => cause.id === 'bad-date')
  assert.deepEqual(badDates.lines, [3, 4, 5, 6, 7])
})

test('errors block the import until fixed or skipped; warnings do not', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const duplicates = new Set([6])
  const blocked = { ...none, duplicates }
  assert.equal(summarise(rows, blocked).errors, 4)
  assert.deepEqual(importableRows(rows, blocked), [])

  const resolved = { ...blocked, skipped: new Set(['bad-date', 'bad-amount']) }
  const summary = summarise(rows, resolved)
  assert.deepEqual(summary, { ready: 2, errors: 0, warnings: 1, duplicates: 1, skipped: 4, deselected: 1, excludedDuplicates: 1 })
  assert.deepEqual(importableRows(rows, resolved).map((row) => row.line), [3, 4])
})

test('duplicates are left out until ticked', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const selection = { duplicates: new Set([6]), skipped: new Set(['bad-date', 'bad-amount']), toggled: new Set([6]) }
  assert.deepEqual(importableRows(rows, selection).map((row) => row.line), [3, 4, 6])
  assert.equal(summarise(rows, selection).ready, 3)
})

test('skipping a warning cause keeps those rows out', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const selection = { ...none, skipped: new Set(['bad-date', 'bad-amount', 'empty-description']) }
  assert.deepEqual(importableRows(rows, selection).map((row) => row.line), [3, 6])
})

test('problem rows sort first: errors, duplicates, warnings, then file order', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  assert.deepEqual(sortProblemsFirst(rows, new Set([6])).map((row) => row.line), [1, 2, 5, 7, 6, 4, 3])
})

test('any clean row can be unticked, and stays out of the import', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const selection = { ...none, skipped: new Set(['bad-date', 'bad-amount']), toggled: new Set([3]) }
  assert.deepEqual(importableRows(rows, selection).map((row) => row.line), [4, 6])
  const summary = summarise(rows, selection)
  assert.equal(summary.ready, 2)
  assert.equal(summary.deselected, 1)
  assert.equal(summary.excludedDuplicates, 0)
})

test('rows with an error or under a skipped cause have no checkbox', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const byLine = new Map(rows.map((row) => [row.line, row]))
  const selection = { ...none, skipped: new Set(['empty-description']), toggled: new Set([1]) }
  assert.equal(isSelectable(byLine.get(1), selection), false)
  assert.equal(isSelected(byLine.get(1), selection), false)
  assert.equal(isSelectable(byLine.get(4), selection), false)
  assert.equal(isSelectable(byLine.get(3), selection), true)
})

test('a row kept out of the import says why, in text', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const byLine = new Map(rows.map((row) => [row.line, row]))
  const selection = { duplicates: new Set([6]), skipped: new Set(['empty-description']), toggled: new Set([3]) }
  assert.equal(skipReason(byLine.get(4), selection), 'Skipped - description empty')
  assert.equal(skipReason(byLine.get(3), selection), 'Not selected')
  assert.equal(skipReason(byLine.get(6), selection), 'Not selected')
  assert.equal(skipReason(byLine.get(1), selection), null)
  assert.equal(skipReason(byLine.get(3), { ...selection, toggled: new Set() }), null)
})

test('select all ticks every selectable row, duplicates included; clearing unticks them', () => {
  const { rows } = rowsOf(MESSY, 'MDY')
  const base = { duplicates: new Set([6]), skipped: new Set(['bad-date', 'bad-amount']), toggled: new Set([3]) }
  const all = { ...base, toggled: selectAll(rows, base, true) }
  assert.deepEqual(importableRows(rows, all).map((row) => row.line), [3, 4, 6])
  const cleared = { ...base, toggled: selectAll(rows, all, false) }
  assert.deepEqual(importableRows(rows, cleared), [])
  assert.equal(summarise(rows, cleared).excludedDuplicates, 1)
})

test('rows with no category match are a warning that still imports', () => {
  const { rows } = rowsOf(BDO)
  const flagged = withCategoryIssues(rows, new Set([1]))
  assert.deepEqual(
    groupProblems(flagged, new Set()).map((cause) => [cause.id, cause.severity, cause.lines]),
    [['no-category', 'warning', [1]]],
  )
  assert.deepEqual(importableRows(flagged, none).map((row) => row.line), [1, 2])
  assert.equal(withCategoryIssues(rows, new Set()), rows)
})

test('a slash date is ambiguous only when both parts fit a month and differ (LED-147)', () => {
  assert.equal(isAmbiguousSlashDate('03/04/2026'), true)
  assert.equal(isAmbiguousSlashDate('05/05/2026'), false)
  assert.equal(isAmbiguousSlashDate('13/04/2026'), false)
  assert.equal(isAmbiguousSlashDate('03/25/2026'), false)
  assert.equal(isAmbiguousSlashDate('2026-03-04'), false)
})

test('a file is ambiguous when no date settles the order', () => {
  assert.equal(dateOrderIsAmbiguous(['03/04/2026', '05/06/2026']), true)
  assert.equal(dateOrderIsAmbiguous(['03/04/2026', '15/06/2026']), false)
  assert.equal(dateOrderIsAmbiguous(['03/04/2026', '06/15/2026']), false)
  assert.equal(dateOrderIsAmbiguous(['2026-03-04']), false)
  assert.equal(dateOrderIsAmbiguous(['05/05/2026']), false)
})

test('an all-ambiguous file is flagged and a confirmed order clears the warning', () => {
  const text = ['Date,Description,Debit,Credit', '03/04/2026,Coffee,50,', '05/06/2026,Salary,,1000'].join('\n')
  const file = processFile(text)
  assert.ok(!('error' in file))
  assert.equal(file.dateOrderAmbiguous, true)
  assert.equal(file.dateOrder, 'MDY')
  const built = buildRows(file.raw, file.headerIdx, file.format, file.dateOrder).rows
  const flagged = withAmbiguousDateIssues(built, true)
  assert.ok(flagged.every((row) => row.issues.includes('ambiguous-date')))
  assert.deepEqual(groupProblems(flagged, new Set()).map((cause) => cause.id), ['ambiguous-date'])
  assert.equal(groupProblems(flagged, new Set())[0].sample, '03/04/2026')
  // Confirming the order (either one) stops flagging; the rows then parse in that order.
  assert.deepEqual(withAmbiguousDateIssues(built, false), built)
  const dmy = buildRows(file.raw, file.headerIdx, file.format, 'DMY').rows
  assert.equal(dmy[0].date, '2026-04-03')
  assert.equal(built[0].date, '2026-03-04')
})

test('a warning does not block the import', () => {
  const text = ['Date,Description,Debit,Credit', '03/04/2026,Coffee,50,'].join('\n')
  const file = processFile(text)
  const rows = withAmbiguousDateIssues(buildRows(file.raw, file.headerIdx, file.format, 'MDY').rows, true)
  const summary = summarise(rows, none)
  assert.equal(summary.errors, 0)
  assert.equal(summary.warnings, 1)
})

test('a file with a day over 12 is settled, not ambiguous', () => {
  const text = ['Date,Description,Debit,Credit', '03/04/2026,Coffee,50,', '25/04/2026,Lunch,80,'].join('\n')
  const file = processFile(text)
  assert.equal(file.dateOrderAmbiguous, false)
  assert.equal(file.dateOrder, 'DMY')
})

// QA-001 / F-019c: Ledger's own export writes a positive Amount and puts the direction in Type.
const LEDGER_REPORT = [
  'Date,Description,Category,Account,Type,Amount,Currency,Standing Balance',
  '2026-10-06,QA split first,,QA Cash,expense,7,USD,878',
  '2026-10-06,QA transfer,,QA Cash,transfer,100,USD,950',
  '2026-10-06,QA income,,QA Cash,income,50,USD,1050',
].join('\n')

test('a Ledger export is recognised by its Type, Amount and Currency columns', () => {
  assert.equal(detectFormat(['Date', 'Description', 'Category', 'Account', 'Type', 'Amount', 'Currency']), 'Ledger')
  assert.equal(processFile(LEDGER_REPORT).format, 'Ledger')
  // A bank statement with a "Transaction Type" column is still a bank statement.
  assert.equal(detectFormat(['Date', 'Description', 'Transaction Type', 'Amount']), 'BPI')
})

test('a positive exported expense imports as an expense, and income stays income (F-019c)', () => {
  const { rows } = rowsOf(LEDGER_REPORT)
  const expense = rows.find((row) => row.description === 'QA split first')
  assert.equal(expense.type, 'expense')
  assert.equal(expense.amount, 7)
  assert.deepEqual(expense.issues, [])
  const income = rows.find((row) => row.description === 'QA income')
  assert.equal(income.type, 'income')
  assert.equal(income.amount, 50)
})

test('an exported transfer is blocked, not guessed into income or expense', () => {
  const { rows } = rowsOf(LEDGER_REPORT)
  const transfer = rows.find((row) => row.description === 'QA transfer')
  assert.equal(transfer.type, null)
  assert.deepEqual(transfer.issues, ['transfer-row'])
  assert.deepEqual(importableRows(rows, none), [])
  // Skipping the transfers imports the rest with their own direction.
  const ready = importableRows(rows, { ...none, skipped: new Set(['transfer-row']) })
  assert.deepEqual(ready.map((row) => [row.description, row.type]), [['QA split first', 'expense'], ['QA income', 'income']])
})

test('reordered Ledger columns read the same', () => {
  const { rows } = rowsOf(['Amount,Currency,Type,Description,Date', '7,USD,Expense,Coffee,2026-10-06'].join('\n'))
  assert.deepEqual([rows[0].type, rows[0].amount, rows[0].date, rows[0].currency], ['expense', 7, '2026-10-06', 'USD'])
})

test('a missing or unknown Type and a negative amount with a Type are errors', () => {
  const { rows } = rowsOf(
    ['Date,Description,Type,Amount,Currency', '2026-10-06,Blank,,7,USD', '2026-10-06,Odd,refund,7,USD', '2026-10-06,Neg,income,-7,USD'].join('\n'),
  )
  assert.deepEqual(rows.map((row) => row.issues), [['bad-type'], ['bad-type'], ['sign-conflict']])
  assert.equal(summarise(rows, none).errors, 3)
  assert.deepEqual(groupProblems(rows, new Set()).map((cause) => [cause.id, cause.sample]), [
    ['bad-type', ''],
    ['sign-conflict', '-7'],
  ])
})

test('a Ledger export without its Type or Currency column is refused, not read as all income', () => {
  for (const header of ['Date,Description,Amount,Currency,Standing Balance', 'Date,Type,Description,Amount,Standing Balance']) {
    const file = processFile([header, '2026-10-06,expense,Coffee,7,100'].join('\n'))
    assert.match(file.error, /Ledger export/)
  }
})

test('rows in another currency than the statement are blocked; a single-currency file names its currency', () => {
  const { rows } = rowsOf(['Date,Description,Type,Amount,Currency', '2026-10-06,A,expense,7,USD', '2026-10-06,B,expense,9,PHP'].join('\n'))
  assert.equal(fileCurrency(rows), null)
  assert.equal(fileCurrency(rows.slice(0, 1)), 'USD')
  const checked = withCurrencyIssues(rows, 'USD')
  assert.deepEqual(checked.map((row) => row.issues), [[], ['other-currency']])
  assert.equal(summarise(checked, none).errors, 1)
})

test('bank statements keep signed-amount and debit/credit direction', () => {
  const bpi = rowsOf(BPI).rows
  assert.ok(bpi.some((row) => row.type === 'expense') && bpi.some((row) => row.type === 'income'))
  assert.ok(bpi.every((row) => row.currency === null && row.rawType === ''))
  assert.deepEqual(withCurrencyIssues(bpi, 'USD'), bpi)
  assert.deepEqual(rowsOf(BDO).rows.map((row) => row.type), ['expense', 'income'])
})

const exported = (over) => ({
  id: 't1',
  date: '2026-10-06',
  type: 'expense',
  description: 'Coffee',
  category: null,
  account: { name: 'QA Cash' },
  account_id: 'a1',
  to_account: null,
  to_account_id: null,
  amount: 7,
  currency: 'USD',
  exchange_rate: 1,
  destination_amount: null,
  transfer_fee: null,
  notes: null,
  ...over,
})

test('Reports and full exports round-trip through the importer with their direction', () => {
  const transactions = [exported(), exported({ id: 't2', type: 'income', description: 'Pay', amount: 50 })]
  const report = buildReportCsv(transactions, ['date', 'description', 'category', 'account', 'type', 'amount', 'balance'])
  const full = buildTransactionsCsv(transactions)
  for (const csv of [report, full]) {
    const { rows } = rowsOf(csv)
    assert.deepEqual(rows.map((row) => [row.type, row.amount, row.currency, row.issues.length]), [
      ['expense', 7, 'USD', 0],
      ['income', 50, 'USD', 0],
    ])
  }
  // A transfer with a fee in the full export is blocked rather than imported as one side.
  const { rows } = rowsOf(buildTransactionsCsv([exported({ type: 'transfer', to_account: { name: 'Bank' }, transfer_fee: 2 })]))
  assert.deepEqual(rows[0].issues, ['transfer-row'])
})
