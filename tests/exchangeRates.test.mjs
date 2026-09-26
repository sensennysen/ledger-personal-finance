import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  amountInCurrency,
  converterTo,
  displayRate,
  effectiveRates,
  feedUrl,
  lookupRate,
  missingCurrencies,
  neededCurrencies,
  parseFeed,
  parseRateRow,
  rateBetween,
  rebaseOverrides,
  refreshDue,
  unansweredQuotes,
} from '../src/lib/exchangeRates.ts'

// 1 USD buys 62.5 PHP and 0.8 EUR.
const table = (over = {}) => ({
  base: 'USD',
  rates: { PHP: 62.5, EUR: 0.8 },
  overrides: {},
  asOf: '2026-09-25',
  fetchedAt: '2026-09-26T08:00:00',
  ...over,
})

test('a stored row is read into a table; bad entries are dropped, a bad base is no table', () => {
  const parsed = parseRateRow({
    base: 'USD',
    rates: { PHP: 62.5, EUR: -1, JPY: 'x', XX: 3, gbp: 1 },
    overrides: [],
    as_of: '2026-09-25',
    fetched_at: null,
  })
  assert.deepEqual(parsed, { base: 'USD', rates: { PHP: 62.5 }, overrides: {}, asOf: '2026-09-25', fetchedAt: null })
  assert.equal(parseRateRow(null), null)
  assert.equal(parseRateRow({ base: 5, rates: {}, overrides: {}, as_of: null, fetched_at: null }), null)
})

test('the same currency is always 1, with or without a table', () => {
  assert.deepEqual(lookupRate(null, 'PHP', 'PHP'), { kind: 'rate', rate: 1, source: 'same' })
})

test('with no table, or a missing currency, there is no rate', () => {
  assert.deepEqual(lookupRate(null, 'PHP', 'USD'), { kind: 'none' })
  assert.deepEqual(lookupRate(table(), 'JPY', 'USD'), { kind: 'none' })
  assert.deepEqual(lookupRate(table(), 'USD', 'JPY'), { kind: 'none' })
  assert.equal(rateBetween(table(), 'JPY', 'PHP'), null)
})

test('rates run in both directions and through the base', () => {
  assert.equal(rateBetween(table(), 'USD', 'PHP'), 62.5)
  assert.equal(rateBetween(table(), 'PHP', 'USD'), 1 / 62.5)
  assert.ok(Math.abs(rateBetween(table(), 'EUR', 'PHP') - 62.5 / 0.8) < 1e-9)
  assert.ok(Math.abs(rateBetween(table(), 'PHP', 'EUR') - 0.8 / 62.5) < 1e-9)
})

test('a rate the user typed wins over the feed and is reported as an override', () => {
  const t = table({ overrides: { PHP: 60 } })
  assert.equal(rateBetween(t, 'USD', 'PHP'), 60)
  assert.equal(lookupRate(t, 'USD', 'PHP').source, 'override')
  assert.equal(lookupRate(t, 'USD', 'EUR').source, 'feed')
  assert.equal(lookupRate(t, 'PHP', 'EUR').source, 'override')
  assert.equal(effectiveRates(t).PHP, 60)
  assert.equal(effectiveRates(t).USD, 1)
})

test('an override for a currency the feed lacks still converts it', () => {
  const t = table({ overrides: { JPY: 150 } })
  assert.equal(rateBetween(t, 'JPY', 'USD'), 1 / 150)
})

test('converterTo converts what it can and returns null for the rest', () => {
  const toPhp = converterTo(table(), 'PHP')
  assert.equal(toPhp(10, 'USD'), 625)
  assert.equal(toPhp(10, 'PHP'), 10)
  assert.equal(toPhp(10, 'JPY'), null)
})

test('amountInCurrency: same currency, a recorded rate, the table, or null', () => {
  const tx = (over) => ({ amount: 100, currency: 'USD', exchange_rate: 1, ...over })
  assert.equal(amountInCurrency(tx({ currency: 'PHP' }), 'PHP', null), 100)
  assert.equal(amountInCurrency(tx({ exchange_rate: 58 }), 'PHP', table()), 5800, 'a recorded rate is honoured')
  assert.equal(amountInCurrency(tx(), 'PHP', table()), 6250, 'the untouched default of 1 is not a rate')
  assert.equal(amountInCurrency(tx({ exchange_rate: null }), 'PHP', table()), 6250)
  assert.equal(amountInCurrency(tx(), 'PHP', null), null, 'no table, no rate: excluded, not counted one to one')
  assert.equal(amountInCurrency(tx({ currency: 'JPY' }), 'PHP', table()), null)
})

test('neededCurrencies drops the base, duplicates and junk; missingCurrencies names what has no rate', () => {
  assert.deepEqual(neededCurrencies(['PHP', 'USD', 'PHP', 'eur', 'JPY'], 'USD'), ['JPY', 'PHP'])
  assert.deepEqual(missingCurrencies(table(), ['PHP', 'JPY', 'USD'], 'USD'), ['JPY'])
  assert.deepEqual(missingCurrencies(null, ['PHP'], 'USD'), ['PHP'])
  assert.deepEqual(missingCurrencies(table({ overrides: { JPY: 150 } }), ['JPY'], 'USD'), [])
})

