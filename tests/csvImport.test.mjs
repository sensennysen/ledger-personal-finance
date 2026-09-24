import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRows,
  detectDateOrder,
  fixableByOtherOrder,
  groupProblems,
  importableRows,
  isSelectable,
  isSelected,
  parseAmount,
  parseDate,
  processFile,
  selectAll,
  sortProblemsFirst,
  summarise,
  withCategoryIssues,
} from '../src/lib/csvImport.ts'

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
