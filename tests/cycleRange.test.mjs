import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateStr, monthCycleRange } from '../src/lib/cycleRange.ts'

test('dateStr pads month and day in local time', () => {
  assert.equal(dateStr(new Date(2026, 0, 5)), '2026-01-05')
})

test('calendar month cycle', () => {
  assert.deepEqual(monthCycleRange('2026-09', 1), { start: '2026-09-01', end: '2026-09-30' })
})

test('mid-month start day ends the day before the next start, across a year boundary', () => {
  assert.deepEqual(monthCycleRange('2026-12', 25), { start: '2026-12-25', end: '2027-01-24' })
})
