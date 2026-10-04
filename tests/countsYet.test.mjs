import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countsYet, countedEnd, splitCounted, scheduledIn } from '../src/lib/countsYet.ts'

test('a row counts on its date and before, not after', () => {
  assert.equal(countsYet('2026-10-04', '2026-10-04'), true)
  assert.equal(countsYet('2026-10-03', '2026-10-04'), true)
  assert.equal(countsYet('2026-10-05', '2026-10-04'), false)
})

test('the same row counts once its date arrives, with no edit', () => {
  assert.equal(countsYet('2026-10-05', '2026-10-04'), false)
  assert.equal(countsYet('2026-10-05', '2026-10-05'), true)
})

test('an open cycle counts up to today', () => {
  assert.equal(countedEnd('2026-10-24', '2026-10-04'), '2026-10-04')
})

test('a cycle ending today counts to its last day', () => {
  assert.equal(countedEnd('2026-10-04', '2026-10-04'), '2026-10-04')
})

test('a closed cycle is unchanged', () => {
  assert.equal(countedEnd('2026-09-24', '2026-10-04'), '2026-09-24')
})

test('a cycle that starts after today counts nothing', () => {
  const start = '2026-10-25'
  const end = countedEnd('2026-11-24', '2026-10-04')
  assert.ok(end < start)
})

test('dates compare across a year boundary', () => {
  assert.equal(countsYet('2027-01-02', '2026-12-31'), false)
  assert.equal(countedEnd('2027-01-24', '2026-12-31'), '2026-12-31')
})

test('splitCounted keeps order on both sides', () => {
  const rows = [{ date: '2026-10-01' }, { date: '2026-10-09' }, { date: '2026-10-04' }, { date: '2026-10-20' }]
  const { counted, scheduled } = splitCounted(rows, '2026-10-04')
  assert.deepEqual(counted.map((r) => r.date), ['2026-10-01', '2026-10-04'])
  assert.deepEqual(scheduled.map((r) => r.date), ['2026-10-09', '2026-10-20'])
})

test('scheduledIn takes only rows after today within the range', () => {
  const rows = [{ date: '2026-10-01' }, { date: '2026-10-09' }, { date: '2026-10-30' }]
  assert.deepEqual(scheduledIn(rows, '2026-09-25', '2026-10-24', '2026-10-04').map((r) => r.date), ['2026-10-09'])
  assert.deepEqual(scheduledIn(rows, '2026-08-25', '2026-09-24', '2026-10-04'), [])
})
