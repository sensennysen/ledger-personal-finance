import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseDescription, matchDuplicates, duplicateSpan } from '../src/lib/importDuplicates.ts'
import { EMPTY_DESCRIPTION } from '../src/lib/csvImport.ts'

const row = (line, overrides = {}) => ({
  line,
  date: '2026-09-14',
  amount: 32.8,
  type: 'expense',
  description: 'GRABFOOD TOYO EATERY',
  ...overrides,
})

const existing = (id, overrides = {}) => ({
  id,
  date: '2026-09-14',
  amount: 32.8,
  type: 'expense',
  description: 'GRABFOOD TOYO EATERY',
  account_id: 'acc',
  to_account_id: null,
  exchange_rate: 1,
  ...overrides,
})

const match = (rows, txs) => matchDuplicates(rows, txs, 'acc')

test('normaliseDescription folds case, punctuation and reference numbers', () => {
  assert.equal(normaliseDescription('GRAB *TRIP 8842'), 'grab trip')
  assert.equal(normaliseDescription('Grab Trip 1190'), 'grab trip')
  assert.equal(normaliseDescription('  SM  Supermarket, Podium  '), 'sm supermarket podium')
  assert.equal(normaliseDescription('7-Eleven'), '7 eleven')
  assert.equal(normaliseDescription(null), '')
})

test('a row matching date, amount, type and description is a duplicate', () => {
  const matches = match([row(1)], [existing('a', { description: 'grabfood toyo eatery' })])
  assert.equal(matches.get(1)?.id, 'a')
})

test('different amount, date or type is not a duplicate', () => {
  const rows = [row(1, { amount: 32.81 }), row(2, { date: '2026-09-15' }), row(3, { type: 'income' })]
  assert.equal(match(rows, [existing('a')]).size, 0)
})

test('a transfer out of the account matches money out, whatever its description', () => {
  const transfer = existing('t', { type: 'transfer', description: 'To savings', to_account_id: 'sav' })
  assert.equal(match([row(1, { description: 'FUND TRANSFER TO 8842' })], [transfer]).get(1)?.id, 't')
  assert.equal(match([row(1, { type: 'income' })], [transfer]).size, 0)
})

test('a transfer into the account matches money in at the amount that arrived', () => {
  const transfer = existing('t', { type: 'transfer', account_id: 'usd', to_account_id: 'acc', amount: 10, exchange_rate: 3.28 })
  assert.equal(match([row(1, { type: 'income', description: 'INSTAPAY FROM J DOE' })], [transfer]).get(1)?.id, 't')
  assert.equal(match([row(1, { type: 'expense' })], [transfer]).size, 0)
})

test('rows in other accounts never match', () => {
  assert.equal(match([row(1)], [existing('a', { account_id: 'other' })]).size, 0)
  assert.equal(match([row(1)], [existing('a', { type: 'transfer', account_id: 'x', to_account_id: 'y' })]).size, 0)
})

test('each existing row is matched at most once', () => {
  const matches = match([row(1), row(2)], [existing('a')])
  assert.deepEqual([...matches.keys()], [1])
})

test('amounts compare to the cent, whatever the stored type', () => {
  assert.equal(match([row(1, { amount: 0.1 + 0.2 })], [existing('a', { amount: '0.30' })]).size, 1)
})

test('re-importing a statement that overlaps last month by three days flags only the overlap', () => {
  const lastMonth = [
    existing('a', { date: '2026-08-29', description: 'NETFLIX.COM', amount: 14 }),
    existing('b', { date: '2026-08-30', description: 'SHELL KALAYAAN', amount: 52 }),
    existing('c', { date: '2026-08-31', description: 'MERALCO ONLINE PAYMENT', amount: 184.2 }),
  ]
  const statement = [
    row(1, { date: '2026-08-29', description: 'NETFLIX.COM', amount: 14 }),
    row(2, { date: '2026-08-30', description: 'SHELL KALAYAAN', amount: 52 }),
    row(3, { date: '2026-08-31', description: 'MERALCO ONLINE PAYMENT', amount: 184.2 }),
    row(4, { date: '2026-09-01', description: 'NETFLIX.COM', amount: 14 }),
  ]
  assert.deepEqual([...match(statement, lastMonth).keys()], [1, 2, 3])
})

test('rows without a date or amount are never matched', () => {
  assert.equal(match([row(1, { date: null }), row(2, { amount: null })], [existing('a')]).size, 0)
})

