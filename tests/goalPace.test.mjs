import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalPace } from '../src/lib/goalPace.ts'

const today = new Date(2026, 8, 25) // Sep 25 2026

test('design worked example: $2,160 over 9 months is $240/mo', () => {
  const p = goalPace({ target: 4000, saved: 1840, deadline: '2027-06-30', today })
  assert.equal(p.status, 'on-pace')
  assert.equal(p.remaining, 2160)
  assert.equal(p.monthsLeft, 9)
  assert.equal(p.perMonth, 240)
  assert.equal(Math.round(p.pct), 46)
})

test('a date later this month still asks for one month', () => {
  const p = goalPace({ target: 100, saved: 40, deadline: '2026-09-30', today })
  assert.equal(p.monthsLeft, 1)
  assert.equal(p.perMonth, 60)
})

test('today as the target date is still on pace', () => {
  assert.equal(goalPace({ target: 100, saved: 0, deadline: '2026-09-25', today }).status, 'on-pace')
})

test('a past date is overdue with no monthly figure', () => {
  const p = goalPace({ target: 100, saved: 0, deadline: '2026-09-24', today })
  assert.equal(p.status, 'overdue')
  assert.equal(p.perMonth, null)
})

test('no date, and reached goals', () => {
  assert.equal(goalPace({ target: 100, saved: 0, deadline: null, today }).status, 'no-date')
  const done = goalPace({ target: 100, saved: 120, deadline: '2027-01-01', today })
  assert.equal(done.status, 'done')
  assert.equal(done.remaining, 0)
  assert.equal(done.pct, 100)
})
