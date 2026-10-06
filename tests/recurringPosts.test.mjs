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

// LED-260: a series is the row itself (its id, and recurrence_next_posted in the database), never its
// description. The LED-232 backfill grouped by description once; the generator never has.
test('renaming a recurring row changes nothing about what posts, or when', () => {
  const before = row({ id: 'rent', description: 'Rent' })
  const after = { ...before, description: 'Rent (new flat)' }
  const strip = (due) => due.map(({ source, date }) => ({ id: source.id, date }))
  assert.deepEqual(strip(dueRecurringPosts([after], '2026-10-03')), strip(dueRecurringPosts([before], '2026-10-03')))
})

test('two rows that share a description are separate series, each posting its own date', () => {
  const rows = [
    row({ id: 'payroll-15', description: 'Payroll', date: '2026-09-15' }),
    row({ id: 'payroll-30', description: 'Payroll', date: '2026-09-30' }),
  ]
  assert.deepEqual(dueRecurringPosts(rows, '2026-10-31').map(({ source, date }) => [source.id, date]), [
    ['payroll-15', '2026-10-15'],
    ['payroll-30', '2026-10-30'],
  ])
})

import { recurringRunNotice } from '../src/lib/recurringTransactions.ts'

test('a clean run reports nothing', () => {
  assert.equal(recurringRunNotice({ posted: 2, failed: 0 }), null)
  assert.equal(recurringRunNotice({ posted: 0, failed: 0 }), null)
})

test('a failed read is reported, not taken as nothing due', () => {
  const notice = recurringRunNotice({ posted: 0, failed: 0, readFailed: true })
  assert.equal(notice.title, "Couldn't check recurring transactions")
  assert.match(notice.body, /nothing due was posted/)
})

test('failed posts are counted, singular and plural', () => {
  assert.match(recurringRunNotice({ posted: 0, failed: 1 }).body, /^1 recurring transaction is due/)
  assert.match(recurringRunNotice({ posted: 1, failed: 3 }).body, /^3 recurring transactions are due/)
})