test('duplicateSpan covers the dated rows', () => {
  assert.deepEqual(
    duplicateSpan([{ date: '2026-09-14' }, { date: null }, { date: '2026-08-29' }, { date: '2026-09-01' }]),
    { start: '2026-08-29', end: '2026-09-14' },
  )
  assert.equal(duplicateSpan([{ date: null }]), null)
})

test('a loan repayment already recorded matches the loan statement credit (LED-147)', () => {
  const repayment = existing('r', { account_id: 'bank', to_account_id: 'loan', description: 'Loan payment - Phone', amount: 1000, date: '2026-09-29' })
  const credit = row(1, { date: '2026-09-29', amount: 1000, type: 'income', description: 'PAYMENT RECEIVED THANK YOU' })
  const found = matchDuplicates([credit], [repayment], 'loan')
  assert.equal(found.get(1)?.id, 'r')
})

test('the payer side matches too, whatever the bank calls the payment', () => {
  const repayment = existing('r', { account_id: 'bank', to_account_id: 'loan', description: 'Loan payment - Phone', amount: 1000, date: '2026-09-29' })
  const debit = row(1, { date: '2026-09-29', amount: 1000, type: 'expense', description: 'ONLINE BANKING PMT 55021' })
  assert.equal(matchDuplicates([debit], [repayment], 'bank').get(1)?.id, 'r')
})

test('a repayment matches one credit only, and only in the same direction and amount', () => {
  const repayment = existing('r', { account_id: 'bank', to_account_id: 'loan', amount: 1000, date: '2026-09-29' })
  const twice = [
    row(1, { date: '2026-09-29', amount: 1000, type: 'income' }),
    row(2, { date: '2026-09-29', amount: 1000, type: 'income' }),
  ]
  assert.deepEqual([...matchDuplicates(twice, [repayment], 'loan').keys()], [1])
  assert.equal(matchDuplicates([row(1, { date: '2026-09-29', amount: 900, type: 'income' })], [repayment], 'loan').size, 0)
  assert.equal(matchDuplicates([row(1, { date: '2026-09-29', amount: 1000, type: 'expense' })], [repayment], 'loan').size, 0)
})

test('a description-less row is still a duplicate on re-import, matched against its saved EMPTY_DESCRIPTION (LED-171)', () => {
  const saved = existing('a', { description: EMPTY_DESCRIPTION })
  assert.equal(match([row(1, { description: '' })], [saved]).get(1)?.id, 'a')
})

test('an expense with no target is still matched on description as before', () => {
  assert.equal(match([row(1)], [existing('a')]).get(1)?.id, 'a')
})

// ── A statement in another currency (LED-136) ───────────────
// The account is in PHP; the statement is in USD. Rows are stored converted, with the original kept.
const foreignRow = (line, atRate, overrides = {}) =>
  row(line, { amount: Math.round(10 * atRate * 100) / 100, original: { amount: 10, currency: 'USD' }, ...overrides })
const foreignExisting = (id, storedAmount, overrides = {}) =>
  existing(id, { amount: storedAmount, original_amount: 10, original_currency: 'USD', ...overrides })

test('the same statement imported again at a different rate is still a duplicate', () => {
  const stored = [foreignExisting('a', 560)]
  assert.equal(match([foreignRow(1, 56)], stored).get(1)?.id, 'a', 'same rate matches on amount and original')
  assert.equal(match([foreignRow(1, 58)], stored).get(1)?.id, 'a', 'another rate matches on the original')
})

test('a row in another currency does not match a stored original in a different currency or amount', () => {
  const stored = [foreignExisting('a', 560)]
  assert.equal(match([foreignRow(1, 58, { original: { amount: 10, currency: 'EUR' } })], stored).size, 0)
  assert.equal(match([foreignRow(1, 58, { original: { amount: 11, currency: 'USD' } })], stored).size, 0)
})

test('a stored original is used once, even when it also matches on the converted amount', () => {
  const stored = [foreignExisting('a', 560)]
  const rows = [foreignRow(1, 56), foreignRow(2, 56)]
  const matches = match(rows, stored)
  assert.equal(matches.size, 1)
  assert.equal(matches.get(1)?.id, 'a')
})

test('rows without an original still match as before, whatever the stored rows carry', () => {
  assert.equal(match([row(1)], [existing('a')]).get(1)?.id, 'a')
  assert.equal(match([row(1)], [foreignExisting('a', 32.8)]).get(1)?.id, 'a')
})
