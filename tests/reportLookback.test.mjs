import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOOKBACK,
  LOOKBACK_OPTIONS,
  getLookbackBuckets,
  getLookbackSubtitle,
} from '../src/lib/reportLookback.ts'

const today = new Date(2026, 8, 17) // Sep 17 2026

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1, d + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

test('defaults to 12 months and offers the four options', () => {
  assert.equal(DEFAULT_LOOKBACK, '12m')
  assert.deepEqual(LOOKBACK_OPTIONS.map((o) => o.value), ['30d', '90d', 'ytd', '12m'])
})

test('bucket counts per option', () => {
  assert.equal(getLookbackBuckets('30d', today).length, 30)
  assert.equal(getLookbackBuckets('90d', today).length, 13)
  assert.equal(getLookbackBuckets('ytd', today).length, 9)
  assert.equal(getLookbackBuckets('12m', today).length, 12)
})

test('buckets are contiguous and the last one ends today', () => {
  for (const opt of LOOKBACK_OPTIONS) {
    const b = getLookbackBuckets(opt.value, today)
    assert.equal(b[b.length - 1].end, '2026-09-17', opt.value)
    for (let i = 1; i < b.length; i++) {
      assert.equal(b[i].start, addDays(b[i - 1].end, 1), `${opt.value} #${i}`)
    }
  }
})

test('90 days is 13 full weekly buckets', () => {
  const b = getLookbackBuckets('90d', today)
  assert.equal(b[0].start, '2026-06-19')
  for (const w of b) assert.equal(addDays(w.start, 6), w.end)
})

test('year to date in January is a single bucket', () => {
  const b = getLookbackBuckets('ytd', new Date(2026, 0, 5))
  assert.deepEqual(b, [{ start: '2026-01-01', end: '2026-01-05', label: 'Jan' }])
})

test('12 months labels prior-year months with a year suffix', () => {
  const b = getLookbackBuckets('12m', today)
  assert.equal(b[0].start, '2025-10-01')
  assert.equal(b[0].label, 'Oct 25')
  assert.equal(b[11].label, 'Sep')
  assert.equal(b[11].end, '2026-09-17')
})

test('subtitles name range and bucket size', () => {
  assert.equal(getLookbackSubtitle('30d', today), 'Last 30 days · Aug 19 – Sep 17 · daily')
  assert.equal(getLookbackSubtitle('90d', today), 'Last 90 days · Jun 19 – Sep 17 · weekly')
  assert.equal(getLookbackSubtitle('ytd', today), 'Year to date · Jan 1 – Sep 17 · monthly')
  assert.equal(getLookbackSubtitle('12m', today), 'Last 12 months · Oct 1 – Sep 17 · monthly')
})
