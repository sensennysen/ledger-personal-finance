import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeCsvCell, buildTransactionsCsv, buildReportCsv, TRANSACTION_CSV_HEADERS } from '../src/lib/transactionCsv.ts'

const tx = (over = {}) => ({
  id: 't1',
  date: '2026-09-08',
  type: 'income',
  description: 'Salary — first half',
  category: { name: 'Salary' },
  account: { name: 'BDO Savings' },
  account_id: 'acc-1',
  to_account: null,
  to_account_id: null,
  amount: 3200,
  currency: 'PHP',
  exchange_rate: 1,
  transfer_fee: null,
  notes: null,
  ...over,
})

test('header row lists the thirteen columns in order', () => {
  const [header] = buildTransactionsCsv([]).split('\n')
  assert.equal(header, TRANSACTION_CSV_HEADERS.join(','))
  assert.equal(TRANSACTION_CSV_HEADERS.length, 13)
})

test('a row carries the transaction fields and the balance when given', () => {
  const csv = buildTransactionsCsv([tx()], new Map([['t1', 15000]]))
  assert.equal(
    csv.split('\n')[1],
    '2026-09-08,income,Salary — first half,Salary,BDO Savings,,3200,PHP,1,,,15000,',
  )
})

test('missing optional fields and balance are blank; account falls back to its id', () => {
  const row = buildTransactionsCsv([tx({ category: null, account: null })]).split('\n')[1]
  assert.equal(row, '2026-09-08,income,Salary — first half,,acc-1,,3200,PHP,1,,,,')
})

test('a transfer between two currencies carries what the destination received (LED-185)', () => {
  const row = buildTransactionsCsv([
    tx({
      type: 'transfer',
      description: 'To EUR wallet',
      category: null,
      to_account: { name: 'EUR Wallet' },
      to_account_id: 'acc-2',
      amount: 100,
      currency: 'USD',
      destination_amount: 91.5,
    }),
  ]).split('\n')[1]
  assert.equal(row, '2026-09-08,transfer,To EUR wallet,,BDO Savings,EUR Wallet,100,USD,1,91.5,,,')
  assert.equal(TRANSACTION_CSV_HEADERS.indexOf('Amount Received'), TRANSACTION_CSV_HEADERS.indexOf('Exchange Rate') + 1)
})

test('commas, quotes and newlines are quoted', () => {
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')
  assert.equal(escapeCsvCell('two\nlines'), '"two\nlines"')
  assert.equal(escapeCsvCell(null), '')
  assert.equal(escapeCsvCell(0), '0')
})

test('formula-looking cells are neutralised', () => {
  for (const s of ['=SUM(A1)', '+1', '-1', '@cmd']) {
    assert.equal(escapeCsvCell(s)[0], "'", s)
  }
  assert.equal(escapeCsvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`)
})

test('buildReportCsv carries only the chosen columns, amount always with its currency', () => {
  const csv = buildReportCsv([tx()], ['date', 'description', 'amount'])
  assert.equal(csv, 'Date,Description,Amount,Currency\n2026-09-08,Salary — first half,3200,PHP')
})

test('buildReportCsv orders columns as given and fills Standing Balance from the map', () => {
  const csv = buildReportCsv(
    [tx(), tx({ id: 't2', description: 'No balance' })],
    ['date', 'category', 'type', 'account', 'balance'],
    new Map([['t1', 12480.2]]),
  )
  assert.deepEqual(csv.split('\n'), [
    'Date,Category,Type,Account,Standing Balance',
    '2026-09-08,Salary,income,BDO Savings,12480.2',
    '2026-09-08,Salary,income,BDO Savings,',
  ])
})

test('buildReportCsv escapes the same way as the full export', () => {
  const csv = buildReportCsv([tx({ description: '=SUM(A1)' })], ['description'])
  assert.equal(csv.split('\n')[1], "'=SUM(A1)")
})

test('the full export keeps its headers in order: twelve, plus Amount Received after Exchange Rate (LED-185)', () => {
  assert.equal(buildTransactionsCsv([tx()]).split('\n')[0], TRANSACTION_CSV_HEADERS.join(','))
  assert.equal(TRANSACTION_CSV_HEADERS.length, 13)
})

test('a negative number stays a number, while text that starts with a minus is still neutralised (LED-143)', async () => {
  const { escapeCsvCell } = await import('../src/lib/transactionCsv.ts')
  assert.equal(escapeCsvCell(-3000), '-3000')
  assert.equal(escapeCsvCell('-3000'), "'-3000")
  assert.equal(escapeCsvCell('=SUM(A1)'), "'=SUM(A1)")
})

test('Export match writes one line per row it is given, in the order given, and nothing else (LED-149)', () => {
  const matches = [tx({ id: 'a', description: 'One' }), tx({ id: 'b', description: 'Two' }), tx({ id: 'c', description: 'Three' })]
  const lines = buildTransactionsCsv(matches).split('\n')
  assert.equal(lines.length, matches.length + 1)
  assert.deepEqual(lines.slice(1).map((line) => line.split(',')[2]), ['One', 'Two', 'Three'])
  assert.equal(buildTransactionsCsv([]), TRANSACTION_CSV_HEADERS.join(','))
})