// ── refreshDue ──────────────────────────────────────────────

const now = new Date('2026-09-26T15:00:00')
const due = (over = {}) =>
  refreshDue({ frequency: 'daily', table: table(), base: 'USD', needed: ['PHP'], now, attemptedThisSession: false, ...over })

test('manual never fetches by itself, even with no table', () => {
  assert.equal(due({ frequency: 'manual', table: null }), false)
})

test('nothing repeats within one app load', () => {
  assert.equal(due({ frequency: 'open', attemptedThisSession: true }), false)
  assert.equal(due({ table: null, attemptedThisSession: true }), false)
})

test('"every time I open" fetches once per load, whatever the table says', () => {
  assert.equal(due({ frequency: 'open' }), true)
})

test('daily fetches on a new calendar day, not before', () => {
  assert.equal(due({ table: table({ fetchedAt: '2026-09-26T00:05:00' }) }), false)
  assert.equal(due({ table: table({ fetchedAt: '2026-09-25T23:59:00' }) }), true)
})

test('weekly fetches after seven days, not before', () => {
  assert.equal(due({ frequency: 'weekly', table: table({ fetchedAt: '2026-09-20T15:00:01' }) }), false)
  assert.equal(due({ frequency: 'weekly', table: table({ fetchedAt: '2026-09-19T15:00:00' }) }), true)
})

test('a missing table, a changed base or a currency with no fed rate fetches sooner than the interval', () => {
  const fresh = table({ fetchedAt: '2026-09-26T09:00:00' })
  assert.equal(due({ table: null, frequency: 'weekly' }), true)
  assert.equal(due({ table: table({ fetchedAt: null }) }), true)
  assert.equal(due({ table: fresh, base: 'PHP' }), true)
  assert.equal(due({ table: fresh, needed: ['PHP', 'JPY'] }), true)
  assert.equal(due({ table: fresh, needed: ['PHP', 'EUR'] }), false)
  assert.equal(due({ table: table({ fetchedAt: 'not a date' }) }), true)
})

// ── the feed ────────────────────────────────────────────────

test('the feed URL asks for the base and the quotes', () => {
  assert.equal(feedUrl('USD', ['EUR', 'PHP']), 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR%2CPHP')
  assert.equal(feedUrl('USD', []), 'https://api.frankfurter.dev/v2/rates?base=USD')
})

test('the feed answer is read into rates and the latest date', () => {
  const answer = [
    { date: '2026-09-26', base: 'USD', quote: 'EUR', rate: 0.877 },
    { date: '2026-09-25', base: 'USD', quote: 'PHP', rate: 62.5 },
    { date: '2026-09-26', base: 'EUR', quote: 'JPY', rate: 180 },
    { date: '2026-09-26', base: 'USD', quote: 'BAD', rate: 0 },
    { date: '2026-09-26', base: 'USD', quote: 'gbp', rate: 0.75 },
    null,
  ]
  assert.deepEqual(parseFeed(answer, 'USD'), { ok: true, rates: { EUR: 0.877, PHP: 62.5 }, asOf: '2026-09-26' })
})

test('an answer with no usable rate, or not a list, is a failure with a reason', () => {
  for (const bad of [[], {}, 'no', null, [{ base: 'USD', quote: 'EUR', rate: 'x' }]]) {
    const result = parseFeed(bad, 'USD')
    assert.equal(result.ok, false)
    assert.ok(result.reason.length > 0)
  }
})

test('unansweredQuotes names the currencies the feed skipped', () => {
  assert.deepEqual(unansweredQuotes(['EUR', 'PHP', 'XYZ'], { EUR: 0.8, PHP: 62 }), ['XYZ'])
})

test('displayRate prefers the override and says where it came from', () => {
  assert.deepEqual(displayRate(table({ overrides: { PHP: 60 } }), 'PHP'), { rate: 60, source: 'override' })
  assert.deepEqual(displayRate(table(), 'PHP'), { rate: 62.5, source: 'feed' })
  assert.equal(displayRate(table(), 'JPY'), null)
})

test('typed rates are re-expressed when the base changes, and dropped when they cannot be', () => {
  const t = table({ overrides: { JPY: 150, PHP: 60 } })
  assert.deepEqual(rebaseOverrides(t, 'USD'), { JPY: 150, PHP: 60 })
  // 1 USD = 60 PHP, so 1 PHP = 1/60 USD and 1 JPY = 150/60 PHP.
  const inPhp = rebaseOverrides(t, 'PHP')
  assert.deepEqual(Object.keys(inPhp), ['JPY'])
  assert.ok(Math.abs(inPhp.JPY - 150 / 60) < 1e-9)
  assert.deepEqual(rebaseOverrides(t, 'CAD'), {}, 'no rate for the new base')
})
