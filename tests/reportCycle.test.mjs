import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getReportRange } from '../src/lib/reportCycle.ts'

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
