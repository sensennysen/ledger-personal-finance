import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dueRecurringPosts } from '../src/lib/recurringTransactions.ts'

const row = (over = {}) => ({ id: 'r1', date: '2026-09-03', recurrence_interval: 'monthly', recurrence_end_date: null, ...over })

test('a row whose next occurrence is today is due on that date', () => {
  const source = row()
  assert.deepEqual(dueRecurringPosts([source], '2026-10-03'), [{ source, date: '2026-10-03' }])
})

test('a next occurrence in the past is still due, one step at a time', () => {
  assert.deepEqual(dueRecurringPosts([row({ date: '2026-07-03' })], '2026-10-03').map((d) => d.date), ['2026-08-03'])
})

test('a next occurrence after today is not due', () => {
  assert.deepEqual(dueRecurringPosts([row({ date: '2026-09-04' })], '2026-10-03'), [])
})

test('a next occurrence after the end date is not due; on the end date it is', () => {
  assert.deepEqual(dueRecurringPosts([row({ recurrence_end_date: '2026-10-02' })], '2026-10-03'), [])
  assert.equal(dueRecurringPosts([row({ recurrence_end_date: '2026-10-03' })], '2026-10-03').length, 1)
})

test('a row with no interval is skipped', () => {
  assert.deepEqual(dueRecurringPosts([row({ recurrence_interval: null })], '2026-10-03'), [])
})

test('each interval steps from the row date', () => {
  const dates = ['daily', 'weekly', 'biweekly', 'quarterly', 'yearly'].map(
    (recurrence_interval) => dueRecurringPosts([row({ date: '2025-09-03', recurrence_interval })], '2026-10-03')[0].date,
  )
  assert.deepEqual(dates, ['2025-09-04', '2025-09-10', '2025-09-17', '2025-12-03', '2026-09-03'])
})

test('a month-end row keeps the date the generator has always posted (Jan 31 + 1 month = Mar 3)', () => {
  assert.equal(dueRecurringPosts([row({ date: '2026-01-31' })], '2026-10-03')[0].date, '2026-03-03')
})
