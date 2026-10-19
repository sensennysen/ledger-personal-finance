import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCustomReportRange, getReportRange, parseCustomRange, previousRangeOf } from '../src/lib/reportCycle.ts'

test('calendar-month cycle spans the first to the last day', () => {
  const r = getReportRange('2026-09', 1)
  assert.equal(r.start, '2026-09-01')
  assert.equal(r.end, '2026-09-30')
  assert.equal(r.filenameLabel, '2026-09-01_to_2026-09-30')
})

test('a mid-month start day ends the day before the next start', () => {
  const r = getReportRange('2026-09', 15)
  assert.equal(r.start, '2026-09-15')
  assert.equal(r.end, '2026-10-14')
})

test('a cycle crossing the year boundary', () => {
  const r = getReportRange('2026-12', 10)
  assert.equal(r.start, '2026-12-10')
  assert.equal(r.end, '2027-01-09')
  assert.match(r.label, /2027$/)
})

test('a February cycle respects the leap year', () => {
  assert.equal(getReportRange('2028-02', 1).end, '2028-02-29')
  assert.equal(getReportRange('2026-02', 1).end, '2026-02-28')
})

test('a custom range is read from the URL', () => {
  assert.deepEqual(parseCustomRange('?from=2026-01-05&to=2026-03-03'), { start: '2026-01-05', end: '2026-03-03' })
  assert.deepEqual(parseCustomRange('from=2026-01-05&to=2026-01-05'), { start: '2026-01-05', end: '2026-01-05' })
})

test('a missing, malformed or reversed range is ignored', () => {
  assert.equal(parseCustomRange(''), null)
  assert.equal(parseCustomRange('?from=2026-01-05'), null)
  assert.equal(parseCustomRange('?from=2026-02-30&to=2026-03-03'), null)
  assert.equal(parseCustomRange('?from=2026-1-5&to=2026-03-03'), null)
  assert.equal(parseCustomRange('?from=2026-03-04&to=2026-03-03'), null)
})

test('a custom range names its year and labels the download', () => {
  const r = getCustomReportRange('2026-01-05', '2026-03-03')
  assert.equal(r.label, 'Jan 5 – Mar 3, 2026')
  assert.equal(r.filenameLabel, '2026-01-05_to_2026-03-03')
  assert.equal(getCustomReportRange('2025-12-20', '2026-01-10').label, 'Dec 20, 2025 – Jan 10, 2026')
  assert.equal(getCustomReportRange('2026-04-02', '2026-04-02').label, 'Apr 2, 2026')
})

test('the previous range is the same length and ends the day before', () => {
  assert.deepEqual(previousRangeOf({ start: '2026-03-01', end: '2026-03-31' }), { start: '2026-01-29', end: '2026-02-28' })
  assert.deepEqual(previousRangeOf({ start: '2026-01-01', end: '2026-01-07' }), { start: '2025-12-25', end: '2025-12-31' })
  assert.deepEqual(previousRangeOf({ start: '2026-05-10', end: '2026-05-10' }), { start: '2026-05-09', end: '2026-05-09' })
})
