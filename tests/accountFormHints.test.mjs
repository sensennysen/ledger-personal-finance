import { test } from 'node:test'
import assert from 'node:assert/strict'
import { availableCredit, daysToPay, ordinal } from '../src/lib/accountFormHints.ts'
import { loanScheduleControl } from '../src/lib/accountSchema.ts'

test('days to pay runs from the next statement close to the due day after it', () => {
  // Sep 10: statement Sep 16, due Oct 1
  assert.equal(daysToPay(16, 1, new Date(2026, 8, 10)), 15)
  // Oct 20: statement Nov 16, due Dec 1
  assert.equal(daysToPay(16, 1, new Date(2026, 9, 20)), 15)
  // Due later in the same month
  assert.equal(daysToPay(5, 25, new Date(2026, 8, 1)), 20)
  // Day 31 clamps to short months: Feb 28 -> Mar 10
  assert.equal(daysToPay(31, 10, new Date(2026, 1, 1)), 10)
  assert.equal(daysToPay(null, 1), null)
  assert.equal(daysToPay(16, 0), null)
})

test('available credit is the limit minus what is owed', () => {
  assert.equal(availableCredit(4000, 1240), 2760)
  assert.equal(availableCredit(4000, -1240), 2760)
  assert.equal(availableCredit(null, 100), null)
  assert.equal(availableCredit(1000, 1500), -500)
})

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 16, 21, 22, 31].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '16th', '21st', '22nd', '31st'])
})

test('each loan period names the control it needs', () => {
  assert.equal(loanScheduleControl('twice_monthly'), 'two-days')
  assert.equal(loanScheduleControl('weekly'), 'weekday')
  assert.equal(loanScheduleControl('daily'), 'none')
  for (const period of ['monthly', 'quarterly', 'bi_yearly', 'yearly']) assert.equal(loanScheduleControl(period), 'one-day')
  assert.equal(loanScheduleControl(null), null)
})
