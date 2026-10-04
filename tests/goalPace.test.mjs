import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalPace, goalStatus } from '../src/lib/goalPace.ts'

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

// LED-235: on track / behind by, straight line from creation to the target date
const status = (o) => goalStatus({ target: 1200, saved: 0, createdAt: '2026-01-01T09:00:00', deadline: '2026-12-31', isCompleted: false, today, ...o })

test('saved at the straight-line amount is on track; below it is behind by the difference', () => {
  // Jan 1 to Dec 31 is 364 days; Sep 25 is day 267, so 1200 × 267/364 = 880.22 is expected.
  assert.deepEqual(status({ saved: 900 }), { kind: 'on-track' })
  assert.deepEqual(status({ saved: 880.22 }), { kind: 'on-track' })
  assert.deepEqual(status({ saved: 800 }), { kind: 'behind', by: 80.22 })
})

test('no target date, complete, or reached: nothing is shown', () => {
  assert.equal(status({ deadline: null }), null)
  assert.equal(status({ isCompleted: true }), null)
  assert.equal(status({ saved: 1200 }), null)
  assert.equal(status({ saved: 1500 }), null)
})

test('a target date in the past and not reached is behind by what remains', () => {
  assert.deepEqual(status({ deadline: '2026-09-24', saved: 1000 }), { kind: 'behind', by: 200 })
})

test('the day the goal was created, nothing is expected yet', () => {
  assert.deepEqual(status({ createdAt: '2026-09-25T23:30:00', saved: 0 }), { kind: 'on-track' })
})

test('expected is capped at the target, and a date before creation asks for all of it', () => {
  assert.deepEqual(status({ deadline: '2026-09-25', saved: 1199 }), { kind: 'behind', by: 1 })
  assert.deepEqual(status({ createdAt: '2026-09-25T08:00:00', deadline: '2026-09-20', saved: 0 }), { kind: 'behind', by: 1200 })
})

test('the created timestamp is read as a local date', () => {
  // 23:30 local on Sep 24 is one elapsed day by Sep 25, whatever the UTC date of the instant.
  const local = new Date(2026, 8, 24, 23, 30).toISOString()
  assert.deepEqual(goalStatus({ target: 100, saved: 0, createdAt: local, deadline: '2026-10-04', isCompleted: false, today }), { kind: 'behind', by: 10 })
})
